"""El pipeline de las entrevistas, con el cliente simulado: sin clave de API, sin red y sin coste."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from entrevistas import metricas, proceso
from entrevistas.citas import localizar, normalizar
from entrevistas.esquema import Analisis, Ataque, Extraccion, Pregunta, Propuesta, Revision, Segmento, Transcripcion
from entrevistas.modelo import ClienteSimulado

RAIZ = Path(__file__).resolve().parents[3]
EJEMPLO = json.loads((RAIZ / "apps" / "web" / "lib" / "elecciones" / "entrevistas" / "ejemplo.json").read_text(encoding="utf-8"))


def seg(t, texto, h="candidato"):
    return Segmento(inicio=t, fin=t + 10, hablante=h, texto=texto)


def test_cita_literal_ignora_tildes_y_puntuacion():
    s = [seg(0, "Hola."), seg(12, "La vivienda ha subido más de un 40 % en cinco años, y los salarios no.")]
    assert localizar("la vivienda ha subido mas de un 40 % en cinco anos", s) is s[1]
    assert localizar("La vivienda ha bajado", s) is None
    assert normalizar("¿Qué tal?") == "que tal"


def test_encoger_acerca_al_centro_con_pocos_datos():
    assert metricas.encoger([1.0]) < 0.8  # un solo acierto no da un 10
    assert metricas.encoger([1.0] * 100) > 0.98


def test_nota_entre_0_y_10_y_margen_positivo():
    segmentos = [seg(0, "Construiremos 100.000 viviendas en cuatro años."), seg(20, "Mire usted, eso ya se verá.")]
    preguntas = [Pregunta(segundo=0, texto="¿Qué harás?", respuesta="directa"), Pregunta(segundo=15, texto="¿Y?", respuesta="evasiva")]
    propuestas = [Propuesta(segundo=0, texto="100.000 viviendas", que=True, cuanto=True, cuando=True, como=False)]
    ataques = [Ataque(segundo=20, objetivo="Otro", tipo="personal", texto="mentirosos")]
    revisiones = [Revision(id="r1", candidato="X", segundo=0, cita="c", veredicto="legal", explicacion="", fuentes=[], estado="aprobada")]
    n = metricas.nota(segmentos, preguntas, propuestas, ataques, revisiones, iteraciones=50)
    assert 0 <= n.global_ <= 10
    assert n.margen >= 0.2
    assert set(n.criterios) == set(metricas.PESOS)


def test_solo_cuentan_las_revisiones_aprobadas():
    base = [Revision(id="r1", candidato="X", segundo=0, cita="c", veredicto="roja", explicacion="", fuentes=[])]
    propuesta = metricas.criterios([], [], [], [], base)["veracidad"]
    aprobada = metricas.criterios([], [], [], [], [base[0].model_copy(update={"estado": "aprobada"})])["veracidad"]
    assert propuesta == 7.0  # sin revisiones aprobadas: valor neutro
    assert aprobada < propuesta


def test_pipeline_simulado_genera_el_formato_de_la_web():
    transcripcion = Transcripcion(segmentos=EJEMPLO["segmentos"])
    extraccion = Extraccion(
        temas=EJEMPLO["temas"],
        preguntas=EJEMPLO["preguntas"],
        propuestas=EJEMPLO["propuestas"],
        ataques=EJEMPLO["ataques"],
        afirmaciones=[{"segundo": r["segundo"], "cita": r["cita"], "por_que_comprobable": "x"} for r in EJEMPLO["revisiones"]]
        + [{"segundo": 0, "cita": "Frase inventada que nadie dijo", "por_que_comprobable": "x"}],
        momentos=[{"tipo": m["tipo"], "titulo": m["titulo"], "cita": m["cita"], "por_que": m["porQue"]} for m in EJEMPLO["momentos"]]
        + [{"tipo": "titular", "titulo": "x", "cita": "Momento que nadie dijo", "por_que": "x"}],
        interrupciones=[
            {"quien": "candidato", "cita": "el dato de afiliados es el que es"},  # se ubica: cambio de turno real
            {"quien": "jordi", "cita": "Frase que nadie dijo"},  # no se ubica: se descarta
        ],
    )
    cliente = ClienteSimulado(transcripcion, extraccion)
    from entrevistas.audio import Trozo

    largo = EJEMPLO["duracion"]
    trozos = [Trozo(desfase=0.0, largo=largo, audio=Path("a.m4a")), Trozo(desfase=largo, largo=largo, audio=Path("b.m4a"))]
    segmentos = proceso.transcribir(cliente, trozos, "Candidato de ejemplo").segmentos
    assert segmentos[len(EJEMPLO["segmentos"])].inicio >= largo  # el segundo trozo se desplaza

    a = proceso.analizar(
        cliente, segmentos, slug="ejemplo", candidato="Candidato de ejemplo", titulo="t", youtube_id=None,
        publicado="2026-11-13", duracion=2000,
    )
    # La cita inventada se descarta; las demás pasan la segunda revisión (simulada: aprueba lo que trae fuente)
    assert len(a.revisiones) == len(EJEMPLO["revisiones"])
    assert all(r.estado == "aprobada" and r.segundaRevision for r in a.revisiones)
    assert [r.id for r in a.revisiones] == [f"r{k + 1}" for k in range(len(a.revisiones))]
    # Los momentos clave pasan la misma barrera: cita literal y ordenados; los elige la IA y se publican
    assert len(a.momentos) == len(EJEMPLO["momentos"])
    assert all(m.estado == "aprobada" for m in a.momentos)
    assert [m.segundo for m in a.momentos] == sorted(m.segundo for m in a.momentos)
    # Interrupciones: solo las ubicables en un cambio de turno; las del candidato son las faltas
    assert [i.quien for i in a.interrupciones] == ["candidato"]
    assert a.stats.faltas == 1

    # Mismas claves que consume la web (interviewSchema en apps/web/lib/elecciones/interviews.ts)
    salida = json.loads(a.a_json())
    assert set(salida) == set(EJEMPLO)
    assert set(salida["nota"]) == {"global", "margen", "criterios"}
    assert set(EJEMPLO["revisiones"][0]) <= set(salida["revisiones"][0])  # todo lo que la web necesita


def test_ejemplo_valida_contra_el_esquema():
    Analisis.model_validate(EJEMPLO)


def test_titulo_de_fuente_usa_el_dominio_si_no_hay_titulo():
    from entrevistas.modelo import titulo_fuente

    assert titulo_fuente("ine.es", "https://www.ine.es/prensa/epa_prensa.htm") == "ine.es"
    assert titulo_fuente("", "https://www.boe.es/x") == "boe.es"
    assert titulo_fuente("INE · EPA", "https://www.ine.es/x") == "INE · EPA"


def test_veredictos_son_los_cuatro_de_la_web():
    assert set(metricas.PUNTOS_VEREDICTO) == {"legal", "amarilla", "fuera", "roja"}


def test_coste_separa_audio_texto_y_razonamiento():
    from types import SimpleNamespace as N

    from entrevistas.costes import Contador

    c = Contador("gemini-3.8-flash")
    uso = N(
        prompt_token_count=1_000_000,
        prompt_tokens_details=[N(modality="MediaModality.AUDIO", token_count=800_000)],
        tool_use_prompt_token_count=0,
        candidates_token_count=100_000,
        thoughts_token_count=100_000,
    )
    c.anotar("transcripcion", uso, segundos=3)
    p = c.pasos["transcripcion"]
    assert (p.entrada_audio, p.entrada_texto, p.salida, p.razonamiento) == (800_000, 200_000, 100_000, 100_000)
    assert round(c.coste(p), 2) == 0.75 + 0.75  # 1M de entrada a 0,75 + 200k de salida a 3,75
    assert Contador("modelo-sin-precio").coste(p) is None


def test_fuentes_de_google_sin_resolver_no_se_publican(monkeypatch):
    from entrevistas import modelo

    class Respuesta:
        def __init__(self, url):
            self.url = url

        def geturl(self):
            return self.url

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    destinos = {"https://a": "https://www.ine.es/x", "https://b": "https://vertexaisearch.cloud.google.com/grounding/x"}
    monkeypatch.setattr(modelo.urllib.request, "urlopen", lambda req, timeout: Respuesta(destinos[req.full_url]))
    assert modelo.url_final("https://a") == "https://www.ine.es/x"
    assert modelo.url_final("https://b") is None


def test_reintenta_errores_pasajeros(monkeypatch):
    from types import SimpleNamespace as N

    from google.genai import errors

    from entrevistas import modelo
    from entrevistas.costes import Contador

    llamadas = []

    def generar(**kw):
        llamadas.append(kw)
        if len(llamadas) < 3:
            raise errors.APIError(429, {"error": {"message": "rate limit", "status": "RESOURCE_EXHAUSTED"}})
        return N(candidates=[], usage_metadata=None)

    c = object.__new__(modelo.ClienteGemini)
    c.modelo, c.contador, c._sin_razonar = "gemini-3.8-flash", Contador("gemini-3.8-flash"), False
    c.cliente = N(models=N(generate_content=generar))
    monkeypatch.setattr(modelo.time, "sleep", lambda s: None)
    c._generar("dictamen", "hola", temperature=0.0)
    assert len(llamadas) == 3
    assert c.contador.pasos["dictamen"].llamadas == 1
    # El nivel de razonamiento del paso viaja en la configuración
    assert llamadas[-1]["config"].thinking_config.thinking_level.name == "LOW"


def test_plan_gratuito_para_en_seco_sin_reintentar(monkeypatch):
    from types import SimpleNamespace as N

    import pytest
    from google.genai import errors

    from entrevistas import modelo
    from entrevistas.costes import Contador

    llamadas = []

    def generar(**kw):
        llamadas.append(kw)
        msg = "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests"
        raise errors.APIError(429, {"error": {"message": msg, "status": "RESOURCE_EXHAUSTED"}})

    c = object.__new__(modelo.ClienteGemini)
    c.modelo, c.contador, c._sin_razonar = "gemini-3.8-flash", Contador("gemini-3.8-flash"), False
    c.cliente = N(models=N(generate_content=generar))
    monkeypatch.setattr(modelo.time, "sleep", lambda s: None)
    with pytest.raises(SystemExit, match="plan gratuito"):
        c._generar("transcripcion", "hola")
    assert len(llamadas) == 1


def test_limpiar_trozo_quita_lo_que_va_mas_alla_del_final_y_los_solapes():
    segs = [seg(0, "hola " * 20), Segmento(inicio=5, fin=40, hablante="jordi", texto="pregunta"), seg(500, "inventado")]
    limpios, problemas = proceso.limpiar_trozo(segs, largo=100)
    assert [s.inicio for s in limpios] == [0, 5]
    assert limpios[0].fin == 5  # acaba cuando empieza el siguiente
    assert limpios[1].fin == 40
    assert any("después del final" in p for p in problemas)
    assert any("hueco de 60 s" in p for p in problemas)  # del segundo 40 al 100 sin transcribir
    _, ok = proceso.limpiar_trozo([seg(k * 10, "palabra " * 25) for k in range(6)], largo=60)
    assert ok == []
    _, rapido = proceso.limpiar_trozo([seg(k * 10, "palabra " * 90) for k in range(6)], largo=60)
    assert any("ritmo imposible" in p for p in rapido)


def test_tiempos_absolutos_del_video_se_pasan_a_relativos():
    from entrevistas.audio import Trozo

    t = Trozo(desfase=600, largo=300, url="https://youtu.be/x")
    absolutos = [seg(610, "a"), seg(700, "b"), seg(880, "c")]
    assert [s.inicio for s in proceso.a_relativos(absolutos, t)] == [10, 100, 280]
    relativos = [seg(10, "a"), seg(100, "b")]
    assert [s.inicio for s in proceso.a_relativos(relativos, t)] == [10, 100]


def test_temas_partidos_entre_bloques_se_unen():
    from entrevistas.esquema import TramoTema

    t = proceso.unir_temas(
        [TramoTema(tema="Vivienda", inicio=0, fin=1190), TramoTema(tema="vivienda ", inicio=1200, fin=1500),
         TramoTema(tema="Europa", inicio=1500, fin=1800)]
    )
    assert [(x.tema, x.inicio, x.fin) for x in t] == [("Vivienda", 0, 1500), ("Europa", 1500, 1800)]


def test_fuentes_oficiales_primero_y_sin_videos_ni_redes():
    from entrevistas.esquema import Fuente
    from entrevistas.modelo import ordenar_fuentes

    f = ordenar_fuentes(
        [Fuente(titulo="El País", url="https://elpais.com/x"), Fuente(titulo="YT", url="https://www.youtube.com/watch?v=1"),
         Fuente(titulo="INE", url="https://www.ine.es/x"), Fuente(titulo="Interior", url="https://www.interior.gob.es/x"),
         Fuente(titulo="X", url="https://x.com/a/status/1")]
    )
    assert [x.titulo for x in f] == ["INE", "Interior", "El País"]


def test_tiempos_mmss_se_convierten_a_segundos():
    from entrevistas.esquema import a_segundos

    assert a_segundos("02:17") == 137  # Gemini escribía 217 en vez de 137
    assert a_segundos("4:59") == 299
    assert a_segundos("1:02:03") == 3723
    assert a_segundos("137.5") == 137.5
    assert a_segundos("raro") == 0.0


def test_wikipedia_y_transcripciones_de_podcasts_no_valen_como_fuente():
    from entrevistas.esquema import Fuente
    from entrevistas.modelo import ordenar_fuentes

    f = ordenar_fuentes(
        [Fuente(titulo="W", url="https://es.wikipedia.org/wiki/X"), Fuente(titulo="HS", url="https://podcasts.happyscribe.com/x"),
         Fuente(titulo="BOE", url="https://www.boe.es/x")]
    )
    assert [x.titulo for x in f] == ["BOE"]


def test_contraste_con_la_transcripcion_del_video():
    from entrevistas.citas import en_contraste

    video = [seg(100, "Mira, la vivienda ha subido más de un cuarenta por ciento en cinco años y los sueldos no")]
    # La misma frase en las dos transcripciones, cerca del mismo minuto: contrastada
    assert en_contraste("la vivienda ha subido más de un cuarenta por ciento en cinco años", 98, video)
    # Lejos en el tiempo o inexistente: no
    assert not en_contraste("la vivienda ha subido más de un cuarenta por ciento en cinco años", 900, video)
    assert not en_contraste("hemos creado más empleo que nunca en la historia", 98, video)


def test_preguntas_comunes_se_agrupan_sin_inventar_ids():
    a = Analisis.model_validate(EJEMPLO)
    b = a.model_copy(deep=True)
    entrevistas = {"pedro-sanchez": a, "alberto-nunez-feijoo": b}
    cliente = ClienteSimulado(Transcripcion(segmentos=[]), Extraccion(temas=[], preguntas=[], propuestas=[], ataques=[], afirmaciones=[]))
    grupos = proceso.agrupar_comunes(cliente, entrevistas)
    comunes = [p for p in a.preguntas if p.comun]
    assert len(grupos) == len(comunes)  # cada pregunta común, hecha a los dos
    assert all(set(g["respuestas"]) == {"pedro-sanchez", "alberto-nunez-feijoo"} for g in grupos)


def test_cortes_de_red_se_reintentan(monkeypatch):
    import httpx

    from entrevistas import modelo

    llamadas = []

    def subir():
        llamadas.append(1)
        if len(llamadas) < 3:
            raise httpx.ConnectError("[SSL: TLSV1_ALERT_DECODE_ERROR]")
        return "ok"

    monkeypatch.setattr(modelo.time, "sleep", lambda s: None)
    assert modelo.con_reintentos(subir, "subida") == "ok"
    assert len(llamadas) == 3


def test_discusion_cruzada_cuenta_como_una_interrupcion():
    from entrevistas.esquema import Interrupcion

    rafaga = [Interrupcion(segundo=s, quien=q) for s, q in ((10, "jordi"), (12, "candidato"), (13, "jordi"), (25, "jordi"))]
    assert [i.segundo for i in proceso.sin_rafagas(rafaga)] == [10, 25]


def test_rotulos_sin_informacion_se_descartan():
    from entrevistas.esquema import Visual

    vacio = lambda d: proceso.rotulo_vacio(Visual(segundo=0, tipo="rotulo", descripcion=d), "Pedro Sánchez")  # noqa: E731
    assert vacio("Rótulo sobreimpreso en pantalla: PEDRO SÁNCHEZ")
    assert vacio("rtve play")
    assert not vacio("El paro baja al 10,5 %")
    assert not vacio("DICE LA PERSONA QUE PIDE EL VOTO")


def test_video_fuera_de_youtube_se_descarga():
    from entrevistas.audio import es_youtube

    assert es_youtube("https://www.youtube.com/watch?v=abc") and es_youtube("https://youtu.be/abc")
    assert not es_youtube("https://www.rtve.es/play/videos/la-revuelta/programa/17279095/")


def test_visuales_sin_expresiones_ni_promocion():
    from entrevistas.esquema import Visual

    v = lambda t, d: proceso.neutral(Visual(segundo=0, tipo=t, descripcion=d))  # noqa: E731
    assert not v("documento", "En la pantalla se muestra una fotografía de un diputado con el semblante serio")
    assert not v("accion", "El candidato sonríe mientras escucha")
    assert not v("rotulo", "TODOS LOS EPISODIOS Y ENTREVISTAS EN RTVE.ES/LAREVUELTA")
    assert v("rotulo", "ASÍ VE ABASCAL AL VOTANTE DEL PSOE")
    assert v("documento", "El candidato muestra a cámara un gráfico del paro")
    assert v("accion", "Jordi consulta sus notas antes de la siguiente pregunta")


def test_rotulos_de_tele_sin_teletipo_ni_repetidos_ni_citas():
    from entrevistas.esquema import Visual

    r = lambda t, d: Visual(segundo=t, tipo="rotulo", descripcion=d)  # noqa: E731
    segmentos = [seg(100, "Vivimos en una sociedad capitalista y parece que el éxito se mide en el dinero")]
    visuales = [
        r(10, "08:40:55 | PONE TVE Y EL PP VE UN INTENTO DE BOICOT"),
        r(20, "El paro registrado baja en 20.000 personas en octubre"),
        r(21, "El paro registrado baja en 20.000 personas en octubre de 2026"),
        r(110, '"Vivimos en una sociedad capitalista y parece que el éxito se mide en el dinero"'),
    ]
    quedan = proceso.filtrar_visuales(visuales, "Ada Colau", segmentos)
    assert [v.segundo for v in quedan] == [20]


def test_rotulos_de_reloj_y_de_programa_fuera():
    from entrevistas.esquema import Visual

    r = lambda d: Visual(segundo=0, tipo="rotulo", descripcion=d)  # noqa: E731
    quedan = proceso.filtrar_visuales(
        [r("09:06:30 TEGIA PROVOCADORA EN REDES Y EL PSOE"), r("Ada Colau, en 'La Hora'"), r("Entrevista a Ada Colau"),
         r("Clamor por la muerte de Maricarmen")],
        "Ada Colau",
        [],
    )
    assert [v.descripcion for v in quedan] == ["Clamor por la muerte de Maricarmen"]


def test_en_los_ensayos_el_entrevistador_es_quien_conduce():
    from entrevistas import prompts

    jordi = prompts.TRANSCRIBIR.format(medio="audio", **prompts.presentacion(None, "X"), candidato="X", largo=300,
                                       fin_mmss="05:00", extra="", contexto="")
    assert "Jordi Wild" in jordi and "verificador" in jordi
    ensayo = prompts.TRANSCRIBIR.format(medio="audio", **prompts.presentacion("Carmen Morodo", "X"), candidato="X",
                                        largo=300, fin_mmss="05:00", extra="", contexto="")
    assert "Carmen Morodo" in ensayo and "aunque no se llame Jordi" in ensayo and '"verificador"' not in ensayo


def test_tramo_inventado_sobre_musica_se_descarta():
    real = "la deuda pública ha subido mucho en los últimos años y hay que bajar el gasto de los ministerios "
    inventado = "vamos con la economía dónde recortaría usted el incremento de las pensiones conforme al ipc "
    audio = [seg(t, inventado * 2) for t in range(0, 300, 30)] + [seg(t, real * 2) for t in range(300, 600, 30)]
    video = [seg(t, real * 2) for t in range(300, 600, 30)]  # en el vídeo, los primeros 5 min son solo música
    quedan = proceso.corroborar(audio, video)
    assert quedan and all(s.inicio >= 300 for s in quedan)


def test_sincronia_avisa_si_la_transcripcion_va_desplazada(tmp_path):
    from entrevistas import sincronia

    # Treinta frases distintas entre sí (las que se repiten se descartan por ambiguas)
    frases = [" ".join(f"p{n}x{k}" for k in range(10)) for n in range(30)]
    # Los subtítulos de YouTube: una frase cada 20 s
    eventos = [{"tStartMs": n * 20_000, "segs": [{"utf8": f}]} for n, f in enumerate(frases)]
    subtitulos = tmp_path / "subtitulos.es.json3"
    subtitulos.write_text(json.dumps({"events": eventos}), encoding="utf-8")

    bien = sincronia.medir([seg(n * 20 + 2, f) for n, f in enumerate(frases)], subtitulos)
    assert bien.bien and bien.comparables == 30 and bien.mediana == 2

    # Desde la mitad, el texto va dos minutos por delante del vídeo
    mal = sincronia.medir([seg(n * 20 - (120 if n >= 15 else 0), f) for n, f in enumerate(frases)], subtitulos)
    assert not mal.bien and mal.dentro == 0.5 and len(mal.fuera) == 15


def test_segunda_revision_confirma_corrige_o_descarta():
    from entrevistas.esquema import Decision, Fuente
    from entrevistas.modelo import Revisado

    oficial = Fuente(titulo="INE", url="https://www.ine.es/x")
    nueva = Fuente(titulo="BOE", url="https://www.boe.es/y")
    prensa = Fuente(titulo="Un periódico", url="https://www.periodico.es/z")
    decisiones = {
        "a": (Decision(decision="confirmar", veredicto="legal", explicacion="e", fuentes_ok=True, nota="n"), [oficial]),
        "b": (Decision(decision="corregir", veredicto="fuera", explicacion="otra", fuentes_ok=False, nota="n"), [nueva]),
        "c": (Decision(decision="descartar", veredicto="roja", explicacion="e", fuentes_ok=False, nota="n"), [nueva]),
        "d": (Decision(decision="confirmar", veredicto="legal", explicacion="e", fuentes_ok=False, nota="n"), []),
        "e": (Decision(decision="corregir", veredicto="roja", explicacion="e", fuentes_ok=False, nota="n"), [prensa]),
    }

    class Cliente:
        def revisar(self, cita, contexto, candidato, fecha, propuesta):
            decision, fuentes = decisiones[cita]
            return Revisado(decision=decision, fuentes=fuentes)

    revisiones = [
        Revision(id=c, candidato="X", segundo=0, cita=c, veredicto="legal", explicacion="e", fuentes=[oficial])
        for c in "abcde"
    ]
    a, b, c, d, e = proceso.segunda_revision(Cliente(), revisiones, [seg(0, "hola")], "X", "2026-11-13", 2)
    # Las fuentes de las dos pasadas se juntan sin repetir
    assert (a.estado, a.fuentes, a.segundaRevision.sugerencia) == ("aprobada", [oficial], None)
    # Corregida: otro veredicto, con las fuentes que encontró la segunda revisión, y queda el que se propuso
    assert (b.estado, b.veredicto, b.explicacion, b.fuentes) == ("aprobada", "fuera", "otra", [nueva])
    assert b.segundaRevision.sugerencia == "legal"
    # Solo se descarta lo que no es una afirmación
    assert c.estado == "descartada"
    # Sin ninguna fuente, no se califica: sale publicada como «Sin fuente», aunque la decisión fuera confirmar
    assert (d.estado, d.veredicto) == ("aprobada", "sinfuente")
    # Falso solo con prensa: sale con su calificación y la prensa enlazada
    assert (e.estado, e.veredicto, e.fuentes) == ("aprobada", "roja", [prensa])


def test_indice_de_la_web_da_de_alta_lo_publicado_y_nunca_los_ensayos(tmp_path, monkeypatch):
    from entrevistas import __main__ as cli

    for nombre in ("ejemplo", "13n-pedro-sanchez", "comunes-13n", "ensayo-vaquero"):
        (tmp_path / f"{nombre}.json").write_text("{}")
    monkeypatch.setattr(cli, "DATOS_WEB", tmp_path)
    texto = cli.registrar().read_text()
    assert "import entrevista13nPedroSanchez from './13n-pedro-sanchez.json';" in texto
    assert "export const files: unknown[] = [entrevista13nPedroSanchez, ejemplo];" in texto
    assert "export const commonFiles: Record<string, unknown> = { '13n': comunes13n };" in texto
    assert "ensayo" not in texto


def test_lo_que_no_tiene_fuente_se_publica_y_no_cuenta_en_la_nota():
    base = Revision(id="r1", candidato="X", segundo=0, cita="c", veredicto="legal", explicacion="", fuentes=[])
    cierta = base.model_copy(update={"estado": "aprobada"})
    sin_fuente = base.model_copy(update={"estado": "aprobada", "veredicto": "sinfuente"})
    veracidad = lambda revisiones: metricas.criterios([], [], [], [], revisiones)["veracidad"]  # noqa: E731
    assert veracidad([cierta, sin_fuente]) == veracidad([cierta])


def test_cita_mal_copiada_se_recupera_literal_de_la_transcripcion():
    from entrevistas.citas import recuperar

    segmentos = [
        seg(0, "Hola, buenas tardes."),
        seg(10, "Mira, el paro juvenil en España ha bajado al veintiséis por ciento este año, eso es así."),
    ]
    # El modelo cambió una palabra («bajado» por «caído»): se publica el tramo tal como se dijo
    hallada = recuperar("el paro juvenil en España ha caído al veintiséis por ciento este año", segmentos)
    assert hallada == (segmentos[1], "el paro juvenil en España ha bajado al veintiséis por ciento este año,")
    # Partida entre dos trozos, con un «mhm» del entrevistador en medio: se une lo que dijo, sin el «mhm»
    partida = [
        seg(0, "Hombre, yo cuando mataron al Pollo,"),
        seg(5, "Mhm.", h="jordi"),
        seg(6, "que nosotros estábamos allí."),
    ]
    assert recuperar("yo cuando mataron al Pollo, que nosotros estábamos allí", partida) == (
        partida[0],
        "yo cuando mataron al Pollo, que nosotros estábamos allí.",
    )
    # Lo que no se parece a nada sigue descartándose
    assert recuperar("la inflación subió un cuatro por ciento en Francia el año pasado", segmentos) is None
