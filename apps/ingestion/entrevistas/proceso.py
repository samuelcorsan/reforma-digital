"""El pipeline completo: audio → transcripción → extracción → comprobación → métricas → JSON para la web."""

from __future__ import annotations

import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from .audio import Trozo
from .citas import coincidencia, en_contraste, flujos, localizar, normalizar, recuperar
from .esquema import (
    Analisis,
    Dictamen,
    Extraccion,
    Interrupcion,
    Momento,
    Revision,
    SegundaRevision,
    Segmento,
    TramoTema,
    Transcripcion,
    Visual,
)
from .metricas import estadisticas, nota
from .modelo import Cliente, Comprobacion, ordenar_fuentes

log = logging.getLogger("entrevistas")


# Ritmo máximo creíble de una conversación en español (palabras por minuto). Por encima, el modelo se ha inventado
# texto o ha comprimido los tiempos. Calibrado con el ensayo: una charla rápida de The Wild Project ronda 230-270
# (los subtítulos de YouTube dan 224 de media); las transcripciones inventadas llegaban a 480.
RITMO_MAXIMO = 320
HUECO_MAXIMO = 45  # segundos sin nadie hablando: en una entrevista, señal de que falta transcripción


def limpiar_trozo(segmentos: list[Segmento], largo: float) -> tuple[list[Segmento], list[str]]:
    """Tiempos relativos al trozo → segmentos válidos y lista de problemas detectados (vacía si está bien)."""
    problemas: list[str] = []
    fuera = [s for s in segmentos if s.inicio > largo + 1]
    if fuera:
        problemas.append(f"{len(fuera)} segmentos después del final del trozo")
    validos = sorted((s for s in segmentos if s.inicio <= largo + 1), key=lambda s: s.inicio)
    limpios: list[Segmento] = []
    for k, s in enumerate(validos):
        fin = min(s.fin, largo)
        if k + 1 < len(validos) and validos[k + 1].inicio > s.inicio:
            fin = min(fin, validos[k + 1].inicio)  # sin solapes: cada segmento acaba cuando empieza el siguiente
        limpios.append(s.model_copy(update={"inicio": min(s.inicio, largo), "fin": max(fin, s.inicio)}))

    palabras = sum(len(s.texto.split()) for s in limpios)
    ritmo = palabras / max(largo / 60, 0.1)
    if ritmo > RITMO_MAXIMO:
        problemas.append(f"ritmo imposible ({ritmo:.0f} palabras/min)")
    marcas = [0.0] + [x for s in limpios for x in (s.inicio, s.fin)] + [largo]
    hueco = max((marcas[k + 1] - marcas[k] for k in range(0, len(marcas) - 1, 2)), default=0)
    if hueco > HUECO_MAXIMO:
        problemas.append(f"hueco de {hueco:.0f} s sin transcribir")
    return limpios, problemas


def desfase_absoluto(segmentos: list[Segmento], trozo: Trozo) -> float:
    """Con vídeo, Gemini a veces da los tiempos del vídeo completo en vez de los del trozo: devuelve lo que hay que
    restar (0 si ya son relativos)."""
    if not segmentos or not trozo.desfase:
        return 0.0
    absolutos = sum(trozo.desfase - 5 <= s.inicio <= trozo.desfase + trozo.largo + 5 for s in segmentos)
    return trozo.desfase if absolutos > 0.8 * len(segmentos) else 0.0


def a_relativos(segmentos: list[Segmento], trozo: Trozo) -> list[Segmento]:
    resta = desfase_absoluto(segmentos, trozo)
    if not resta:
        return segmentos
    return [s.model_copy(update={"inicio": s.inicio - resta, "fin": s.fin - resta}) for s in segmentos]


def transcribir(
    cliente: Cliente, trozos: list[Trozo], candidato: str, hilos: int = 8, etiqueta: str = ""
) -> Transcripcion:
    """Transcribe todos los trozos a la vez, comprueba cada uno (tiempos, huecos, ritmo creíble) y repite los que
    fallan una vez. Devuelve segmentos (y, con vídeo, lo que se ve) con tiempos de la entrevista completa."""
    hechos = 0
    cerrojo = threading.Lock()
    marca = f" ({etiqueta})" if etiqueta else ""

    def uno(trozo: Trozo) -> Transcripcion:
        nonlocal hechos
        contexto = (
            f"\nEste fragmento empieza en el minuto {int(trozo.desfase // 60)} de la entrevista: "
            "puede empezar o acabar a mitad de una frase."
            if trozo.desfase
            else ""
        )
        mejor: tuple[list[Segmento], list[str], list[Visual]] | None = None
        for intento in range(2):
            t = cliente.transcribir(trozo, candidato, contexto, intento=intento)
            resta = desfase_absoluto(t.segmentos, trozo)
            limpios, problemas = limpiar_trozo(a_relativos(t.segmentos, trozo), trozo.largo)
            visuales = [
                v.model_copy(update={"segundo": int(v.segundo - resta)})
                for v in t.visuales
                if 0 <= v.segundo - resta <= trozo.largo + 1
            ]
            if mejor is None or len(problemas) < len(mejor[1]):
                mejor = (limpios, problemas, visuales)
            if not problemas:
                break
            log.warning(
                "%s%s: %s → %s", trozo.nombre, marca, "; ".join(problemas), "se repite" if intento == 0 else "revisar a mano"
            )
        limpios, problemas, visuales = mejor
        with cerrojo:
            hechos += 1
            log.info(
                "Transcrito %d/%d%s · %s: %d segmentos%s%s",
                hechos,
                len(trozos),
                marca,
                trozo.nombre,
                len(limpios),
                f", {len(visuales)} observaciones visuales" if visuales else "",
                f" · AVISO: {'; '.join(problemas)}" if problemas else "",
            )
        return Transcripcion(
            segmentos=[s.model_copy(update={"inicio": s.inicio + trozo.desfase, "fin": s.fin + trozo.desfase}) for s in limpios],
            visuales=[v.model_copy(update={"segundo": int(v.segundo + trozo.desfase)}) for v in visuales],
        )

    inicio = time.time()
    log.info("Transcribiendo %d trozos%s (%d a la vez)…", len(trozos), marca, hilos)
    with ThreadPoolExecutor(max_workers=max(1, hilos)) as ex:
        partes = list(ex.map(uno, trozos))
    log.info("Transcripción%s: %d trozos en %.0f s", marca, len(trozos), time.time() - inicio)
    return Transcripcion(
        segmentos=sorted((s for p in partes for s in p.segmentos), key=lambda s: s.inicio),
        visuales=sorted((v for p in partes for v in p.visuales), key=lambda v: v.segundo),
    )


TRAMO_CONTRASTE = 300  # segundos: los mismos tramos que se transcriben
COINCIDENCIA_MINIMA = 0.15  # dos transcripciones del mismo habla comparten bastante más; una inventada, casi nada
PALABRAS_PARA_CONTRASTAR = 60  # con menos texto en el tramo, la medida no es fiable


def corroborar(audio: list[Segmento], video: list[Segmento], margen: float = 30) -> list[Segmento]:
    """Con música o ruido de fondo, el modelo a veces se inventa una conversación entera. La transcripción del vídeo es
    independiente: si un tramo del audio no se parece en nada a lo que el vídeo transcribe en el mismo minuto, se
    descarta entero (antes de analizarlo, para que no cuente en preguntas, citas ni cifras)."""
    if not audio:
        return audio
    fin = max(s.fin for s in audio)
    quedan: list[Segmento] = []
    for desde in range(0, int(fin) + 1, TRAMO_CONTRASTE):
        hasta = desde + TRAMO_CONTRASTE
        tramo = [s for s in audio if desde <= s.inicio < hasta]
        palabras = sum(len(s.texto.split()) for s in tramo)
        if palabras < PALABRAS_PARA_CONTRASTAR:
            quedan += tramo
            continue
        cerca = [s for s in video if desde - margen <= s.inicio < hasta + margen]
        parecido = coincidencia(tramo, cerca)
        etiqueta = f"min {desde // 60}-{hasta // 60}"
        if parecido < COINCIDENCIA_MINIMA:
            log.warning(
                "%s: el audio no coincide con el vídeo (%.0f %% de %d palabras) → tramo descartado; ¿música o ruido "
                "transcrito como conversación? Revisar a mano",
                etiqueta, 100 * parecido, palabras,
            )
            continue
        log.info("%s: audio y vídeo coinciden en un %.0f %%", etiqueta, 100 * parecido)
        quedan += tramo
    return quedan


def bloques(segmentos: list[Segmento], minutos: int = 20) -> list[list[Segmento]]:
    """Corta la transcripción en bloques de ~N minutos por turnos de palabra completos."""
    grupos: list[list[Segmento]] = []
    for s in segmentos:
        if not grupos or s.inicio >= grupos[-1][0].inicio + minutos * 60:
            grupos.append([])
        grupos[-1].append(s)
    return grupos


def unir_temas(temas: list[TramoTema], margen: float = 60) -> list[TramoTema]:
    """Une tramos seguidos del mismo tema que quedaron partidos por el corte entre bloques."""
    unidos: list[TramoTema] = []
    for t in sorted(temas, key=lambda t: t.inicio):
        previo = unidos[-1] if unidos else None
        if previo and previo.tema.strip().lower() == t.tema.strip().lower() and t.inicio - previo.fin <= margen:
            previo.fin = max(previo.fin, t.fin)
        else:
            unidos.append(t.model_copy())
    return unidos


def extraer_por_bloques(cliente: Cliente, segmentos: list[Segmento], candidato: str, hilos: int) -> Extraccion:
    """Analiza bloques de ~20 min en paralelo (con todo de una vez, el modelo resume y se deja la mayoría de las
    preguntas) y elige al final los momentos clave de toda la entrevista."""
    trozos = bloques(segmentos)
    total = int((segmentos[-1].fin if segmentos else 0) // 60)
    hechos = 0
    cerrojo = threading.Lock()

    def uno(bloque: list[Segmento]) -> Extraccion:
        nonlocal hechos
        desde, hasta = int(bloque[0].inicio // 60), int(bloque[-1].fin // 60)
        e = cliente.extraer(
            texto_con_marcas(bloque), candidato, f"del minuto {desde} al {hasta} de una entrevista de {total} minutos"
        )
        with cerrojo:
            hechos += 1
            log.info(
                "Analizado %d/%d · min %d-%d: %d preguntas, %d propuestas, %d afirmaciones",
                hechos,
                len(trozos),
                desde,
                hasta,
                len(e.preguntas),
                len(e.propuestas),
                len(e.afirmaciones),
            )
        return e

    with ThreadPoolExecutor(max_workers=max(1, hilos)) as ex:
        partes = list(ex.map(uno, trozos))

    por_segundo = lambda x: x.segundo  # noqa: E731
    # Candidatos en orden cronológico (posición de su cita en la transcripción)
    texto = " ".join(s.texto for s in segmentos)
    unicos = {m.cita.strip().lower(): m for p in partes for m in p.momentos}  # sin repetir la misma cita
    candidatos = sorted(unicos.values(), key=lambda m: texto.find(m.cita[:40]))
    if len(candidatos) > 8:
        lista = "\n".join(f"{k + 1}. [{m.tipo}] {m.titulo} — “{m.cita}”" for k, m in enumerate(candidatos))
        elegidos = {n for n in cliente.elegir_momentos(lista, candidato) if 1 <= n <= len(candidatos)}
        candidatos = [m for k, m in enumerate(candidatos) if k + 1 in elegidos][:8]
    return Extraccion(
        temas=unir_temas([t for p in partes for t in p.temas]),
        preguntas=sorted((x for p in partes for x in p.preguntas), key=por_segundo),
        propuestas=sorted((x for p in partes for x in p.propuestas), key=por_segundo),
        ataques=sorted((x for p in partes for x in p.ataques), key=por_segundo),
        afirmaciones=sorted((x for p in partes for x in p.afirmaciones), key=por_segundo),
        momentos=candidatos,
        interrupciones=[x for p in partes for x in p.interrupciones],
    )


def texto_con_marcas(segmentos: list[Segmento]) -> str:
    return "\n".join(f"[{int(s.inicio)}] {s.hablante}: {s.texto}" for s in segmentos)


def analizar(
    cliente: Cliente,
    segmentos: list[Segmento],
    *,
    slug: str,
    candidato: str,
    titulo: str,
    youtube_id: str | None,
    publicado: str,
    duracion: float,
    comprobar: bool = True,
    segunda: bool = True,
    hilos: int = 10,
    contraste: list[Segmento] | None = None,
    visuales: list[Visual] | None = None,
) -> Analisis:
    """`contraste`: transcripción independiente (del vídeo) con la que se comprueba cada cita publicable."""
    inicio = time.time()
    e = extraer_por_bloques(cliente, segmentos, candidato, hilos)
    log.info(
        "Análisis en %.0f s: %d preguntas, %d propuestas, %d afirmaciones, %d momentos",
        time.time() - inicio,
        len(e.preguntas),
        len(e.propuestas),
        len(e.afirmaciones),
        len(e.momentos),
    )
    for lista, prefijo in ((e.preguntas, "p"), (e.propuestas, "pr"), (e.ataques, "a")):
        for k, x in enumerate(lista):
            x.id = f"{prefijo}{k + 1}"

    # Antiinvención: solo pasan las afirmaciones cuya cita está en la transcripción. Si el modelo la copió con alguna
    # palabra cambiada, se publica el tramo literal que más se le parece; si no se parece a nada, se descarta
    validas = []
    por_hablante = flujos(segmentos)  # una vez para todas las citas
    for af in e.afirmaciones:
        if len(af.cita.split()) < 6:
            log.warning("Descartada (cita demasiado corta para comprobarla): %s", af.cita)
            continue
        hallada = recuperar(af.cita, segmentos, por_hablante=por_hablante)
        if hallada is None:
            log.warning("Descartada (cita que no está en la transcripción): %s", af.cita)
            continue
        seg, literal = hallada
        if literal != af.cita:
            log.info("Cita corregida con la transcripción: «%s» → «%s»", af.cita[:60], literal[:60])
        validas.append((af.model_copy(update={"cita": literal}), seg))

    def revisar(par):
        af, seg = par
        try:
            c = cliente.comprobar(af.cita, contexto_de(segmentos, seg.inicio), candidato, publicado)
        except Exception as error:  # un fallo de la API no tumba el análisis: la segunda revisión la vuelve a buscar
            log.warning("Verificación fallida (%s), queda sin fuente para la segunda revisión: %s", error, af.cita[:80])
            c = Comprobacion(dictamen=Dictamen(veredicto="sinfuente", explicacion=""), fuentes=[])
        return Revision(
            id="",
            candidato=candidato,
            segundo=int(seg.inicio),
            cita=af.cita,
            veredicto=c.dictamen.veredicto,
            explicacion=c.dictamen.explicacion,
            fuentes=c.fuentes,
            pilladoEnDirecto=af.pillado_en_directo,
            enVideo=en_contraste(af.cita, seg.inicio, contraste) if contraste is not None else None,
            estado="propuesta",  # la segunda revisión la confirma, la corrige o la descarta
        )

    # Momentos clave: misma barrera antiinvención. Los elige la IA (elegir_momentos) y se publican sin más revisión
    momentos: list[Momento] = []
    for m in e.momentos:
        hallada = recuperar(m.cita, segmentos, por_hablante=por_hablante)
        if hallada is None:
            log.warning("Momento descartado (cita que no está en la transcripción): %s", m.cita)
            continue
        seg, literal = hallada
        m = m.model_copy(update={"cita": literal})
        momentos.append(
            Momento(
                id="",
                segundo=int(seg.inicio),
                tipo=m.tipo,
                titulo=m.titulo,
                cita=m.cita,
                porQue=m.por_que,
                enVideo=en_contraste(m.cita, seg.inicio, contraste) if contraste is not None else None,
                estado="aprobada",
            )
        )
    momentos.sort(key=lambda m: m.segundo)
    for k, m in enumerate(momentos):
        m.id = f"m{k + 1}"

    # Interrupciones: solo las que se pueden ubicar (cita literal) y donde de verdad cambia el turno
    interrupciones: list[Interrupcion] = []
    for x in e.interrupciones:
        seg = localizar(x.cita, segmentos)
        k = segmentos.index(seg) if seg else -1
        if k <= 0 or seg.hablante != x.quien or segmentos[k - 1].hablante == x.quien:
            log.warning("Interrupción descartada (no se ubica en un cambio de turno): %s", x.cita)
            continue
        # Cortar una intervención de dos palabras es un intercambio rápido, no una interrupción
        if len(segmentos[k - 1].texto.split()) < PALABRAS_CORTADAS:
            log.warning("Interrupción descartada (el turno cortado es muy corto): %s", x.cita)
            continue
        interrupciones.append(Interrupcion(segundo=int(seg.inicio), quien=x.quien))
    interrupciones = sin_rafagas(interrupciones)

    visuales = filtrar_visuales(visuales or [], candidato, segmentos)

    revisiones: list[Revision] = []
    if comprobar and validas:
        inicio = time.time()
        log.info("Verificando %d afirmaciones (%d a la vez)…", len(validas), hilos)
        with ThreadPoolExecutor(max_workers=max(1, hilos)) as ex:
            revisiones = list(ex.map(revisar, validas))
        log.info(
            "Verificadas %d afirmaciones en %.0f s (%d sin fuente)",
            len(revisiones),
            time.time() - inicio,
            sum(r.veredicto == "sinfuente" for r in revisiones),
        )
        if segunda:
            revisiones = segunda_revision(cliente, revisiones, segmentos, candidato, publicado, hilos)
    for k, r in enumerate(sorted(revisiones, key=lambda r: r.segundo)):
        r.id = f"r{k + 1}"
    if contraste is not None:
        dudosas = sum(r.enVideo is False for r in revisiones) + sum(m.enVideo is False for m in momentos)
        log.info("Contraste con la transcripción del vídeo: %d citas solo en el audio", dudosas)

    return Analisis(
        candidato=slug,
        titulo=titulo,
        youtubeId=youtube_id,
        publicado=publicado,
        duracion=duracion or (segmentos[-1].fin if segmentos else 0),
        nota=nota(segmentos, e.preguntas, e.propuestas, e.ataques, revisiones),
        stats=estadisticas(e.preguntas, e.propuestas, e.ataques, sum(x.quien == "candidato" for x in interrupciones)),
        segmentos=segmentos,
        temas=e.temas,
        preguntas=e.preguntas,
        propuestas=e.propuestas,
        ataques=e.ataques,
        revisiones=sorted(revisiones, key=lambda r: r.segundo),
        momentos=momentos,
        visuales=visuales,
        interrupciones=interrupciones,
    )


PALABRAS_CORTADAS = 5  # mínimo de palabras del turno cortado para contar una interrupción
RAFAGA = 10  # segundos: varias interrupciones seguidas son una sola discusión cruzada


def sin_rafagas(interrupciones: list[Interrupcion], margen: float = RAFAGA) -> list[Interrupcion]:
    """En una discusión cruzada los turnos cambian cada segundo: cuenta como una interrupción (la primera), no como
    una por cada cambio. Una interrupción a menos de `margen` segundos de la anterior contada no suma."""
    contadas: list[Interrupcion] = []
    for i in sorted(interrupciones, key=lambda i: i.segundo):
        if not contadas or i.segundo - contadas[-1].segundo >= margen:
            contadas.append(i)
    return contadas


def rotulo_vacio(v: Visual, candidato: str) -> bool:
    """Rótulos que no aportan nada: el nombre del candidato o un logo de dos palabras sin cifras ("rtve play")."""
    if v.tipo != "rotulo":
        return False
    texto = normalizar(v.descripcion.split(":", 1)[-1])
    return texto == normalizar(candidato) or (len(texto.split()) <= 2 and not re.search(r"\d", texto))


# Barrera de neutralidad: aunque el prompt lo prohíbe, el modelo a veces describe caras o estados de ánimo
SUBJETIVO = re.compile(
    r"\b(semblante|expresion|gesto|sonri\w*|rie|riendo|serio|seria|nervios\w*|tens[oa]|tranquil\w*|enfadad\w*|"
    r"molest[oa]|incomod\w*|preocupad\w*|content[oa]|triste|emocionad\w*|sorprendid\w*|aspecto|parece)\b"
)
# Autopromoción de la cadena o del programa: no es información de la entrevista
PROMOCION = re.compile(r"(www|\.es\b|\.com\b|episodios|suscrib|siguenos|canal)")


def neutral(v: Visual) -> bool:
    if v.tipo == "rotulo":  # un rótulo copia el texto de la pantalla: no es una descripción del modelo
        return not PROMOCION.search(v.descripcion.lower())
    if SUBJETIVO.search(normalizar(v.descripcion)):
        log.warning("Visual descartado (describe expresión o ánimo): %s", v.descripcion)
        return False
    return True


# Rótulo de última hora que pasa por la parte de abajo ("08:40:55 | …"): cambia cada segundo y no es la entrevista
TELETIPO = re.compile(r"\b\d{1,2}:\d{2}:\d{2}\b|\b\d{1,2}:\d{2}\s*\||ultima hora", re.IGNORECASE)


def _palabras(texto: str) -> set[str]:
    return {w for w in normalizar(texto).split() if len(w) > 3}


def filtrar_visuales(visuales: list[Visual], candidato: str, segmentos: list[Segmento]) -> list[Visual]:
    """Deja solo lo que aporta: sin rótulos vacíos, de promoción o de teletipo, sin repetir el mismo rótulo (en las
    teles se queda minutos en pantalla), sin rótulos que solo resumen lo que el candidato acaba de decir y sin anotar
    dos veces lo mismo en un minuto. El teletipo con titulares de otras noticias lo evita el prompt (VISUAL)."""
    quedan: list[Visual] = []
    for v in sorted(visuales, key=lambda v: v.segundo):
        if rotulo_vacio(v, candidato) or not neutral(v):
            continue
        # Lo mismo, otra vez en el mismo minuto (el modelo lo anota en dos tramos o con otras palabras)
        if any(
            q.tipo == v.tipo
            and v.segundo - q.segundo <= 60
            and len(_palabras(v.descripcion) & _palabras(q.descripcion)) >= 0.5 * max(1, len(_palabras(v.descripcion)))
            for q in quedan
        ):
            continue
        if v.tipo == "rotulo":
            texto = normalizar(v.descripcion)
            palabras = _palabras(v.descripcion)
            if TELETIPO.search(texto) or TELETIPO.search(v.descripcion):
                continue
            # Solo el nombre del candidato y del programa ("Ada Colau, en 'La Hora'", "Entrevista a …")
            if len(palabras - _palabras(candidato)) <= 1 and not re.search(r"\d", texto):
                continue
            # El mismo rótulo otra vez (o casi): solo cuenta la primera
            if any(
                q.tipo == "rotulo" and len(palabras & _palabras(q.descripcion)) >= 0.6 * max(1, len(palabras))
                for q in quedan
            ):
                continue
            # Rótulo que cita lo que se dice en ese momento: ya está en la transcripción
            cerca = set().union(*(_palabras(x.texto) for x in segmentos if abs(x.inicio - v.segundo) <= 120))
            if palabras and len(palabras & cerca) >= 0.7 * len(palabras):
                continue
        quedan.append(v)
    return quedan


def contexto_de(segmentos: list[Segmento], segundo: float) -> str:
    """Lo dicho justo antes de una cita y la propia cita: el contexto que reciben las comprobaciones."""
    k = max((i for i, s in enumerate(segmentos) if s.inicio <= segundo), default=0)
    return " ".join(s.texto for s in segmentos[max(0, k - 2) : k + 1])


def segunda_revision(
    cliente: Cliente, revisiones: list[Revision], segmentos: list[Segmento], candidato: str, fecha: str, hilos: int
) -> list[Revision]:
    """Sustituye a la revisión de una persona: otro paso de IA abre las fuentes, busca la oficial por su cuenta y
    confirma, corrige o descarta cada verificación. Solo se aprueba lo que acaba con al menos una fuente."""

    def una(r: Revision) -> Revision:
        if r.estado != "propuesta":
            return r  # ya revisada: no se repite
        propuesta = Comprobacion(dictamen=Dictamen(veredicto=r.veredicto, explicacion=r.explicacion), fuentes=r.fuentes)
        try:
            hecho = cliente.revisar(r.cita, contexto_de(segmentos, r.segundo), candidato, fecha, propuesta)
        except Exception as error:  # se queda pendiente («sin revisar» en la web) y se repite con `revisar`
            log.warning("Segunda revisión fallida (%s), queda pendiente: %s", error, r.cita[:80])
            return r
        d = hecho.decision
        # Si las propuestas valen, se suman las que encontró la revisión (las oficiales, primero)
        fuentes = ordenar_fuentes(r.fuentes + hecho.fuentes)[:4] if d.fuentes_ok else hecho.fuentes
        nota = d.nota
        veredicto = d.veredicto
        # Sin ninguna fuente, nunca se califica: se publica como «Sin fuente»
        if not fuentes and veredicto != "sinfuente":
            veredicto = "sinfuente"
            nota = f"{nota} Sin ninguna fuente enlazada: sale sin calificar.".strip()
        # Solo se descarta lo que no es una afirmación (una opinión, una promesa, una repetición)
        aprobada = d.decision != "descartar"
        return r.model_copy(
            update={
                "veredicto": veredicto if aprobada else r.veredicto,
                "explicacion": d.explicacion if aprobada else r.explicacion,
                "fuentes": fuentes if aprobada else r.fuentes,
                "estado": "aprobada" if aprobada else "descartada",
                "segundaRevision": SegundaRevision(
                    sugerencia=r.veredicto if veredicto != r.veredicto else None,
                    fuentesOk=d.fuentes_ok,
                    nota=nota,
                ),
            }
        )

    inicio = time.time()
    with ThreadPoolExecutor(max_workers=max(1, hilos)) as ex:
        hechas = list(ex.map(una, revisiones))
    aprobadas = [r for r in hechas if r.estado == "aprobada"]
    log.info(
        "Segunda revisión en %.0f s: %d publicadas (%d corregidas, %d sin fuente), %d descartadas",
        time.time() - inicio,
        len(aprobadas),
        sum(r.segundaRevision is not None and r.segundaRevision.sugerencia is not None for r in aprobadas),
        sum(r.veredicto == "sinfuente" for r in aprobadas),
        sum(r.estado == "descartada" for r in hechas),
    )
    if pendientes := sum(r.estado == "propuesta" for r in hechas):
        log.warning("⚠ %d sin la segunda revisión por errores de la API: repítela con `revisar`", pendientes)
    return hechas


def recalcular(a: Analisis) -> Analisis:
    """La nota y las estadísticas con las verificaciones aprobadas en la segunda revisión."""
    return a.model_copy(
        update={
            "nota": nota(a.segmentos, a.preguntas, a.propuestas, a.ataques, a.revisiones),
            "stats": estadisticas(a.preguntas, a.propuestas, a.ataques, a.stats.faltas),
        }
    )


def agrupar_comunes(cliente, entrevistas: dict[str, Analisis]) -> list[dict]:
    """Agrupa las preguntas comunes de varias entrevistas (la misma pregunta a distintos candidatos).
    Solo se aceptan ids que existen y como mucho una pregunta por candidato en cada grupo."""
    filas = [
        f"{slug}:{p.id} | {slug} | {p.texto}"
        for slug, a in entrevistas.items()
        for p in a.preguntas
        if p.comun
    ]
    if not filas:
        return []
    existentes = {f"{slug}:{p.id}" for slug, a in entrevistas.items() for p in a.preguntas}
    salida = []
    for k, g in enumerate(cliente.agrupar_comunes("\n".join(filas)).grupos):
        respuestas: dict[str, str] = {}
        for i in g.ids:
            if i in existentes and i.split(":")[0] not in respuestas:
                slug, pid = i.split(":", 1)
                respuestas[slug] = pid
        if len(respuestas) >= 2:
            salida.append({"id": f"c{k + 1}", "tema": g.tema, "pregunta": g.pregunta, "respuestas": respuestas})
    return salida
