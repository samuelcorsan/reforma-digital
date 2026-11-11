"""
Uso, desde apps/ingestion (ver README.md de esta carpeta):
  python -m entrevistas analizar <url> --candidato pedro-sanchez   # analiza, verifica, revisa y publica en la web
  python -m entrevistas revisar 13n-pedro-sanchez                  # repite la segunda revisión de lo pendiente
  python -m entrevistas simular                                    # prueba completa sin clave ni coste
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import subprocess
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor
import time
from pathlib import Path

from .esquema import Analisis, Extraccion, FichaEntrevista, SegundaRevision, Transcripcion
from .modelo import ClienteGemini, ClienteSimulado
from . import audio, proceso, sincronia

RAIZ = Path(__file__).resolve().parents[3]
# Lo que publica la web: un JSON por entrevista y el índice que los da de alta (index.ts, generado)
DATOS_WEB = RAIZ / "apps" / "web" / "lib" / "elecciones" / "entrevistas"
# Audio, vídeo, trozos, costes y ensayos: nunca en Git (.cache/ está en .gitignore)
BRUTOS = RAIZ / "apps" / "ingestion" / ".cache" / "entrevistas"

CANDIDATOS = {
    "ada-colau": "Ada Colau",
    "santiago-abascal": "Santiago Abascal",
    "pedro-sanchez": "Pedro Sánchez",
    "alberto-nunez-feijoo": "Alberto Núñez Feijóo",
}

# The Wild Project: la jornada del 13N. Allí hay verificadores en plató y el prompt lo sabe
WILD = "The Wild Project"


def _identificador(nombre: str) -> str:
    """Un nombre de variable de TypeScript para cada JSON: 13n-pedro-sanchez → entrevista13nPedroSanchez."""
    partes = nombre.split("-")
    base = partes[0] + "".join(p.capitalize() for p in partes[1:])
    return base if base[0].isalpha() else "entrevista" + base[0].upper() + base[1:]


def _lista(declaracion: str, apertura: str, elementos: list[str], cierre: str) -> str:
    """Como lo escribe Prettier (100 columnas): en una línea si cabe; si no, un elemento por línea."""
    linea = f"{declaracion}{apertura}{', '.join(elementos)}{cierre};"
    if len(linea) <= 100:
        return linea
    cuerpo = "".join(f"  {e},\n" for e in elementos)
    return f"{declaracion}{apertura.strip()}\n{cuerpo}{cierre.strip()};"


def registrar() -> Path:
    """Da de alta en la web todos los JSON publicados de DATOS_WEB, escribiendo su index.ts. Nunca los ensayos."""
    entrevistas, comunes = [], {}
    for ruta in sorted(DATOS_WEB.glob("*.json")):
        if ruta.stem.startswith("ensayo"):
            continue
        if ruta.stem.startswith("comunes-"):
            comunes[ruta.stem.removeprefix("comunes-")] = ruta
        else:
            entrevistas.append(ruta)
    importaciones = [f"import {_identificador(r.stem)} from './{r.name}';" for r in [*comunes.values(), *entrevistas]]
    texto = "\n".join(
        [
            "// Generado por `python -m entrevistas` (apps/ingestion/entrevistas): no lo edites a mano.",
            "// Cada JSON de esta carpeta es una entrevista publicada; comunes-<ronda>.json, sus preguntas comunes.",
            *sorted(importaciones),
            "",
            _lista("export const files: unknown[] = ", "[", [_identificador(r.stem) for r in entrevistas], "]"),
            _lista(
                "export const commonFiles: Record<string, unknown> = ",
                "{ " if comunes else "{",
                [f"'{k}': {_identificador(r.stem)}" for k, r in comunes.items()],
                " }" if comunes else "}",
            ),
            "",
        ]
    )
    indice = DATOS_WEB / "index.ts"
    indice.write_text(texto, encoding="utf-8")
    return indice


def slug_de(nombre: str) -> str:
    base = unicodedata.normalize("NFD", nombre.lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", base).strip("-")


def cmd_analizar(args):
    if args.ensayo:
        # Ensayo con otra entrevista: todo se queda en .cache (fuera del repo), nunca en la web
        nombre = args.ensayo
        slug = "ensayo-" + slug_de(args.ensayo) + (f"-{slug_de(args.etiqueta)}" if args.etiqueta else "")
    elif args.candidato in CANDIDATOS:
        nombre, slug = CANDIDATOS[args.candidato], args.candidato
    else:
        sys.exit(f"Usa --candidato ({', '.join(CANDIDATOS)}) o --ensayo \"Nombre\".")
    jornada = "" if args.ensayo else args.jornada
    ident = slug if args.ensayo else f"{jornada}-{slug}"
    carpeta = BRUTOS / ident  # audio, vídeo y costes de esta entrevista (fuera del repo)
    wild = (args.medio or WILD) == WILD
    ficha = FichaEntrevista(
        entrevistador=args.entrevistador or ("Jordi Wild" if wild and not args.ensayo else ""),
        medio=args.medio or ("" if args.ensayo else WILD),
        programa=args.programa or "",
        url=args.url,
    )
    salida = Path(args.salida) if args.salida else (
        carpeta / "analisis.json" if args.ensayo else DATOS_WEB / f"{ident}.json"
    )
    if args.ensayo and salida.resolve().parent == DATOS_WEB.resolve():
        sys.exit("Un ensayo no escribe en la carpeta de la web: nunca se publica.")
    inicio = time.time()
    cliente = ClienteGemini(args.modelo or os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"))
    # En The Wild Project, el prompt de Jordi (con verificadores); en otra entrevista, quien la conduzca
    cliente.entrevistador = None if wild and not args.ensayo else ficha.entrevistador

    hasta = args.hasta * 60 if args.hasta else None
    modo = "video" if args.video else args.modo
    video = None
    silencios: list[list[float]] = []
    trozos_audio: list[audio.Trozo] = []
    if modo in ("audio", "ambos"):
        t0 = time.time()
        try:
            video = audio.descargar(args.url, carpeta)
        except Exception as e:  # YouTube bloquea a veces la descarga: el vídeo sirve de plan B
            if modo == "audio":
                raise
            logging.warning("No se pudo descargar el audio (%s): sigo solo con el vídeo", e)
            modo = "video"
        else:
            logging.info("Descarga en %.0f s (%d min de vídeo)", time.time() - t0, video.duracion / 60)
            t0 = time.time()
            trozos_audio = audio.trocear(video.audio, args.minutos, hasta)
            logging.info("Troceado en %.0f s: %d trozos de %d min", time.time() - t0, len(trozos_audio), args.minutos)
            silencios = audio.silencios(video.audio, hasta)
            logging.info("%d silencios detectados en el audio", len(silencios))
    trozos_video: list[audio.Trozo] = []
    if modo in ("video", "ambos"):
        if audio.es_youtube(args.url):
            # Gemini lee el vídeo directamente de YouTube por tramos: no se descarga nada
            video = video or audio.video_sin_descarga(args.url)
            trozos_video = audio.trozos_video(args.url, min(video.duracion, hasta or video.duracion), args.minutos)
            logging.info("Vídeo: %d tramos de %d min leídos desde YouTube", len(trozos_video), args.minutos)
        else:
            # Fuera de YouTube (RTVE Play…) Gemini no lee la URL: se baja el vídeo y se sube en tramos ligeros
            video = video or audio.descargar(args.url, carpeta)
            t0 = time.time()
            imagen = audio.descargar_video(args.url, carpeta)
            trozos_video = audio.trocear_video(imagen, video.audio, min(video.duracion, hasta or video.duracion), args.minutos)
            logging.info("Vídeo: %d tramos de %d min preparados en %.0f s", len(trozos_video), args.minutos, time.time() - t0)
    if hasta:
        logging.info("Ensayo limitado a los primeros %d min", args.hasta)

    # Con los dos, audio y vídeo se transcriben a la vez: el audio da la transcripción oficial (tiempos más
    # precisos) y el vídeo, una segunda transcripción para contrastar citas y lo que solo se ve en pantalla
    with ThreadPoolExecutor(max_workers=2) as ex:
        tarea_a = ex.submit(proceso.transcribir, cliente, trozos_audio, nombre, args.hilos, "audio") if trozos_audio else None
        tarea_v = ex.submit(proceso.transcribir, cliente, trozos_video, nombre, args.hilos, "vídeo") if trozos_video else None
        t_audio = tarea_a.result() if tarea_a else None
        t_video = tarea_v.result() if tarea_v else None
    principal = t_audio or t_video
    if t_audio and t_video:
        # La transcripción del vídeo se guarda para poder revisar el contraste a mano
        carpeta.mkdir(parents=True, exist_ok=True)
        (carpeta / "transcripcion-video.json").write_text(t_video.model_dump_json(indent=1) + "\n")
        principal = principal.model_copy(update={"segmentos": proceso.corroborar(t_audio.segmentos, t_video.segmentos)})
    a = proceso.analizar(
        cliente,
        principal.segmentos,
        slug=slug,
        candidato=nombre,
        titulo=video.titulo,
        youtube_id=video.id if audio.es_youtube(args.url) else None,
        publicado=video.publicado,
        duracion=min(video.duracion, hasta or video.duracion),
        comprobar=not args.sin_comprobar,
        segunda=not args.sin_comprobar,
        hilos=args.hilos,
        contraste=t_video.segmentos if (t_audio and t_video) else None,
        visuales=t_video.visuales if t_video else [],
    )
    a.silencios = silencios
    a.id, a.jornada, a.entrevista = ident, jornada, ficha
    salida.write_text(a.a_json() + "\n", encoding="utf-8")
    if audio.es_youtube(args.url):
        comprobar_sincronia(a, args.url, carpeta)
    if not args.ensayo:
        registrar()

    # Coste real según lo que la API dice que ha consumido (se guarda junto al audio, fuera del repo)
    coste = cliente.contador.resumen()
    coste["modo"] = modo
    coste["minutos_video"] = round(min(video.duracion, hasta or video.duracion) / 60, 1)
    coste["minutos_proceso"] = round((time.time() - inicio) / 60, 1)
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / f"coste-{coste['modo']}.json").write_text(json.dumps(coste, indent=2, ensure_ascii=False) + "\n")
    logging.info("Consumo:\n%s", cliente.contador.tabla())
    logging.info(
        "Listo en %d min: %d segmentos, %d revisiones propuestas → %s",
        (time.time() - inicio) / 60,
        len(a.segmentos),
        len(a.revisiones),
        salida,
    )
    if not args.ensayo:
        logging.info(
            "Publicada en la web: comprueba http://localhost:3000/elecciones/entrevistas/%s con `pnpm dev` y haz commit",
            ident,
        )


def comprobar_sincronia(a: Analisis, url: str, carpeta: Path) -> sincronia.Sincronia | None:
    """Avisa si los tiempos de la transcripción no cuadran con el vídeo. Deja el detalle en sincronia.json."""
    subtitulos = sincronia.descargar_subtitulos(url, carpeta)
    if not subtitulos:
        logging.warning("YouTube no da subtítulos de este vídeo: comprueba los tiempos a mano en tres puntos")
        return None
    s = sincronia.medir(a.segmentos, subtitulos)
    (carpeta / "sincronia.json").write_text(
        json.dumps(
            {"comparables": s.comparables, "dentro": s.dentro, "mediana": s.mediana, "fuera": s.fuera},
            indent=1,
            ensure_ascii=False,
        )
        + "\n"
    )
    if s.bien:
        logging.info("Tiempos: %s", s.resumen())
    else:
        logging.warning(
            "⚠ LOS TIEMPOS NO CUADRAN CON EL VÍDEO. No lo publiques sin mirarlo: %s. Repite el análisis (--modo audio).",
            s.resumen(),
        )
    for segundo, desfase, texto in sorted(s.fuera, key=lambda x: -abs(x[1]))[:5]:
        logging.warning("  En la transcripción en %s, en el vídeo en %s: «%s»", _mmss(segundo), _mmss(segundo + desfase), texto[:70])
    return s


def _mmss(segundo: float) -> str:
    m, s = divmod(int(segundo), 60)
    return f"{m // 60}:{m % 60:02d}:{s:02d}" if m >= 60 else f"{m}:{s:02d}"


def cmd_sincronia(args):
    """Comprueba los tiempos de una entrevista ya analizada (publicada o un ensayo de .cache)."""
    ruta = DATOS_WEB / f"{args.slug}.json"
    if not ruta.exists():
        ruta = BRUTOS / args.slug / "analisis.json"
    if not ruta.exists():
        sys.exit(f"No encuentro {args.slug} en {DATOS_WEB} ni en {BRUTOS}.")
    a = Analisis.model_validate_json(ruta.read_text(encoding="utf-8"))
    if not a.youtubeId:
        sys.exit("No está en YouTube: sin subtítulos con los que comparar. Compruébalo a mano en tres puntos.")
    s = comprobar_sincronia(a, f"https://www.youtube.com/watch?v={a.youtubeId}", BRUTOS / args.slug)
    if s and not s.bien:
        sys.exit(1)


def cmd_nota(args):
    ruta = DATOS_WEB / f"{args.slug}.json"
    if not ruta.exists():
        sys.exit(f"No existe {ruta.name}: usa el identificador de la entrevista (<jornada>-<candidato>).")
    a = Analisis.model_validate_json(ruta.read_text(encoding="utf-8"))
    a = proceso.recalcular(a)
    ruta.write_text(a.a_json() + "\n", encoding="utf-8")
    aprobadas = sum(r.estado == "aprobada" for r in a.revisiones)
    pendientes = sum(x.estado == "propuesta" for x in [*a.revisiones, *a.momentos])
    logging.info(
        "Nota %.1f ± %.1f con %d revisiones aprobadas (%d pendientes) → %s",
        a.nota.global_,
        a.nota.margen,
        aprobadas,
        pendientes,
        ruta,
    )


def cmd_anotar(args):
    """Nota de una comprobación a mano sobre una verificación (la usa la skill segunda-revision). No cambia el
    veredicto. El slug es una entrevista publicada (<ronda>-<candidato>) o la carpeta de un ensayo (ensayo-…)."""
    import fcntl

    if re.fullmatch(r"ensayo-[a-z0-9-]+", args.slug):
        ruta = BRUTOS / args.slug / "analisis.json"
    elif (DATOS_WEB / f"{args.slug}.json").exists():
        ruta = DATOS_WEB / f"{args.slug}.json"
    else:
        sys.exit(f"Slug desconocido: {args.slug}")
    # Varios subagentes anotan a la vez: cada uno lee y escribe el archivo entero, así que van por turnos
    with open(ruta.with_suffix(".lock"), "w") as cerrojo:
        fcntl.flock(cerrojo, fcntl.LOCK_EX)
        a = Analisis.model_validate_json(ruta.read_text(encoding="utf-8"))
        r = next((x for x in a.revisiones if x.id == args.id), None)
        if not r:
            sys.exit(f"No existe la revisión {args.id} en {args.slug}.")
        r.segundaRevision = SegundaRevision(sugerencia=args.sugerencia, fuentesOk=args.fuentes == "ok", nota=args.nota.strip())
        ruta.write_text(a.a_json() + "\n", encoding="utf-8")
    logging.info("Anotada %s/%s: %s", args.slug, args.id, args.nota[:80])


def cmd_ensayo_general(args):
    """Varias entrevistas a la vez, como el día 13: mide el tiempo total de punta a punta y el coste."""
    inicio = time.time()
    procesos = []
    for k, url in enumerate(args.urls, start=1):
        etiqueta = f"{args.etiqueta}-{k}"
        nombre = f"{args.nombre} ({etiqueta})"
        carpeta = f"ensayo-{slug_de(args.nombre)}-{slug_de(etiqueta)}"
        log = BRUTOS / f"{carpeta}.log"
        log.parent.mkdir(parents=True, exist_ok=True)
        orden = [
            sys.executable, "-m", "entrevistas", "analizar", url,
            "--ensayo", args.nombre, "--etiqueta", etiqueta, "--hilos", str(args.hilos),
        ]
        if args.hasta:
            orden += ["--hasta", str(args.hasta)]
        procesos.append(
            (nombre, carpeta, log, subprocess.Popen(orden, stdout=log.open("w"), stderr=subprocess.STDOUT, cwd=RAIZ / "apps" / "ingestion"))
        )
        logging.info("Lanzado %s → %s", nombre, log)
    for nombre, _, log, p in procesos:
        p.wait()
        logging.info("%s: %s", nombre, "OK" if p.returncode == 0 else f"ERROR (ver {log})")
    total = 0.0
    for nombre, carpeta, _, _ in procesos:
        for coste in (BRUTOS / carpeta).glob("coste-*.json"):
            c = json.loads(coste.read_text())
            total += c.get("coste_modelo_usd") or 0
            logging.info(
                "%s: %s min de vídeo en %s min · %.2f USD", nombre, c["minutos_video"], c["minutos_proceso"], c["coste_modelo_usd"] or 0
            )
    logging.info("Ensayo general: %d entrevistas en %.1f min · %.2f USD en total", len(procesos), (time.time() - inicio) / 60, total)


def de_jornada(jornada: str) -> dict[str, Analisis]:
    """Las entrevistas publicadas de una ronda, por candidato."""
    entrevistas = {}
    for ruta in sorted(DATOS_WEB.glob(f"{jornada}-*.json")):
        a = Analisis.model_validate_json(ruta.read_text(encoding="utf-8"))
        if a.jornada == jornada and a.candidato in CANDIDATOS:
            entrevistas[a.candidato] = a
    return entrevistas


def cmd_comunes(args):
    """Tras analizar las entrevistas de una ronda: agrupa las preguntas que se hicieron a más de un candidato."""
    entrevistas = de_jornada(args.jornada)
    if len(entrevistas) < 2:
        sys.exit(f"Hacen falta al menos dos entrevistas analizadas de la jornada {args.jornada}.")
    cliente = ClienteGemini(args.modelo or os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"))
    comunes = proceso.agrupar_comunes(cliente, entrevistas)
    salida = DATOS_WEB / f"comunes-{args.jornada}.json"
    salida.write_text(json.dumps(comunes, indent=2, ensure_ascii=False) + "\n")
    registrar()
    logging.info("%d preguntas comunes entre %d entrevistas → %s", len(comunes), len(entrevistas), salida)


def cmd_revisar(args):
    """Repite la segunda revisión de IA sobre lo que quedó pendiente (por ejemplo, si se cortó la conexión) y
    recalcula la nota. Lo ya aprobado o descartado no se toca."""
    ruta = DATOS_WEB / f"{args.slug}.json"
    if not ruta.exists():
        ruta = BRUTOS / args.slug / "analisis.json"
    if not ruta.exists():
        sys.exit(f"No encuentro {args.slug} en {DATOS_WEB} ni en {BRUTOS}.")
    a = Analisis.model_validate_json(ruta.read_text(encoding="utf-8"))
    cliente = ClienteGemini(args.modelo or os.environ.get("GEMINI_MODEL", "gemini-3.8-flash"))
    nombre = CANDIDATOS.get(a.candidato, a.titulo)
    revisiones = proceso.segunda_revision(cliente, a.revisiones, a.segmentos, nombre, a.publicado, args.hilos)
    a = proceso.recalcular(a.model_copy(update={"revisiones": revisiones}))
    ruta.write_text(a.a_json() + "\n", encoding="utf-8")
    if ruta.parent == DATOS_WEB:
        registrar()
    logging.info("Nota %.1f ± %.1f → %s", a.nota.global_, a.nota.margen, ruta)


def cmd_simular(args):
    """Recorre todo el pipeline con un cliente simulado sobre la entrevista de EJEMPLO (candidato ficticio)."""
    base = json.loads((DATOS_WEB / "ejemplo.json").read_text(encoding="utf-8"))
    transcripcion = Transcripcion(segmentos=base["segmentos"])
    extraccion = Extraccion(
        temas=base["temas"],
        preguntas=base["preguntas"],
        propuestas=base["propuestas"],
        ataques=base["ataques"],
        afirmaciones=[
            {"segundo": r["segundo"], "cita": r["cita"], "por_que_comprobable": "cifra", "pillado_en_directo": r.get("pilladoEnDirecto", False)}
            for r in base["revisiones"]
        ]
        + [{"segundo": 0, "cita": "Esta frase no está en la transcripción", "por_que_comprobable": "prueba"}],
        momentos=[
            {"tipo": m["tipo"], "titulo": m["titulo"], "cita": m["cita"], "por_que": m["porQue"]}
            for m in base.get("momentos", [])
        ],
        interrupciones=[
            {"quien": "candidato", "cita": "Bueno, el dato de afiliados"},
            {"quien": "jordi", "cita": "Ya, pero te pregunto por tu plan"},
        ],
    )
    cliente = ClienteSimulado(transcripcion, extraccion)
    trozo = audio.Trozo(desfase=0.0, largo=base["duracion"], audio=Path("simulado.m4a"))
    segmentos = proceso.transcribir(cliente, [trozo], "Candidato de ejemplo").segmentos
    a = proceso.analizar(
        cliente,
        segmentos,
        slug="ejemplo",
        candidato="Candidato de ejemplo",
        titulo="Simulación",
        youtube_id=None,
        publicado="2026-11-13",
        duracion=base["duracion"],
    )
    salida = Path(args.salida)
    if salida.resolve().parent == DATOS_WEB.resolve():
        sys.exit("La simulación no escribe en la carpeta de la web: usa otra ruta con --salida.")
    salida.write_text(a.a_json() + "\n", encoding="utf-8")
    logging.info("Simulación OK: %d verificaciones (1 descartada por cita no literal) → %s", len(a.revisiones), salida)


def cargar_env():
    """Lee el .env de la raíz del repositorio (GEMINI_API_KEY) sin dependencias extra. Las variables ya definidas
    tienen prioridad."""
    ruta = RAIZ / ".env"
    if not ruta.exists():
        return
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        if "=" in linea and not linea.lstrip().startswith("#"):
            k, v = linea.split("=", 1)
            if v.strip():
                os.environ.setdefault(k.strip(), v.strip())


def main():
    cargar_env()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", datefmt="%H:%M:%S")
    # Solo el progreso del pipeline: sin una línea por cada petición HTTP
    for ruidoso in ("httpx", "google_genai", "urllib3"):
        logging.getLogger(ruidoso).setLevel(logging.WARNING)
    p = argparse.ArgumentParser(prog="entrevistas", description="Análisis de las entrevistas de Reforma Digital")
    sub = p.add_subparsers(required=True)

    a = sub.add_parser("analizar", help="Analiza una entrevista de YouTube")
    a.add_argument("url")
    quien = a.add_mutually_exclusive_group(required=True)
    quien.add_argument("--candidato", help=", ".join(CANDIDATOS))
    quien.add_argument("--ensayo", metavar="NOMBRE", help="Otra entrevista para ensayar; el resultado se queda en .cache")
    a.add_argument("--etiqueta", help="Con --ensayo: distingue varios ensayos de la misma persona (carpeta propia)")
    a.add_argument("--jornada", default="13n", help="Jornada a la que pertenece (por defecto 13n)")
    a.add_argument("--entrevistador", help="Quien conduce la entrevista (por defecto, Jordi Wild en The Wild Project)")
    a.add_argument("--medio", help=f"Dónde se publica (por defecto, {WILD})")
    a.add_argument("--programa", help="Programa o sección, si lo hay")
    a.add_argument("--modelo", default=None, help="Por defecto, GEMINI_MODEL o gemini-3.8-flash")
    a.add_argument("--minutos", type=int, default=5, help="Minutos por trozo (cortos: tiempos más fiables)")
    a.add_argument(
        "--modo",
        choices=("ambos", "audio", "video"),
        default="ambos",
        help="ambos (por defecto): audio para la transcripción y vídeo para contrastar y ver lo que no se oye",
    )
    a.add_argument("--video", action="store_true", help="Atajo de --modo video (sin descargar nada)")
    a.add_argument("--hasta", type=int, metavar="MIN", help="Solo los primeros MIN minutos (ensayos)")
    a.add_argument("--sin-comprobar", action="store_true", help="Sin verificar ni revisar (más rápido, para ensayos)")
    a.add_argument("--hilos", type=int, default=8, help="Llamadas a la vez al transcribir y al verificar")
    a.add_argument("--salida", help="Ruta del JSON (por defecto, la carpeta de la web: <ronda>-<candidato>.json)")
    a.set_defaults(f=cmd_analizar)

    n = sub.add_parser("nota", help="Recalcula nota y estadísticas con las verificaciones aprobadas")
    n.add_argument("slug")
    n.set_defaults(f=cmd_nota)

    r = sub.add_parser("revisar", help="Repite la segunda revisión de IA de lo pendiente y recalcula la nota")
    r.add_argument("slug", help="<ronda>-<candidato> o la carpeta de un ensayo (ensayo-…)")
    r.add_argument("--modelo", default=None)
    r.add_argument("--hilos", type=int, default=8)
    r.set_defaults(f=cmd_revisar)

    an = sub.add_parser("anotar", help="Nota de una comprobación a mano (skill segunda-revision)")
    an.add_argument("slug", help="Candidato, o carpeta de un ensayo (ensayo-…) para probar la skill")
    an.add_argument("id")
    an.add_argument("--sugerencia", choices=("legal", "amarilla", "fuera", "roja"), default=None)
    an.add_argument("--fuentes", choices=("ok", "mal"), required=True, help="¿Las fuentes dicen lo que se afirma?")
    an.add_argument("--nota", required=True)
    an.set_defaults(f=cmd_anotar)

    eg = sub.add_parser("ensayo-general", help="Varias entrevistas a la vez, como el día 13 (sin publicar nada)")
    eg.add_argument("urls", nargs="+")
    eg.add_argument("--nombre", default="Ensayo general", help="Nombre de la persona entrevistada (va en los prompts)")
    eg.add_argument("--etiqueta", default="parte", help="Prefijo de cada ensayo: parte-1, parte-2…")
    eg.add_argument("--hasta", type=int, metavar="MIN")
    eg.add_argument("--hilos", type=int, default=4)
    eg.set_defaults(f=cmd_ensayo_general)

    c = sub.add_parser("comunes", help="Agrupa las preguntas comunes de las entrevistas ya analizadas")
    c.add_argument("--modelo", default=None)
    c.add_argument("--jornada", required=True)
    c.set_defaults(f=cmd_comunes)

    si = sub.add_parser("sincronia", help="Comprueba que los tiempos de la transcripción cuadran con el vídeo")
    si.add_argument("slug", help="<jornada>-<candidato> o la carpeta de un ensayo (ensayo-…)")
    si.set_defaults(f=cmd_sincronia)

    s = sub.add_parser("simular", help="Prueba completa sin clave de API, con datos ficticios")
    s.add_argument("--salida", default="/tmp/entrevistas-simulacion.json")
    s.set_defaults(f=cmd_simular)

    args = p.parse_args()
    args.f(args)


if __name__ == "__main__":
    main()
