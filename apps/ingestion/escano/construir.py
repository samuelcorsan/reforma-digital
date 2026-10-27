"""Une Diarios, análisis y votaciones en los ficheros que lee la web (site/datos/).

site/datos/indice.json lleva lo común (grupos, diputados, meses disponibles) y site/datos/AAAA-MM.json las
sesiones, votaciones e intervenciones de cada mes, para que la web no tenga que cargar toda la legislatura.
"""
from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date

from . import diputados as mod_diputados, hemiciclo as mod_hemiciclo, organos as mod_organos
from . import agenda as mod_agenda, intereses as mod_intereses, leyes as mod_leyes, preguntas as mod_preguntas
from . import bienes as mod_bienes
from . import explora as mod_explora, semanas as mod_semanas, temas as mod_temas, votaciones as mod_votaciones
from .analisis import analizar, resumir_sesion, solo_cache
from .config import DATOS, INFO_GRUPOS, LEGISLATURA_ROMANA, SESIONES, SITIO

MVP = DATOS / "mvp.json"  # análisis del prototipo; solo rellenan lo que el pipeline aún no ha analizado

PARLAMENTARIOS = ["PSOE", "PP", "VOX", "SUMAR", "ERC", "JUNTS", "BILDU", "PNV", "MIXTO"]
PROPONENTES = [
    (r"socialista", "PSOE"), (r"popular", "PP"), (r"vox", "VOX"), (r"sumar", "SUMAR"),
    (r"republicano", "ERC"), (r"junts", "JUNTS"), (r"bildu", "BILDU"), (r"vasco|pnv", "PNV"),
    (r"mixto", "MIXTO"), (r"real decreto|gobierno", "GOB"),
]
TIPOS = [
    (r"no de ley", "Proposición no de ley"),
    (r"moci[oó]n", "Moción"),
    (r"decreto", "Convalidación RDL"),
    (r"enmiendas? del senado", "Enmiendas del Senado"),
    (r"veto del senado", "Veto del Senado"),
    (r"dictamen", "Dictamen"),
    (r"proposici[oó]n(es)? de ley|toma en consideraci", "Toma en consideración"),
    (r"proyecto de ley", "Proyecto de ley"),
]


def _palabras(s: str) -> set[str]:
    s = "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")
    return {w for w in re.findall(r"[a-z0-9]{4,}", s)}


def parecido(a: str, b: str) -> float:
    pa, pb = _palabras(a), _palabras(b)
    return len(pa & pb) / max(1, min(len(pa), len(pb)))


def proponente(texto: str) -> str | None:
    t = texto.lower()
    m = re.search(r"grupo parlamentario ([^,.(]+)", t)
    objetivo = m.group(1) if m else t[:120]
    for patron, g in PROPONENTES:
        if re.search(patron, objetivo):
            return g
    return None


def tipo_votacion(v: dict) -> str:
    for texto in (v["tipo"], v["titulo"][:80]):
        for patron, nombre in TIPOS:
            if re.search(patron, texto, re.I):
                return nombre
    return v["tipo"] or "Votación"


# «Del diputado don X, del Grupo Parlamentario Y, que formula al señor ministro de Z: ¿…?» -> «X: ¿…?»
RE_PREGUNTA = re.compile(r"^De(?:l| la) diputad[oa] (?:don|doña) (?P<n>[^,]+?)(?:, en sustitución[^,]*)?, "
                         r"del Grupo Parlamentario [^,]+, que formula [^:]+:\s*(?P<p>.+)$", re.I)
RE_RDL = re.compile(r"^Real Decreto-ley (\d+/\d{4}), de \d+ de \w+, (.*)$", re.I)
RE_ASUNTO = re.compile(r",\s+(?:sobre|relativ[ao] a|para)\s+(.*)$", re.I)
RE_PREFIJO = re.compile(r"^(?:(?:Proposición no de Ley|Proposición de Ley|Proyecto de Ley|Moción[^,]*?)\s*)?"
                        r"(?:del Grupo Parlamentario [^,]+,\s*)?(?:de\s+)?", re.I)


def titulo_votacion(texto: str, subgrupo: str = "") -> str:
    """Título corto a partir del texto oficial del expediente (sin IA).

    «Moción consecuencia de interpelación urgente del Grupo Parlamentario Popular en el Congreso, sobre la crisis
    que atraviesa la Ciudad Autónoma de Ceuta.» -> «Crisis que atraviesa la Ciudad Autónoma de Ceuta».
    """
    t = (texto or "").strip().split("\n")[0].strip()
    t = re.sub(r"\.?\s*«BOCG[^»]*».*$", "", t)            # referencia al boletín
    t = re.sub(r"\s*\(BOE[^)]*\)\.?", "", t).strip().rstrip(".")
    if m := RE_PREGUNTA.match(t):
        t = f"{m.group('n').strip()}: {m.group('p').strip()}"
    elif m := re.search(r"^Tramitación como Proyecto de Ley.*?Real Decreto-ley (\d+/\d{4})", t, re.I):
        t = f"Tramitar el RDL {m.group(1)} como proyecto de ley"
    elif m := RE_RDL.match(t):
        t = f"RDL {m.group(1)} {m.group(2)}"
    elif m := RE_ASUNTO.search(t):
        t = m.group(1)
    else:
        t = RE_PREFIJO.sub("", t) or t
        if re.match(r"(?:por (?:la|el) que|orgánica)\b", t, re.I):
            t = "Ley " + t[:1].lower() + t[1:]
    t = re.sub(r"^(?:el|la|los|las)\s+", "", t, flags=re.I).strip()
    t = t[:1].upper() + t[1:]
    if len(t) > 110:
        t = t[:110].rsplit(" ", 1)[0].rstrip(",;") + "…"
    if subgrupo and len(subgrupo) <= 60:
        t += f" ({subgrupo[:1].lower() + subgrupo[1:]})"
    return t or "Votación"


def titulo_legible(item: str) -> str:
    t = re.sub(r"\(Número de expediente[^)]*\)\.?", "", item).strip(" —.")
    return t[:1].upper() + t[1:].lower() if t.isupper() else t


def diputados(votaciones: list[dict]) -> list[list]:
    """[nombre, grupo, circunscripción, formación, alta, x, y, código, baja] de cada diputado que aparece en las
    votaciones, en orden estable. x, y: su escaño en el plano; baja: fecha en que dejó el escaño, o "".

    El grupo es el del voto más reciente. La web usa este orden para leer la cadena `v` de cada votación.
    Quien ya no es diputado no está en el plano actual: se le sitúa en el escaño que ocupaba (el número de
    asiento de las votaciones), que hoy tiene otro diputado con posición conocida.
    """
    grupo: dict[str, str] = {}
    asiento: dict[str, int] = {}
    for v in sorted(votaciones, key=lambda v: (v["fecha"], v.get("numero") or 0)):
        for d in v.get("votos", []):
            grupo[d["diputado"]] = d["grupo"]
            if d.get("asiento"):
                asiento[d["diputado"]] = d["asiento"]
    ficha, plano = mod_diputados.leer(), mod_hemiciclo.leer()["escanos"]
    por_asiento = {asiento[n]: plano[n] for n in plano if n in asiento}
    ultimos = {d["diputado"] for d in (max(votaciones, key=lambda v: (v["fecha"], v.get("numero") or 0))["votos"]
                                       if votaciones else [])}

    def fila(n, g):
        f = ficha.get(n, {})
        baja = f.get("baja", "") or ("" if (n in ultimos or n in plano or (f and not f.get("baja"))) else "sí")
        e = plano.get(n) or (por_asiento.get(asiento.get(n), {}) if baja else {})
        return [n, g, f.get("circunscripcion", ""), f.get("formacion", ""), f.get("alta", ""),
                e.get("x"), e.get("y"), plano.get(n, {}).get("codigo"), baja]
    return sorted((fila(n, g) for n, g in grupo.items()), key=lambda x: (x[1], x[0]))


def votos_compactos(v: dict, indice: dict[str, int]) -> str:
    """Una letra por diputado (S, N, A, X = no vota, - = no figura en esta votación)."""
    letras = ["-"] * len(indice)
    for d in v.get("votos", []):
        if d["diputado"] in indice:
            letras[indice[d["diputado"]]] = d["voto"]
    return "".join(letras)


def _votacion_web(v: dict, indice: dict[str, int] | None = None, actual: dict[str, str] | None = None) -> dict:
    return {
        "id": v["id"], "fecha": v["fecha"], "tipo": tipo_votacion(v),
        "titulo": titulo_votacion(v["titulo"], v.get("subgrupo", "")), "titulo_fuente": "oficial", "texto": v["titulo"],
        "proponente": proponente(v["titulo"]) or "?", "exp": v.get("exp") or "",
        "si": v["si"], "no": v["no"], "abst": v["abst"], "novota": v["novota"],
        "grupos": {g: (x if x in "SNAD" else "?") for g, x in v["grupos"].items()},
        "conteo": v.get("conteo", {}),
        "discrepantes": [f"{d['diputado']} ({d['grupo']})" for d in v.get("discrepantes", [])],
        "json": v.get("json", ""),
        "v": votos_compactos(v, indice) if indice and v.get("votos") else "",
        **({"cg": cg} if (cg := cambios_de_grupo(v, indice, actual)) else {}),
    }


def cambios_de_grupo(v: dict, indice: dict[str, int] | None, actual: dict[str, str] | None) -> dict[str, str]:
    """{posición: grupo} de quien votó desde un grupo distinto del actual (p. ej. Podemos, en SUMAR hasta 2023)."""
    if not indice or not actual:
        return {}
    return {str(indice[d["diputado"]]): d["grupo"] for d in v.get("votos", [])
            if d["diputado"] in indice and d["grupo"] != actual.get(d["diputado"])}


def completar_con_mvp(sesiones: list[dict], ivs: list[dict], votos: list[dict]) -> None:
    """Rellena con el análisis del MVP las sesiones que el pipeline aún no ha analizado.

    El análisis del pipeline manda siempre: una sesión con intervenciones analizadas no se toca.
    """
    if not MVP.exists():
        return
    mvp = json.loads(MVP.read_text())
    for v in votos:  # títulos revisados a mano en el MVP
        if (m := mvp.get("votaciones", {}).get(v["id"])):
            v.update(m)
            v["titulo_fuente"] = "revisado"
    ids_votos = {v["id"] for v in votos}
    analizadas = {i["s"] for i in ivs}
    for m in mvp.get("sesiones", []):
        p = next((s for s in sesiones if m.get("dsNombre") and s.get("dsNombre") == m["dsNombre"]), None) \
            or next((s for s in sesiones if not m.get("ds") and s["fecha"] == m["fecha"] and s["organo"] == m["organo"]), None)
        m_ivs = [dict(i) for i in mvp.get("intervenciones", []) if i["s"] == m["id"]]
        if p is None:
            m = {**m, "puntos": [{**pt, "votos": [x for x in pt.get("votos", []) if x in ids_votos]} for pt in m["puntos"]],
                 "fuente": "mvp"}
            sesiones.append(m)
            ivs.extend(m_ivs)
            continue
        if p["id"] in analizadas:
            continue
        p["resumen"] = p.get("resumen") or m.get("resumen", "")
        if p["resumen"]:
            p.pop("nota", None)
        # Los puntos del MVP enlazan sus intervenciones; solo sirven si describen el mismo Diario (o ninguno).
        if m.get("dsNombre") == p.get("dsNombre") or not p.get("ds"):
            p["puntos"] = [{**pt, "votos": [x for x in pt.get("votos", []) if x in ids_votos]} for pt in m["puntos"]]
            for i in m_ivs:
                i["s"] = p["id"]
            ivs.extend(m_ivs)
        p["fuente"] = "mvp"


def analisis_de_sesion(ses: dict, votos_dia: list[dict], con_ia: bool = True) -> tuple[dict[int, dict], list[str], dict]:
    """Análisis de cada intervención (por su orden), asuntos en orden de aparición y resumen de la jornada.

    Sin IA se usa lo que ya esté en la caché de análisis, sin llamar a la API. Con analisis.RECOGER activo
    tampoco se llama: el runner recoge lo pendiente con las mismas claves.
    """
    if not con_ia:
        with solo_cache():
            return analisis_de_sesion(ses, votos_dia, con_ia=True)
    ivs = ses["intervenciones"]
    analisis: dict[int, dict] = {}
    previa = None
    for iv in ivs:
        if iv["grupo"] == "MESA":
            continue
        es_respuesta = iv["grupo"] == "GOB" and previa and previa["grupo"] != "GOB"
        a = analizar(iv, previa["texto"] if es_respuesta else None)
        if a:
            analisis[iv["orden"]] = a
        previa = iv

    asuntos = []
    for iv in ivs:
        clave = iv["item"] or iv["seccion"] or "Sesión"
        if clave not in asuntos:
            asuntos.append(clave)

    lineas = []
    for iv in ivs:
        if (a := analisis.get(iv["orden"])):
            lineas.append(f"- {iv['orador']} ({iv['grupo']}) sobre «{(iv['item'] or '')[:120]}»: {a['resumen']}")
    for v in votos_dia:
        lineas.append(f"- Votación: {v['texto'][:160]} → Sí {v['si']}, No {v['no']}, Abst. {v['abst']}")

    r = {}
    if lineas or asuntos:
        r = resumir_sesion(ses["organo"], ses["fecha"], [titulo_legible(a) for a in asuntos], lineas) or {}
    return analisis, asuntos, r


def votos_por_fecha(votaciones: list[dict] | None = None) -> dict[str, list[dict]]:
    por_fecha: dict[str, list[dict]] = defaultdict(list)
    for v in votaciones if votaciones is not None else map(_votacion_web, mod_votaciones.leer_todas()):
        por_fecha[v["fecha"]].append(v)
    return por_fecha


def construir(con_ia: bool = True) -> dict:
    votaciones = mod_votaciones.leer_todas()
    lista_diputados = diputados(votaciones)
    indice = {d[0]: i for i, d in enumerate(lista_diputados)}
    actual = {d[0]: d[1] for d in lista_diputados}
    web_votos = [_votacion_web(v, indice, actual) for v in votaciones]
    por_fecha = votos_por_fecha(web_votos)

    # Escaños actuales por grupo: los del último voto con más presentes. Solo cuentan los votos del Pleno con la
    # cámara completa: los de la Diputación Permanente (con las Cortes disueltas) tienen unos sesenta miembros.
    escanos = Counter()
    plenas = [v for v in votaciones if v["si"] + v["no"] + v["abst"] + v["novota"] >= 300] or votaciones
    if plenas:
        ultimo = max(plenas, key=lambda v: (v["fecha"], v["si"] + v["no"] + v["abst"] + v["novota"]))
        escanos = Counter({g: sum(c.values()) for g, c in ultimo["conteo"].items()})

    sesiones_web, ivs_web, fechas_con_ds = [], [], set()
    for f in sorted(SESIONES.glob("*.json")):
        ses = json.loads(f.read_text())
        if not ses.get("fecha"):
            continue
        ivs = ses["intervenciones"]
        votos_dia = por_fecha.get(ses["fecha"], []) if ses["serie"] == "PL" else []
        analisis, asuntos, r = analisis_de_sesion(ses, votos_dia, con_ia)
        resumen, titular, titulos = r.get("resumen", ""), r.get("titular", ""), r.get("titulos", [])
        momentos = [m for m in r.get("momentos", []) if m.get("que")]

        puntos = []
        for i, asunto in enumerate(asuntos):
            seccion = next((iv["seccion"] for iv in ivs if (iv["item"] or iv["seccion"]) == asunto), None)
            hay_analisis = any(iv["orden"] in analisis for iv in ivs if (iv["item"] or iv["seccion"]) == asunto)
            exp = next((iv["exp"] for iv in ivs if iv["item"] == asunto and iv["exp"]), None)
            # Con número de expediente en los dos lados, manda el número: dos decretos-leyes del mismo día tienen
            # títulos casi iguales. Si falta en alguno, el parecido del texto.
            enlazados = [v["id"] for v in votos_dia
                         if (v["exp"] == exp if exp and v.get("exp") else parecido(v["texto"], asunto) >= 0.5)]
            puntos.append({
                "tipo": (seccion or "Asunto").capitalize(),
                "titulo": titulos[i] if i < len(titulos) else titulo_votacion(titulo_legible(asunto)),
                "exp": exp,
                "estado": "analizado" if hay_analisis else "pendiente",
                "itemId": asunto,
                "votos": enlazados,
            })
        # El número de expediente de la votación, cuando no viene en los datos abiertos, sale del asunto enlazado.
        por_id = {v["id"]: v for v in votos_dia}
        for p in puntos:
            for vid in p["votos"]:
                if p["exp"] and not por_id[vid]["exp"]:
                    por_id[vid]["exp"] = p["exp"]
        # Votaciones del día que no casan con ningún asunto debatido en este Diario.
        usados = {vid for p in puntos for vid in p["votos"]}
        sueltas = [v["id"] for v in votos_dia if v["id"] not in usados]
        if sueltas:
            puntos.append({"tipo": "Votaciones", "titulo": "Otras votaciones de la jornada",
                           "estado": "analizado", "votos": sueltas})

        reacciones = Counter()
        termometro: dict[str, Counter] = defaultdict(Counter)   # reacciones durante los turnos de cada grupo
        for iv in ivs:
            reacciones.update(iv.get("reacciones", {}))
            if iv["grupo"] not in ("MESA", "?"):
                termometro[iv["grupo"]]["turnos"] += 1
                termometro[iv["grupo"]].update(iv.get("reacciones", {}))
        sesiones_web.append({
            "id": ses["id"], "fecha": ses["fecha"], "organo": ses["organo"],
            "sesion": f"Sesión nº {ses['sesion']}" if ses.get("sesion") else ses["organo"],
            "ds": ses["ds"], "dsNombre": ses["id"], "titular": titular, "resumen": resumen, "puntos": puntos,
            **({"momentos": momentos} if momentos else {}),
            "reacciones": dict(reacciones), "turnos": sum(1 for iv in ivs if iv["grupo"] != "MESA"),
            "termometro": {g: dict(c) for g, c in termometro.items()},
            **({"ia": r["_provenance"]} if r.get("_provenance") else {}),
        })
        if ses["serie"] == "PL":
            fechas_con_ds.add(ses["fecha"])

        for iv in ivs:
            a = analisis.get(iv["orden"])
            if not a:
                continue
            ivs_web.append({
                "s": ses["id"], "item": iv["item"] or iv["seccion"] or "Sesión", "orador": iv["orador"],
                "g": iv["grupo"], "rol": iv["cargo"] or INFO_GRUPOS.get(iv["grupo"], {}).get("nombre", ""),
                "pos": None if a.get("posicion") == "no aplica" else a.get("posicion"),
                "tono": a["tono"], "int": a["intensidad"], "temas": a["temas"], "resumen": a["resumen"],
                "cita": a.get("cita"), "responde": a.get("responde"), "responde_motivo": a.get("responde_motivo"),
                "reacciones": iv.get("reacciones", {}),
                **({"ia": a["_provenance"]} if a.get("_provenance") else {}),
                # Campos del análisis v2; solo se incluyen si tienen algo, para no engordar los ficheros de cada mes.
                **{k: v for k, v in (("frase", a.get("en_una_frase")), ("motivo", a.get("motivo_posicion")),
                                     ("comp", a.get("compromisos")), ("prop", a.get("propuestas")),
                                     ("cifras", a.get("cifras")), ("lugares", a.get("territorios")),
                                     ("leyes", a.get("iniciativas"))) if v},
            })

    # Plenos con votaciones pero sin Diario publicado todavía.
    for fecha, vs in por_fecha.items():
        if fecha in fechas_con_ds:
            continue
        sesiones_web.append({
            "id": f"votos-{fecha}", "fecha": fecha, "organo": "Pleno",
            "sesion": f"Sesión nº {vs[0]['id'].split('-')[0]}", "ds": None,
            "resumen": "", "nota": "El Diario de Sesiones de esta jornada aún no se ha publicado. Se muestran las votaciones.",
            "puntos": [{"tipo": v["tipo"], "titulo": v["titulo"][:200], "estado": "sin-ds", "votos": [v["id"]]}
                       for v in vs],
        })

    completar_con_mvp(sesiones_web, ivs_web, web_votos)
    mod_explora.porque_votan(web_votos, sesiones_web, ivs_web)
    from .normalizar import _leer as leer_normalizacion   # lo que dejó `python -m escano explora`; sin API
    canon = leer_normalizacion("temas")
    explora = {"contesta": mod_explora.contesta(sesiones_web, ivs_web),
               "citas": mod_explora.citas(sesiones_web, ivs_web),
               "radar": mod_explora.radar(sesiones_web, ivs_web, canon),
               "propuestas": mod_explora.propuestas(leer_normalizacion("propuestas"))}
    por_provincia = mod_explora.lugares(sesiones_web, ivs_web, leer_normalizacion("lugares"), canon)
    fechas = sorted({s["fecha"] for s in sesiones_web})
    # «Datos hasta»: lo más reciente que hay (una sesión, una votación o un nombramiento o cese del BOE), no el día
    # en que se construye la web, que cambia aunque no haya nada nuevo.
    boe = json.loads((DATOS / "boe.json").read_text()) if (DATOS / "boe.json").exists() else {}
    hasta = max([*fechas[-1:], *(v["fecha"] for v in web_votos if v.get("fecha")),
                 *(e["fecha"] for e in boe.get("eventos", []) if e.get("fecha"))], default="")
    grupos = {g: {**INFO_GRUPOS[g], "codigo": g, "escanos": escanos.get(g, 0)} for g in INFO_GRUPOS}
    salida = {
        "datos": {
            "meta": {"periodo": f"{fechas[0]} – {fechas[-1]}" if fechas else "",
                     "generado": date.today().isoformat(), "datos_hasta": hasta, "legislatura": LEGISLATURA_ROMANA},
            "grupos": grupos,
            "sesiones": sesiones_web,
            "votaciones": web_votos,
            "diputados": lista_diputados,
        },
        "intervenciones": ivs_web,
        "explora": explora,
        "lugares": por_provincia,
    }
    for v in web_votos:
        v["tm"] = mod_temas.temas_de(v["titulo"], v["texto"])
    leyes = mod_leyes.leer()
    for ley in leyes["iniciativas"]:
        ley["tm"] = mod_temas.temas_de(ley["titulo"])
    salida["leyes"] = leyes
    salida["semanas"] = mod_semanas.calcular(web_votos, sesiones_web, ivs_web, leyes["iniciativas"], lista_diputados)
    salida["agenda"] = mod_agenda.leer()
    for p in salida["agenda"].get("plenos", []):
        for x in p["puntos"]:
            x["tm"] = mod_temas.temas_de(x["titulo"], x["texto"])
    salida["preguntas"] = mod_preguntas.leer_todo()["preguntas"]
    escribir_web(salida)
    from . import elecciones   # sección «Elecciones» (29N): calendario, lo que caduca, mapas e histórico
    elecciones.escribir(salida, SITIO / "datos" / "elecciones")
    from . import geografia    # sección «Geografía»: comunidades y provincias con los datos del INE (python -m escano.geografia)
    geografia.escribir(SITIO / "datos" / "geografia")
    from . import encuestas    # «Las encuestas» del 29N: lo que dejó `python -m escano.encuestas` (Wikipedia y Polymarket)
    encuestas.escribir(SITIO / "datos" / "encuestas")
    return salida


def slug_web(texto: str) -> str:
    """El mismo slug que usa la web para cada diputado."""
    t = "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def _clave_apellidos(s: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")
    return " ".join(s.replace("-", " ").split())


def extras_diputados(nombres: list[str]) -> dict:
    """Lo que la ficha carga aparte: biografía, comisiones y turnos de palabra por órgano.

    Los turnos salen de los Diarios procesados (data/sesiones): el Diario nombra al orador por sus apellidos,
    que se casan con los del diputado cuando no hay ambigüedad.
    """
    ficha, intereses = mod_diputados.leer(), mod_intereses.leer()
    salida = {n: {"bio": ficha.get(n, {}).get("biografia", ""), "comisiones": [], "turnos": {}} for n in nombres}
    for n in nombres:
        if (i := intereses.get(n)) and any(i[k] for k in ("actividades", "aportaciones", "regalos", "observaciones")):
            salida[n]["intereses"] = i
    # Declaraciones de bienes del BOCG
    bienes = mod_bienes.leer()["declaraciones"]
    claves = {n: mod_bienes.clave(n) for n in nombres}
    comunes = Counter(k.split(",")[0] for k in claves.values())
    for n, k in claves.items():
        ap = k.split(",")[0]
        if decl := [d for b, v in bienes.items() if b == k or comunes[ap] == 1 and b.split(",")[0] == ap for d in v]:
            salida[n]["bienes"] = sorted(decl, key=lambda d: d["fecha"])
    for comision, miembros in mod_organos.leer().items():
        for m in miembros:
            if m["nombre"] in salida and m.get("codigo") and not m.get("baja"):
                salida[m["nombre"]]["comisiones"].append([comision, m["cargo"]])
    por_apellidos: dict[str, list[str]] = defaultdict(list)
    for n in nombres:
        por_apellidos[_clave_apellidos(n.split(",")[0])].append(n)
    for f in sorted(SESIONES.glob("*.json")):
        ses = json.loads(f.read_text())
        for iv in ses.get("intervenciones", []):
            if iv["grupo"] in ("MESA", "COMP"):
                continue
            candidatos = por_apellidos.get(_clave_apellidos(iv["orador"]), [])
            if len(candidatos) == 1:
                t = salida[candidatos[0]]["turnos"]
                t[ses["organo"]] = t.get(ses["organo"], 0) + 1
    return {n: e for n, e in salida.items()
            if e["bio"] or e["comisiones"] or e["turnos"] or e.get("intereses") or e.get("bienes")}


def resumen_preguntas(preguntas: list[dict], diputados: list[list], hoy: date | None = None) -> tuple[dict, dict]:
    """Lo que la web muestra de las preguntas escritas: cifras por grupo, diputado, mes y tema, cuánto tarda
    el Gobierno en contestar, las pendientes más antiguas y, aparte, la lista de cada diputado (las 60 más
    recientes)."""
    hoy = hoy or date.today()
    limite = date.fromordinal(hoy.toordinal() - DIAS_SIN_RESPUESTA).isoformat()
    indice = {d[0]: i for i, d in enumerate(diputados)}
    por_grupo: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0])
    por_dip: dict[int, list[int]] = defaultdict(lambda: [0, 0, 0])
    por_mes: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    por_tema: Counter = Counter()
    demora_grupo: dict[str, list[int]] = defaultdict(list)
    demoras: list[int] = []
    listas: dict[int, list] = defaultdict(list)
    antiguas = []
    for p in sorted(preguntas, key=lambda p: (p["presentada"], p["exp"]), reverse=True):
        pend = p["estado"] == "pendiente"
        vieja = pend and p["calificada"] and p["calificada"] < limite
        grupo = p["autores"][0][1] if p["autores"] else "?"
        demora = None
        if p["estado"] == "contestada" and p.get("cerrada") and p["calificada"]:
            demora = max(0, (date.fromisoformat(p["cerrada"]) - date.fromisoformat(p["calificada"])).days)
            demoras.append(demora)
            demora_grupo[grupo].append(demora)
        for k, x in enumerate((1, pend, vieja)):
            por_grupo[grupo][k] += x
        por_mes[p["presentada"][:7]][0] += 1
        por_mes[p["presentada"][:7]][1] += pend
        por_tema.update(mod_temas.temas_de(p["titulo"]))
        ids = [indice[n] for n, _ in p["autores"] if n in indice]
        for i in ids:
            for k, x in enumerate((1, pend, vieja)):
                por_dip[i][k] += x
            if len(listas[i]) < 60:
                listas[i].append([p["exp"], p["presentada"], p["estado"], p["titulo"], demora])
        if vieja:
            antiguas.append([p["exp"], p["calificada"], p["titulo"], ids, grupo])
    antiguas.sort(key=lambda a: a[1])
    mediana = lambda xs: sorted(xs)[len(xs) // 2] if xs else None
    tramos = [(0, 20), (21, 40), (41, 60), (61, 120), (121, 365), (366, 100_000)]
    resumen = {
        "generado": hoy.isoformat(), "dias": DIAS_SIN_RESPUESTA, "total": len(preguntas),
        "estados": dict(Counter(p["estado"] for p in preguntas)),
        "grupos": dict(por_grupo), "diputados": {str(i): v for i, v in por_dip.items()},
        "meses": dict(sorted(por_mes.items())), "temas": dict(por_tema.most_common()),
        "antiguas": antiguas[:40], "n_antiguas": len(antiguas),
        # Tiempo de respuesta, en días desde la calificación hasta el cierre (solo las contestadas con fecha).
        "demora": {"n": len(demoras), "mediana": mediana(demoras),
                   "fuera": sum(x > DIAS_SIN_RESPUESTA for x in demoras),
                   "tramos": [[a, b, sum(a <= x <= b for x in demoras)] for a, b in tramos],
                   "grupos": {g: [mediana(xs), len(xs)] for g, xs in demora_grupo.items() if len(xs) >= 20}},
    }
    return resumen, listas


DIAS_SIN_RESPUESTA = 60  # 20 días de plazo + 20 de prórroga desde la publicación, y margen hasta que se publica


# Lo que la web necesita de cada intervención para gráficos, búsqueda y rankings; el resto va aparte, por sesión.
IV_LIGERO = ("ia", "s", "item", "orador", "g", "rol", "pos", "tono", "int", "temas", "cita", "responde", "responde_motivo",
             "frase")
IV_DETALLE = ("resumen", "motivo", "comp", "prop", "cifras", "lugares", "leyes")


def _intervenciones_ligeras(ivs: list[dict], detalle: dict[str, list[dict]]) -> tuple[list[dict], list[str]]:
    """Intervenciones de un mes sin el texto largo, y la tabla de asuntos (cada uno se escribe una sola vez).

    El texto largo se añade a `detalle[sesión]`; cada intervención guarda en "d" su posición en esa lista.
    Las que no tienen frase de síntesis (análisis antiguos) lo llevan todo en línea.
    """
    items, pos_item, salida = [], {}, []
    for i in ivs:
        if i["item"] not in pos_item:
            pos_item[i["item"]] = len(items)
            items.append(i["item"])
        ligera = {k: i[k] for k in IV_LIGERO if i.get(k) not in (None, "") or k in ("temas", "rol")}
        ligera["item"] = pos_item[i["item"]]
        resto = {k: i[k] for k in IV_DETALLE if i.get(k)}
        if i.get("frase"):
            ligera["d"] = len(detalle[i["s"]])
            detalle[i["s"]].append(resto)
        else:
            ligera.update(resto)
        salida.append(ligera)
    return salida, items


def escribir_web(salida: dict) -> None:
    """Parte la salida por meses: site/datos/indice.json y site/datos/AAAA-MM.json."""
    d = salida["datos"]
    fecha_sesion = {s["id"]: s["fecha"] for s in d["sesiones"]}
    meses: dict[str, dict] = defaultdict(lambda: {"sesiones": [], "votaciones": [], "intervenciones": []})
    for s in d["sesiones"]:
        meses[s["fecha"][:7]]["sesiones"].append(s)
    for v in d["votaciones"]:
        meses[v["fecha"][:7]]["votaciones"].append(v)
    for i in salida["intervenciones"]:
        meses[fecha_sesion.get(i["s"], "0000-00")[:7]]["intervenciones"].append(i)

    carpeta = SITIO / "datos"
    carpeta.mkdir(parents=True, exist_ok=True)
    for viejo in carpeta.glob("[0-9][0-9][0-9][0-9]-[0-9][0-9].json"):
        if viejo.stem not in meses:
            viejo.unlink()
    detalle_iv: dict[str, list[dict]] = defaultdict(list)
    for mes, contenido in meses.items():
        contenido["intervenciones"], contenido["items"] = _intervenciones_ligeras(contenido["intervenciones"], detalle_iv)
        (carpeta / f"{mes}.json").write_text(json.dumps(contenido, ensure_ascii=False))
    # El detalle de cada intervención, por sesión: la web lo pide solo cuando va a enseñar esas tarjetas.
    sub_iv = carpeta / "iv"
    sub_iv.mkdir(exist_ok=True)
    for viejo in sub_iv.glob("*.json"):
        if viejo.stem not in detalle_iv:
            viejo.unlink()
    for sesion, lista in detalle_iv.items():
        (sub_iv / f"{sesion}.json").write_text(json.dumps(lista, ensure_ascii=False))
    indice = {
        "meta": d["meta"], "grupos": d["grupos"], "diputados": d["diputados"],
        "hemiciclo": {k: v for k, v in mod_hemiciclo.leer().items() if k != "escanos"},
        "meses": [{"mes": m, "sesiones": len(c["sesiones"]), "votaciones": len(c["votaciones"]),
                   "intervenciones": len(c["intervenciones"])} for m, c in sorted(meses.items())],
    }
    agenda = salida.get("agenda") or {}
    indice["agenda"] = {"plenos": agenda.get("plenos", []), "comisiones": agenda.get("comisiones", [])}
    indice["semanas"] = [s["id"] for s in salida.get("semanas", [])]
    (carpeta / "indice.json").write_text(json.dumps(indice, ensure_ascii=False))
    # Índice por tema para toda la legislatura: la vista de un tema no necesita cargar todos los meses.
    temas = {slug: {"nombre": nombre, "votos": [], "leyes": [], "preguntas": 0} for slug, nombre, _ in mod_temas.TEMAS}
    for v in sorted(d["votaciones"], key=lambda v: (v["fecha"], v["id"]), reverse=True):
        for t in v.get("tm", []):
            temas[t]["votos"].append([v["id"], v["fecha"], v["titulo"], v["tipo"], v["si"], v["no"], v["abst"]])
    for ley in (salida.get("leyes") or {}).get("iniciativas", []):
        for t in ley.get("tm", []):
            temas[t]["leyes"].append(ley["exp"])
    for p in salida.get("preguntas") or []:
        for t in mod_temas.temas_de(p["titulo"]):
            temas[t]["preguntas"] += 1
    (carpeta / "temas.json").write_text(json.dumps(temas, ensure_ascii=False))
    if salida.get("preguntas"):
        resumen, listas = resumen_preguntas(salida["preguntas"], d["diputados"])
        (carpeta / "preguntas.json").write_text(json.dumps(resumen, ensure_ascii=False))
        sub = carpeta / "preguntas"
        sub.mkdir(exist_ok=True)
        for viejo in sub.glob("*.json"):
            viejo.unlink()
        for i, lista in listas.items():
            (sub / f"{slug_web(d['diputados'][i][0])}.json").write_text(json.dumps(lista, ensure_ascii=False))
    (carpeta / "semanas.json").write_text(json.dumps(salida.get("semanas", []), ensure_ascii=False))
    for nombre, contenido in (salida.get("explora") or {}).items():   # datos de la pestaña Explora
        (carpeta / f"explora-{nombre}.json").write_text(json.dumps(contenido, ensure_ascii=False))
    sub_lug = carpeta / "lugares"   # lo que se dice de cada provincia, para su página
    sub_lug.mkdir(exist_ok=True)
    for circ, contenido in (salida.get("lugares") or {}).items():
        (sub_lug / f"{slug_web(circ)}.json").write_text(json.dumps(contenido, ensure_ascii=False))
    leyes = salida.get("leyes") or {"iniciativas": [], "aprobadas": []}
    (carpeta / "leyes.json").write_text(json.dumps({
        "iniciativas": [{**{k: x for k, x in i.items() if k != "fases"},
                         "fases": [[f["organo"], f["fase"], f["desde"], f["hasta"]] for f in i["fases"]]}
                        for i in leyes["iniciativas"]],
        "aprobadas": leyes["aprobadas"]}, ensure_ascii=False))
    (carpeta / "diputados-extra.json").write_text(
        json.dumps(extras_diputados([x[0] for x in d["diputados"]]), ensure_ascii=False))
    if (DATOS / "boe.json").exists():  # organigrama del Estado: sale de los nombramientos y ceses del BOE
        from . import estado
        estado.escribir(carpeta)
    (SITIO / "data.json").unlink(missing_ok=True)   # formato anterior, en un solo fichero
