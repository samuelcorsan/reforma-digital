"""Línea de órdenes.

    python -m escano actualizar                 # últimos 10 días de votaciones + Diarios nuevos + web
    python -m escano actualizar --desde 2026-09-01 --sin-ia
    python -m escano diario PL 205              # (re)procesa un Diario concreto
    python -m escano construir                  # solo regenera la web con lo ya descargado
    python -m escano reprocesar                 # rehace sesiones y votaciones desde los ficheros descargados, sin red
    python -m escano calidad                    # indicadores del parser por sesión
    python -m escano agenda                     # solo el orden del día de los próximos plenos
    python -m escano preguntas [--completo]     # preguntas escritas al Gobierno (la primera vez, --completo)
    python -m escano explora [--solo temas]     # unifica temas, lugares y propuestas para la pestaña Explora
    python -m escano estado [--desde 2018-06-01] # solo los nombramientos y ceses del BOE (organigrama del Estado)
    python -m escano candidaturas               # listas al Congreso del BOE y quién de los diputados repite (29N)
    python -m escano promesas [--solo PP]       # promesas de los programas de 2023 frente a lo que se votó (NaN)
"""
from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor
from datetime import date, timedelta

import json

from . import agenda, bienes, boe, calidad, diario, diputados, hemiciclo, intereses, leyes, llamamiento, organos, preguntas, votaciones
from .config import CRUDOS, SITIO, VOTACIONES
from .construir import construir


def _fechas(desde: date, hasta: date):
    d = desde
    while d <= hasta:
        if d.weekday() < 5:  # el Pleno se reúne de martes a jueves; las comisiones, de lunes a viernes
            yield d
        d += timedelta(days=1)


def actualizar(desde: date, hasta: date, con_ia: bool) -> None:
    print(f"· Votaciones del {desde} al {hasta}")
    for d in _fechas(desde, hasta):
        n = len(votaciones.actualizar_dia(d))
        if n:
            print(f"  {d}: {n} votaciones")

    print(f"· Diputados en activo: {len(diputados.actualizar())}")
    print(f"· Plano del hemiciclo: {len(hemiciclo.actualizar()['escanos'])} escaños")
    print(f"· Comisiones: {len(organos.actualizar())}")
    print(f"· Iniciativas legislativas: {len(leyes.actualizar()['iniciativas'])}")
    print(f"· Declaraciones de intereses: {len(intereses.actualizar())} diputados")
    print(f"· Declaraciones de bienes (BOCG): {len(bienes.actualizar()['declaraciones'])} diputados")
    pr = preguntas.actualizar()["preguntas"]
    print(f"· Preguntas escritas: {len(pr)}, {sum(p['estado'] == 'pendiente' for p in pr)} sin contestar")
    ag = agenda.actualizar()
    print(f"· Agenda: {len(ag['plenos'])} plenos convocados, {len(ag['comisiones'])} sesiones de comisión")
    try:  # el BOE es otra fuente: si falla, el resto de la actualización sigue
        boe.actualizar(avisar=lambda t: print("  " + t.strip()))
    except Exception as e:
        print(f"· BOE: no se ha podido actualizar ({e})")
    _candidaturas_si_toca()

    mapa = votaciones.mapa_diputados()
    estado = diario.leer_estado()
    for serie in ("PL", "CO"):
        print(f"· Diarios de la serie {serie} desde el nº {estado[serie] + 1}")
        for numero, ruta in diario.nuevos_diarios(serie, estado[serie] + 1):
            ses = diario.procesar_diario(ruta, serie, numero, mapa)
            print(f"  {ses['id']}: {ses['fecha']} · {ses['organo']} · {len(ses['intervenciones'])} turnos")
            estado[serie] = max(estado[serie], numero)
    diario.guardar_estado(estado)
    # Las votaciones por llamamiento no están en los datos abiertos: salen del Diario de Sesiones.
    for v in llamamiento.actualizar():
        print(f"  Votación por llamamiento {v['id']} ({v['fecha']}): {v['si']} a favor, {v['no']} en contra")

    if con_ia:
        print("· Pestaña Explora: temas, lugares y propuestas nuevos")
        from . import normalizar
        normalizar.ejecutar()

    print("· Construyendo la web" + (" (sin IA)" if not con_ia else ""))
    datos = construir(con_ia=con_ia)
    print(f"  {len(datos['datos']['sesiones'])} sesiones, {len(datos['intervenciones'])} intervenciones analizadas, "
          f"{len(datos['datos']['votaciones'])} votaciones")


def _candidaturas_si_toca(hoy: date | None = None) -> None:
    """Entre la publicación de las listas (día 22 tras la convocatoria) y el final de los recursos, cada día."""
    from . import candidaturas, elecciones
    hoy = hoy or date.today()
    desde, hasta = elecciones.CONVOCATORIA + timedelta(days=21), elecciones.CONVOCATORIA + timedelta(days=45)
    if not (desde <= hoy <= hasta):
        return
    try:
        dips = json.loads((SITIO / "datos" / "indice.json").read_text())["diputados"]
        c = candidaturas.actualizar(desde, hoy, dips)
        if c:
            print(f"· Candidaturas {c['fase']}: {sum(len(v) for v in c['listas'].values())} listas; "
                  f"{len(c['repite'])} diputados vuelven a ir en ellas")
    except Exception as e:
        print(f"· Candidaturas: no se han podido leer ({e})")


def reprocesar(con_ia: bool) -> None:
    """Vuelve a procesar los Diarios y las votaciones ya descargados (data/raw), sin pedir nada a la red.

    Úsalo después de cambiar el parser.
    """
    print("· Votaciones")
    for f in sorted(VOTACIONES.glob("*.json")):
        nuevas = []
        for v in votaciones.leer_dia(f):
            if v.get("llamamiento"):   # sale del Diario de Sesiones: se rehace después, con los Diarios
                nuevas.append(v)
                continue
            crudo = descargar_cache(v.get("json", ""))
            nuevas.append(votaciones.leer_votacion(json.loads(crudo.decode("utf-8-sig")), v["json"]) if crudo else v)
        votaciones.guardar_dia(f.stem, nuevas)
        print(f"  {f.stem}: {len(nuevas)}")
    mapa = votaciones.mapa_diputados()
    print("· Diarios")
    rutas = sorted(CRUDOS.glob(f"DSCD-{diario.LEGISLATURA}-*.pdf"))
    # Cada Diario es independiente: se procesan en paralelo (pdftotext es lo que más tarda).
    with ProcessPoolExecutor() as ex:
        for ses in ex.map(_procesar, rutas, [mapa] * len(rutas), chunksize=4):
            if ses:
                print(f"  {ses['id']}: {ses['fecha']} · {ses['organo']} · {len(ses['intervenciones'])} turnos")
    print(f"· Votaciones por llamamiento: {len(llamamiento.actualizar())}")
    print("· Construyendo la web" + (" (sin IA)" if not con_ia else ""))
    construir(con_ia=con_ia)
    calidad.imprimir(calidad.informe())


def _procesar(ruta, mapa):
    _, _, serie, numero = ruta.stem.split("-")
    try:
        return diario.procesar_diario(ruta, serie, int(numero), mapa)
    except Exception as e:  # un PDF raro no debe parar la legislatura entera
        print(f"  {ruta.name}: no se pudo procesar ({e})")
        return None


def descargar_cache(url: str) -> bytes | None:
    """El fichero de `url` si ya está en data/raw; nunca va a la red."""
    import hashlib
    if not url:
        return None
    nombre = url.rstrip("/").split("/")[-1].split("?")[0] or "index"
    ruta = CRUDOS / f"{hashlib.sha1(url.encode()).hexdigest()[:10]}-{nombre}"
    return ruta.read_bytes() if ruta.exists() else None


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="escano", description="Escaño Abierto")
    sub = p.add_subparsers(dest="orden", required=True)

    a = sub.add_parser("actualizar", help="descarga datos nuevos y regenera la web")
    a.add_argument("--desde", type=date.fromisoformat, default=date.today() - timedelta(days=10))
    a.add_argument("--hasta", type=date.fromisoformat, default=date.today())
    a.add_argument("--sin-ia", action="store_true", help="no llama a NaN")

    d = sub.add_parser("diario", help="procesa un Diario de Sesiones concreto")
    d.add_argument("serie", choices=["PL", "CO"])
    d.add_argument("numero", type=int)

    c = sub.add_parser("construir", help="regenera los datos de la web con lo ya descargado")
    c.add_argument("--sin-ia", action="store_true")

    r = sub.add_parser("reprocesar", help="rehace sesiones y votaciones con lo ya descargado, sin red")
    r.add_argument("--sin-ia", action="store_true")

    sub.add_parser("calidad", help="indicadores del parser por sesión")
    pq = sub.add_parser("preguntas", help="descarga las preguntas escritas al Gobierno")
    pq.add_argument("--completo", action="store_true", help="recorre toda la legislatura, no solo lo nuevo")
    sub.add_parser("agenda", help="descarga el orden del día de los próximos plenos y la tramitación de leyes")
    ex = sub.add_parser("explora", help="unifica con IA temas, lugares y propuestas (solo lo que falte)")
    ex.add_argument("--solo", choices=["temas", "lugares", "propuestas"])
    es = sub.add_parser("estado", help="nombramientos y ceses de altos cargos en el BOE y organigrama del Estado")
    es.add_argument("--desde", type=date.fromisoformat, help="por defecto, lo que falte desde la última vez")
    es.add_argument("--hasta", type=date.fromisoformat)
    ca = sub.add_parser("candidaturas", help="listas al Congreso publicadas en el BOE y quién de los diputados repite")
    ca.add_argument("--desde", type=date.fromisoformat, help="por defecto, el día 21 tras la convocatoria")
    ca.add_argument("--hasta", type=date.fromisoformat, help="por defecto, hoy")
    ca.add_argument("--boe", nargs="+", help="identificadores BOE-A-… concretos (el principal y sus correcciones)")
    pm = sub.add_parser("promesas", help="promesas de los programas de 2023 frente a lo votado (necesita NAN_API_KEY)")
    pm.add_argument("--solo", help="solo un programa: PP, PSOE, VOX, SUMAR, ERC, JUNTS, BILDU, PNV, BNG o UPN")
    pm.add_argument("--limite", type=int, help="como mucho estas tandas de texto por programa (para probar)")
    args = p.parse_args(argv)
    if args.orden == "actualizar":
        actualizar(args.desde, args.hasta, not args.sin_ia)
    elif args.orden == "diario":
        from .config import CRUDOS
        from .red import descargar
        ruta = CRUDOS / f"DSCD-{diario.LEGISLATURA}-{args.serie}-{args.numero}.pdf"
        if descargar(diario.url_diario(args.serie, args.numero), ruta) is None:
            raise SystemExit("Ese Diario no está publicado.")
        ses = diario.procesar_diario(ruta, args.serie, args.numero, votaciones.mapa_diputados())
        print(f"{ses['id']}: {ses['fecha']} · {len(ses['intervenciones'])} turnos")
    elif args.orden == "construir":
        construir(con_ia=not args.sin_ia)
    elif args.orden == "reprocesar":
        reprocesar(con_ia=not args.sin_ia)
    elif args.orden == "preguntas":
        pr = preguntas.actualizar(completo=args.completo)["preguntas"]
        print(f"{len(pr)} preguntas, {sum(p['estado'] == 'pendiente' for p in pr)} sin contestar")
    elif args.orden == "agenda":
        ag = agenda.actualizar()
        print(f"{len(ag['plenos'])} plenos convocados, {len(ag['comisiones'])} sesiones de comisión, "
              f"{len(leyes.actualizar()['iniciativas'])} iniciativas legislativas")
    elif args.orden == "explora":
        from . import normalizar
        normalizar.ejecutar(args.solo)
    elif args.orden == "estado":
        from . import boe, estado
        boe.actualizar(args.desde, args.hasta)
        e = estado.escribir()
        print(f"· Organigrama: {e['cifras']['cargos_ocupados']} altos cargos con titular en {e['cifras']['ministerios']} "
              f"ministerios; {e['cifras']['cambios_30']} cambios en 30 días")
    elif args.orden == "candidaturas":
        from . import candidaturas, elecciones
        dips = json.loads((SITIO / "datos" / "indice.json").read_text())["diputados"]
        if args.boe:
            c = candidaturas.escribir(args.boe, dips)
        else:
            c = candidaturas.actualizar(args.desde or elecciones.CONVOCATORIA + timedelta(days=21),
                                        args.hasta or date.today(), dips)
        if not c:
            raise SystemExit("El BOE aún no ha publicado las candidaturas.")
        print(f"{c['fase']}: {sum(len(v) for v in c['listas'].values())} listas en {len(c['listas'])} circunscripciones; "
              f"{len(c['repite'])} de {len(dips)} diputados van en alguna")
        print("Vuelve a construir la web para publicarlo: python -m escano construir --sin-ia")
    elif args.orden == "promesas":
        from . import promesas
        r = promesas.ejecutar(args.solo, args.limite)
        for sigla, p in r["programas"].items():
            print(f"  {sigla}: {len(p['promesas'])} promesas")
        print("Vuelve a construir la web para publicarlo: python -m escano construir --sin-ia")
    elif args.orden == "calidad":
        raise SystemExit(1 if calidad.imprimir(calidad.informe()) else 0)
