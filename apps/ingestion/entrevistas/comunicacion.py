"""
El análisis de comunicación de una entrevista, para la web: cómo se pregunta y se responde, la voz, las trabas, los
silencios y los movimientos de la cara. No lo calcula este módulo: lee la carpeta de medidas de cada entrevista
(transcripción con Whisper, voz con Praat, cara con py-feat, lectura de preguntas e informe) y la deja en el JSON que
valida y pinta la web (apps/web/lib/elecciones/comunicacion/<ronda>-<candidato>.json).

Uso, desde apps/ingestion:
  python -m entrevistas.comunicacion /ruta/a/las/medidas              # todas las carpetas de candidatos que haya
  python -m entrevistas.comunicacion /ruta/a/las/medidas ada-colau    # una

Solo usa la biblioteca estándar. Las medidas (vídeo, audio y CSV) no están en el repositorio. Después de convertir:
`pnpm exec prettier --write apps/web/lib/elecciones/comunicacion` y, si la entrevista es nueva, su alta en
apps/web/lib/elecciones/communication.ts. También escribe los paquetes de datos que se descargan desde la web
(apps/web/public/datos/comunicacion/*.zip): solo lo publicable de cada carpeta.
"""

from __future__ import annotations

import csv
import io
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
DATOS_WEB = RAIZ / "apps" / "web" / "lib" / "elecciones" / "comunicacion"
# Los paquetes de datos para descargar: la web los sirve en /datos/comunicacion/<paquete>.zip.
PAQUETES = RAIZ / "apps" / "web" / "public" / "datos" / "comunicacion"
RONDA = "13n"

# Lo que se publica de la carpeta de una entrevista. Fuera quedan el vídeo, el audio, los fotogramas y los clips
# (son del programa), los comentarios de YouTube (llevan nombres de usuarios), las huellas de identidad de caras y
# voces, y la salida de los clasificadores de emoción, que el análisis no usa.
DE_LA_ENTREVISTA = (
    "informe_publicable.md",
    "informe.md",
    "informe_expresiones.md",
    "informe_movimiento.md",
    "transcripcion.csv",
    "palabras.csv",
    "palabras_whisper.csv",
    "segmentos_whisper.csv",
    "palabras_verificadas.csv",
    "diarizacion.csv",
    "hablantes.json",
    "qa_pares.csv",
    "disfluencias_*.csv",
    "pausas_*.csv",
    "voz_*.csv",
    "tonalidad_*.csv",
    "retorica.csv",
    "cambios_tema_aprox.csv",
    "cara_entrevistado.csv",
    "cara_entrevistador.csv",
    "cara_grupos_identidad.csv",
    "expresiones_*.csv",
    "movimiento_*.csv",
    "comparativa.csv",
    "cortes_plano.txt",
    "momentos_*.csv",
    "lectura/*",
    "verificacion_datos.csv",
    "verificacion_datos.md",
    "grafica_*.png",
)
DE_LA_COMPARACION = (
    "v3/*",
    "lectura3/*",
    "presion/*",
    "publico/publico_2.*",
    "coherencia/*",
    "general/comparacion_general.md",
    "general/evasion_rango.json",
    "general/grafica_*.png",
)
# La gráfica del clasificador de emoción en la voz.
SIN_PUBLICAR = {"grafica_tonalidad.png"}

LEEME = """# {titulo}

Datos del análisis de comunicación de las entrevistas de The Wild Project del 13 de noviembre de 2026, tal como
se midieron. Los minutos y los segundos son los del vídeo original.

{contenido}

## Lo que no va en este paquete

- El vídeo, el audio, los fotogramas y los clips: son del programa. Cada dato lleva su minuto para ir al original.
- Los comentarios de YouTube: llevan nombres de usuarios. Sí van los recuentos.
- Las huellas de identidad de caras y voces con las que se asignó cada cara y cada voz a su persona.
- La salida de los clasificadores de emoción en la voz y en la cara: el análisis no los usa.

## Para leerlo bien

- Ninguna de estas medidas sirve para saber si alguien dice la verdad.
- La transcripción es automática: tiene huecos, nombres mal escritos y algún turno atribuido a quien no es.
- La cara se mide con unidades de acción (AU) del sistema FACS, que nombran movimientos y no emociones, y cada
  persona se compara con su propia cara. Qué cara sale en pantalla lo decide la realización.
- En la comprobación de datos, `fuente_abierta` dice si la fuente se abrió y se leyó entera; si no, el veredicto
  se apoya solo en el extracto del buscador.
"""
CONTENIDO_ENTREVISTA = """## Qué hay

- `informe_publicable.md` es el informe; `informe.md` y sus anexos, el informe técnico.
- Transcripción y hablantes: `transcripcion.csv` (por turnos), `palabras.csv` (palabra a palabra, con su instante
  y si su voz está verificada), la salida de Whisper y la separación de voces.
- Habla y voz: `disfluencias_*.csv` (trabas), `pausas_*.csv`, `voz_*.csv` y `tonalidad_*.csv` (tono, volumen y
  velocidad de cada frase) y `retorica.csv`.
- Cara: `cara_*.csv` (unidades de acción y postura, fotograma a fotograma), `expresiones_*.csv` (gestos respecto
  a su cara de base) y `movimiento_*.csv`.
- `momentos_*.csv`: donde coinciden varias señales.
- `lectura/`: cada pregunta con su dureza y su respuesta, los temas, las afirmaciones, las promesas, el mérito
  y la culpa y la sintonía.
- `verificacion_datos.csv` y `.md`: la comprobación de datos.
- `comparativa.csv` y `grafica_*.png`: las mismas medidas para las dos personas, y sus gráficas.

`entrevistado` es el invitado y `entrevistador` o `entrevistador_1`, quien entrevista."""
CONTENIDO_COMPARACION = """## Qué hay

- `v3/`: las medidas de habla de cada entrevista con las mismas reglas, y sus preguntas.
- `lectura3/`: la lectura de preguntas y respuestas de las tres, lado a lado.
- `presion/`: la voz tras una pregunta dura frente al resto, con la misma definición para las tres.
- `publico/`: vistas, me gusta y minutos citados en los comentarios de YouTube, en recuentos.
- `coherencia/`: lo que cada uno dijo antes y lo que dice ahora, y las frases que repite.
- `general/`: la comparación general, con sus gráficas."""

# Las secciones del informe, por su número, y dónde van en la página.
SECCIONES = {
    1: "frase",
    2: "habla",
    3: "trabas",
    4: "silencios",
    5: "voz",
    6: "cara",
    7: "preguntas",
    8: "datos",
    9: "momentos",
    10: "espectador",
    11: "limites",
    12: "claves",
    13: "fuentes",
}
# La sección 7 del informe son varias de la página: cada subtítulo va a la suya.
APARTADOS = (("promesa", "promesas"), ("sinton", "sintonia"), ("tema", "temas"), ("mérito", "merito"), ("ataque", "merito"))

TEMAS = {
    "formato_y_presentacion": "Formato y presentación",
    "pactos_y_gobernabilidad": "Pactos y gobernabilidad",
    "economia_y_empleo": "Economía y empleo",
    "pensiones": "Pensiones",
    "impuestos_y_autonomos": "Impuestos y autónomos",
    "deuda_y_gasto": "Deuda y gasto",
    "vivienda": "Vivienda",
    "inmigracion": "Inmigración",
    "fronteras_y_marruecos": "Fronteras y Marruecos",
    "cataluna_y_territorial": "Cataluña y modelo territorial",
    "corrupcion": "Corrupción",
    "asuntos_personales": "Asuntos personales",
    "partido_interno": "Partido interno",
    "politica_internacional": "Política internacional",
    "defensa_y_seguridad": "Defensa y seguridad",
    "sanidad_educacion_servicios": "Sanidad, educación y servicios",
    "feminismo_e_igualdad": "Feminismo e igualdad",
    "medios_y_redes": "Medios y redes",
    "juventud": "Juventud",
    "clima_y_energia": "Clima y energía",
    "rivales": "Rivales",
    "trayectoria_y_gestion_pasada": "Trayectoria y gestión pasada",
    "infraestructuras_y_transporte": "Infraestructuras y transporte",
    "cierre_y_alegato": "Cierre y alegato",
    "otros": "Otros",
}
# Los gestos que cuenta el análisis de la cara, con su unidad de acción FACS. Nunca una emoción.
GESTOS = {
    "sonrisa (comisuras arriba + mejillas)": ("AU6 + AU12", "mejillas y comisuras arriba"),
    "ojos más abiertos": ("AU5", "párpado superior arriba"),
    "ceño (cejas bajan y se juntan)": ("AU4", "cejas bajan y se juntan"),
    "cejas arriba": ("AU1 + AU2", "cejas arriba"),
    "mentón arriba": ("AU17", "mentón arriba"),
    "comisuras hacia abajo": ("AU15", "comisuras abajo"),
    "labios apretados": ("AU23", "labios apretados"),
}


def _filas(ruta: Path) -> list[dict[str, str]]:
    with ruta.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _json(ruta: Path):
    return json.loads(ruta.read_text(encoding="utf-8"))


def _num(texto: str) -> float:
    """El primer número de una celda: «164.7 / 162.6» → 164.7; «+0.14» → 0.14."""
    hallado = re.search(r"[-+−]?\d+(?:[.,]\d+)?", texto)
    if not hallado:
        raise ValueError(f"sin número: {texto!r}")
    return float(hallado.group().replace("−", "-").replace(",", "."))


def _segundo(marca: str) -> int:
    """«73:05» → 4385: los minutos del vídeo pueden pasar de 59."""
    minutos, segundos = marca.split(":")
    return int(minutos) * 60 + int(segundos)


# --- El informe -----------------------------------------------------------------------------------------------------


def _limpia(texto: str, titulos: dict[int, tuple[str, str]]) -> str:
    """Quita lo que solo vale en el documento original: las remisiones a fotogramas y los nombres de archivo."""
    texto = re.sub(r"\s*\(Fotogramas? en la sección \d+\.\)", "", texto)
    texto = re.sub(r"\s*Fotogramas? en la sección \d+\.", "", texto)
    texto = re.sub(r"; el fotograma es de unos segundos después", "", texto)
    texto = re.sub(r"\s*El detalle de las \d+ filas está en `[^`]+`\.", "", texto)
    texto = re.sub(r"<(https?://[^>]+)>", r"[\1](\1)", texto)

    def remision(m: re.Match[str]) -> str:
        destino = titulos.get(int(m.group(1)))
        return f"[sección «{destino[1]}»](#{destino[0]})" if destino else m.group(0)

    return re.sub(r"sección (\d+)", remision, texto).strip()


def _bloques(lineas: list[str]) -> list[dict]:
    """Markdown a bloques: párrafos, subtítulos, listas y tablas. Las imágenes y sus pies no se publican."""
    bloques: list[dict] = []
    i = 0
    while i < len(lineas):
        linea = lineas[i].rstrip()
        if not linea.strip():
            i += 1
        elif linea.startswith("!["):
            i += 1
            # El pie de la imagen: la línea en cursiva que la sigue.
            while i < len(lineas) and not lineas[i].strip():
                i += 1
            if i < len(lineas) and re.fullmatch(r"\*[^*].*\*", lineas[i].strip()):
                i += 1
        elif linea.startswith("### "):
            bloques.append({"tipo": "subtitulo", "texto": linea[4:].strip()})
            i += 1
        elif linea.startswith("|"):
            filas = []
            while i < len(lineas) and lineas[i].startswith("|"):
                filas.append([celda.strip() for celda in lineas[i].strip().strip("|").split("|")])
                i += 1
            bloques.append({"tipo": "tabla", "cabecera": filas[0], "filas": filas[2:]})
        elif re.match(r"(-|\d+\.) ", linea):
            ordenada = linea[0].isdigit()
            items = []
            while i < len(lineas) and re.match(r"(-|\d+\.) ", lineas[i]):
                items.append(re.sub(r"^(-|\d+\.) ", "", lineas[i]).strip())
                i += 1
                while i < len(lineas) and lineas[i].startswith("  ") and lineas[i].strip():
                    items[-1] += " " + lineas[i].strip()
                    i += 1
            bloques.append({"tipo": "lista", "ordenada": ordenada, "items": items})
        else:
            parrafo = []
            while i < len(lineas) and lineas[i].strip() and not re.match(r"(#|\||!\[|- |\d+\. )", lineas[i]):
                parrafo.append(lineas[i].strip())
                i += 1
            bloques.append({"tipo": "parrafo", "texto": " ".join(parrafo)})
    return bloques


def _apartado(subtitulo: str) -> str:
    bajo = subtitulo.lower()
    return next((destino for clave, destino in APARTADOS if clave in bajo), "preguntas")


def leer_informe(texto: str) -> dict:
    lineas = texto.splitlines()
    titular = re.sub(r"\*([^*]+)\*", r"\1", lineas[0].removeprefix("# ").strip())
    cortes = [(i, re.match(r"## (\d+)\. (.+)", linea)) for i, linea in enumerate(lineas)]
    cortes = [(i, m) for i, m in cortes if m]
    titulos = {int(m.group(1)): (SECCIONES[int(m.group(1))], m.group(2).strip()) for _, m in cortes}

    def limpios(tramo: list[str]) -> list[dict]:
        bloques = _bloques(tramo)
        for b in bloques:
            if "texto" in b:
                b["texto"] = _limpia(b["texto"], titulos)
            if "items" in b:
                b["items"] = [_limpia(x, titulos) for x in b["items"]]
            if b["tipo"] == "tabla":
                b["cabecera"] = [_limpia(c, titulos) for c in b["cabecera"]]
                b["filas"] = [[_limpia(c, titulos) for c in fila] for fila in b["filas"]]
        # Los minutos por tema ya los dibuja la página, tramo a tramo: su tabla no se repite.
        return [b for b in bloques if b.get("texto", "x") and b.get("cabecera", [])[:2] != ["Tema", "Minutos"]]

    # Antes de la primera sección: la línea de créditos (en cursiva) y la entrada.
    entrada = [b["texto"] for b in limpios(lineas[1 : cortes[0][0]]) if not b["texto"].startswith("*Análisis")]
    secciones: dict[str, list[dict]] = {}
    for n, (i, m) in enumerate(cortes):
        fin = cortes[n + 1][0] if n + 1 < len(cortes) else len(lineas)
        clave = SECCIONES[int(m.group(1))]
        bloques = limpios(lineas[i + 1 : fin])
        if clave != "preguntas":
            secciones[clave] = bloques
            continue
        # Las preguntas, los temas, el mérito y la culpa, las promesas y la sintonía: cada cual a su sección.
        actual = "preguntas"
        for b in bloques:
            if b["tipo"] == "subtitulo":
                actual = _apartado(b["texto"])
            secciones.setdefault(actual, []).append(b)

    frase = " ".join(b["texto"] for b in secciones.pop("frase", []) if b["tipo"] == "parrafo") or None
    claves = [item for b in secciones.pop("claves") if b["tipo"] == "lista" for item in b["items"]]
    limites = [item for b in secciones.pop("limites") if b["tipo"] == "lista" for item in b["items"]]
    # De las fuentes, las referencias académicas: el vídeo ya está enlazado y los archivos no se publican.
    referencias = [item for b in secciones.pop("fuentes") if b["tipo"] == "lista" for item in b["items"]]
    for clave, bloques in secciones.items():
        # Un subtítulo que solo repite el título de su sección sobra.
        if bloques and bloques[0]["tipo"] == "subtitulo" and sum(b["tipo"] == "subtitulo" for b in bloques) == 1:
            secciones[clave] = bloques[1:]
    return {
        "titular": titular,
        "entrada": entrada,
        "frase": frase,
        "claves": claves,
        "limites": limites,
        "referencias": referencias,
        "secciones": secciones,
    }


def momentos_del_informe(bloques: list[dict]) -> list[dict]:
    """Los momentos clave que destaca el informe: «**30:04 — Zapatero.**» o «**Jordi, 22:59 — La pregunta.**»."""
    momentos = []
    for b in bloques:
        m = b["tipo"] == "parrafo" and re.match(
            r"\*\*(Jordi, )?(\d{1,3}:\d{2})(?:[–-]\d{1,3}:\d{2})?\s*(?:—|,)\s*(.+?)\.?\*\*", b["texto"]
        )
        if m:
            titulo = m.group(3).strip()
            momentos.append(
                {
                    "segundo": _segundo(m.group(2)),
                    "quien": "jordi" if m.group(1) else "invitado",
                    "titulo": titulo[0].upper() + titulo[1:],
                    # La primera cita del párrafo: lo que se oye en ese minuto, sin las medidas de voz y cara.
                    "cita": cita.group(1) if (cita := re.search(r"«(.+?)»", b["texto"][m.end() :])) else None,
                }
            )
    return momentos


# --- Las medidas ----------------------------------------------------------------------------------------------------


def _medidas(carpeta: Path) -> dict[tuple[str, str], tuple[str, str]]:
    return {(f["bloque"], f["medida"]): (f["entrevistado"], f["entrevistador"]) for f in _filas(carpeta / "comparativa.csv")}


def habla(carpeta: Path) -> dict:
    m = _medidas(carpeta)
    trabas = {f["sujeto"]: f for f in _filas(carpeta / "disfluencias_resumen.csv") if f["tramo"] == "entrevista"}

    def de(i: int, sujeto: str) -> dict:
        return {
            "palabras": int(_num(m["habla", "palabras verificadas"][i])),
            "parte": _num(m["habla", "% de las palabras verificadas de ambos"][i]),
            "minutos": _num(m["habla", "tiempo de habla verificado (min)"][i]),
            "palabrasPorMinuto": _num(m["voz", "velocidad (palabras/min)"][i]),
            "trabasPor100": _num(trabas[sujeto]["disfluencias_por_100_palabras"]),
            "pausasPor1000": _num(m["pausas", "pausas por 1000 palabras"][i]),
            "pantalla": _num(m["cara", "% de fotogramas muestreados con su cara"][i]),
        }

    return {"invitado": de(0, "entrevistado"), "jordi": de(1, "entrevistador")}


def voz_por_minuto(carpeta: Path, fin: int) -> list[float | None]:
    """La intensidad vocal del invitado, minuto a minuto: la media del índice de sus frases (0 = su propia media)."""
    minutos: dict[int, list[float]] = {}
    for f in _filas(carpeta / "tonalidad_entrevistado.csv"):
        if f["z_indice"]:
            minutos.setdefault(int(float(f["inicio"]) // 60), []).append(float(f["z_indice"]))
    return [round(sum(v) / len(v), 2) if (v := minutos.get(i)) else None for i in range(fin // 60 + 1)]


def presion(raiz: Path, columna: str) -> dict:
    filas = {f["medida"]: f[columna] for f in _filas(raiz / "comparacion" / "presion" / "presion.csv")}

    def par(nombre: str) -> tuple[float, float]:
        duras, resto = filas[f"{nombre}: duras / resto"].split("/")
        return _num(duras), _num(resto)

    medidas = []
    for clave, nombre, unidad in (
        ("tono (Hz)", "Tono", "Hz"),
        ("volumen (dB)", "Volumen", "dB"),
        ("velocidad (palabras/min)", "Velocidad", "palabras/min"),
    ):
        duras, resto = par(clave)
        medidas.append({"nombre": nombre, "unidad": unidad, "duras": duras, "resto": resto, "d": _num(filas[f"{clave}: d de Cohen"])})
    trabas = par("trabas por 100 palabras")
    return {
        "medidas": medidas,
        "trabasPor100": {"duras": trabas[0], "resto": trabas[1]},
    }


def cara(carpeta: Path) -> list[dict]:
    por_gesto: dict[str, dict] = {}
    for f in _filas(carpeta / "expresiones_resumen.csv"):
        au, nombre = GESTOS[f["gesto"]]
        quien = "invitado" if f["sujeto"] == "entrevistado" else "jordi"
        # Episodios por cada 10 minutos con su cara en pantalla.
        por_gesto.setdefault(f["gesto"], {"au": au, "nombre": nombre})[quien] = _num(f["por_10_min_en_pantalla"])
    gestos = [por_gesto[g] for g in GESTOS if g in por_gesto]
    # Solo los que alguien hace: una fila de ceros no dice nada.
    return [g for g in gestos if g["invitado"] or g["jordi"]]


def publico(raiz: Path, nombre: str) -> dict | None:
    """La lectura de YouTube de la tarde: cifras del vídeo y los minutos que más citan los comentarios."""
    carpeta = raiz / "comparacion" / "publico"
    fila = next((f for f in _filas(carpeta / "publico_2.csv") if f["entrevista"] == nombre), None)
    if not fila:
        return None
    texto = (carpeta / "publico_2.md").read_text(encoding="utf-8")
    seccion = re.search(rf"## {nombre}\n(.+?)(?=\n## |\Z)", texto, re.S)
    citados = []
    if seccion and (linea := re.search(r"Minutos más citados: (.+)", seccion.group(1))):
        for m in re.finditer(r"(\d{1,3}):00 \((\d+)\)", linea.group(1)):
            citados.append({"segundo": int(m.group(1)) * 60, "veces": int(m.group(2))})
    dia, hora = fila["lectura_2"].split("_")
    return {
        "lectura": f"{dia[:4]}-{dia[4:6]}-{dia[6:]}T{hora[:2]}:{hora[2:]}",
        "vistas": int(fila["vistas_2"]),
        "meGusta": int(fila["me_gusta_2"]),
        "comentarios": int(fila["comentarios_leidos"]),
        "conMinuto": int(fila["comentarios_con_minuto"]),
        "citados": citados,
    }


def analisis(raiz: Path, slug: str) -> dict:
    carpeta = raiz / slug
    hablantes = _json(carpeta / "hablantes.json")
    inicio, fin = int(hablantes["inicio_entrevista_s"]), int(hablantes["fin_entrevista_s"])
    lectura = carpeta / "lectura"
    informe = leer_informe((carpeta / "informe_publicable.md").read_text(encoding="utf-8"))

    preguntas = [
        {
            # El número de la pregunta en la lectura: lo usan las preguntas comunes de la ronda
            "id": f"c{p['n']}",
            "segundo": int(p["segundo"]),
            "tema": TEMAS[p["tema"]],
            "texto": p["pregunta"],
            "dureza": p["dureza"],
            "respuesta": p["respuesta"],
            # Si la respuesta propone algo propio, critica a otros, las dos cosas o ninguna
            "orientacion": p["orientacion"],
            "aQuienCritica": p["a_quien_critica"],
            # Quién cierra el intercambio: el invitado o el entrevistador, con un corte o un comentario suyo
            "cierra": p["cierra"],
        }
        for p in _json(lectura / "preguntas.json")
    ]
    temas = [
        {"inicio": int(t["inicio_s"]), "fin": int(t["fin_s"]), "tema": TEMAS[t["tema"]], "quien": t["quien_lo_saca"]}
        for t in _json(lectura / "temas.json")
    ]
    promesas = _json(lectura / "promesas.json")
    sintonia = [{"tipo": x["tipo"], "quien": x["quien_inicia"]} for x in _json(lectura / "sintonia.json")]
    trabas = [
        {"segundo": int(float(f["segundo"])), "tipo": f["tipo"], "contexto": f["contexto"]}
        for f in _filas(carpeta / "disfluencias_eventos.csv")
        if f["sujeto"] == "entrevistado" and f["tramo"] == "entrevista"
    ]
    # Un hueco de más de 5 s es un tramo sin transcribir, no una pausa (lo explica el informe).
    pausas = [
        {"segundo": int(float(f["segundo"])), "duracion": float(f["duracion_s"]), "carga": f["marca_carga"] == "True"}
        for f in _filas(carpeta / "pausas_entrevistado.csv")
        if float(f["duracion_s"]) <= 5
    ]
    corto = hablantes["ficha"]["invitado"].split()[-1]
    return {
        "id": f"{RONDA}-{slug}",
        "inicio": inicio,
        "fin": fin,
        **{k: informe[k] for k in ("titular", "entrada", "frase", "claves", "limites", "referencias", "secciones")},
        "habla": habla(carpeta),
        "preguntas": preguntas,
        "temas": temas,
        "promesas": {"total": len(promesas), "verificables": sum(bool(x["verificable"]) for x in promesas)},
        "compromisos": [
            {
                "segundo": int(x["segundo"]),
                "cita": x["cita"],
                "compromiso": x["compromiso"],
                "verificable": bool(x["verificable"]),
                "plazo": x["plazo"],
                "condicion": x["condicion"],
            }
            for x in promesas
        ],
        "sintonia": sintonia,
        "trabas": trabas,
        "pausas": pausas,
        "voz": voz_por_minuto(carpeta, fin),
        "presion": presion(raiz, corto),
        "cara": cara(carpeta),
        "momentos": momentos_del_informe(informe["secciones"].get("momentos", [])),
        "publico": publico(raiz, corto),
    }


def _sin_emociones(ruta: Path) -> bytes:
    """`tonalidad_*.csv` sin las columnas del clasificador de emoción en la voz (`e2v_*`)."""
    filas = _filas(ruta)
    columnas = [c for c in filas[0] if not c.startswith("e2v_")]
    salida = io.StringIO(newline="")
    escritor = csv.DictWriter(salida, columnas, extrasaction="ignore", lineterminator="\n")
    escritor.writeheader()
    escritor.writerows(filas)
    return salida.getvalue().encode("utf-8")


def empaquetar(carpeta: Path, patrones: tuple[str, ...], nombre: str, leeme: str) -> dict:
    """El zip de lo publicable de una carpeta. Siempre igual byte a byte, para que Git solo vea cambios reales."""
    archivos = {"LEEME.md": leeme.encode("utf-8")}
    for patron in patrones:
        for ruta in sorted(carpeta.glob(patron)):
            if ruta.is_file() and ruta.name not in SIN_PUBLICAR:
                relativa = ruta.relative_to(carpeta).as_posix()
                archivos[relativa] = _sin_emociones(ruta) if ruta.name.startswith("tonalidad_") else ruta.read_bytes()
    PAQUETES.mkdir(parents=True, exist_ok=True)
    destino = PAQUETES / f"{nombre}.zip"
    with zipfile.ZipFile(destino, "w") as z:
        for relativa in sorted(archivos):
            info = zipfile.ZipInfo(f"{nombre}/{relativa}", date_time=(2026, 11, 13, 0, 0, 0))
            info.external_attr = 0o644 << 16
            z.writestr(info, archivos[relativa], zipfile.ZIP_DEFLATED, 9)
    return {"archivo": destino.name, "bytes": destino.stat().st_size, "archivos": len(archivos)}


def resumen(a: dict) -> str:
    """Las cifras que deben cuadrar con el titular del informe, para comprobarlas a ojo al convertir."""
    duras = [p for p in a["preguntas"] if p["dureza"] in ("incomoda", "repregunta", "insistencia")]
    return (
        f"{a['id']}: {len(a['preguntas'])} preguntas, {len(duras)} duras, "
        f"{sum(p['respuesta'] == 'responde' for p in duras)} respondidas; "
        f"{a['habla']['invitado']['parte']} % de las palabras; {len(a['trabas'])} trabas, {len(a['pausas'])} pausas; "
        f"{a['promesas']['verificables']} de {a['promesas']['total']} promesas; {len(a['momentos'])} momentos; "
        f"secciones: {', '.join(f'{k} ({len(v)})' for k, v in a['secciones'].items())}; "
        f"respuestas: {dict(Counter(p['respuesta'] for p in a['preguntas']))}"
    )


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    raiz = Path(argv[0])
    slugs = argv[1:] or sorted(p.parent.name for p in raiz.glob("*/informe_publicable.md") if not p.parent.is_symlink())
    DATOS_WEB.mkdir(parents=True, exist_ok=True)
    comparacion = empaquetar(
        raiz / "comparacion",
        DE_LA_COMPARACION,
        f"{RONDA}-comparacion",
        LEEME.format(titulo="La comparación entre las entrevistas", contenido=CONTENIDO_COMPARACION),
    )
    for slug in slugs:
        a = analisis(raiz, slug)
        nombre = _json(raiz / slug / "hablantes.json")["ficha"]["invitado"]
        leeme = LEEME.format(titulo=f"{nombre} en The Wild Project", contenido=CONTENIDO_ENTREVISTA)
        # Lo que se puede descargar: lo de esta entrevista y la comparación de la ronda.
        a["datos"] = [
            {"nombre": "Los datos de esta entrevista", **empaquetar(raiz / slug, DE_LA_ENTREVISTA, a["id"], leeme)},
            {"nombre": "La comparación entre las entrevistas", **comparacion},
        ]
        ruta = DATOS_WEB / f"{a['id']}.json"
        ruta.write_text(json.dumps(a, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(resumen(a))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
