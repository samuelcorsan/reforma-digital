"""Elecciones generales del 29 de noviembre de 2026: datos de la sección «Elecciones» de la web.

Todo sale de fuentes oficiales y se escribe en site/datos/elecciones/:

- `elecciones.json`: el calendario electoral (LOREG), lo que caduca con la disolución, los decretos-leyes que
  tendrá que convalidar la Diputación Permanente y el balance de la legislatura.
- `geo-provincias.json` y `geo-municipios.json`: los mapas, ya proyectados (ver geo.py).

La disolución deja caducados todos los asuntos pendientes del Congreso (art. 207 del Reglamento), salvo los que
deba conocer la Diputación Permanente (los decretos-leyes) y las iniciativas legislativas populares.
"""
from __future__ import annotations

import json
import shutil
from collections import Counter
from datetime import date, timedelta

from .config import DATOS, SITIO

CARPETA = DATOS / "elecciones"          # lo versionado (geometrías, resultados oficiales procesados)
SALIDA = SITIO / "datos" / "elecciones"

# Real Decreto de disolución y convocatoria (BOE del 6 de octubre de 2026). Los plazos de la LOREG se cuentan
# desde el día de la publicación.
CONVOCATORIA = date(2026, 10, 6)
VOTACION = date(2026, 11, 29)
DECRETO = {"rd": "Real Decreto 806/2026, de 5 de octubre", "boe": "BOE-A-2026-20742"}
CONSTITUCION = date(2026, 12, 23)   # art. 5 del decreto: sesiones constitutivas el 23 de diciembre a las 10.00

# Diputados que elige cada provincia (código INE) el 29N: el anexo del decreto, con la población del padrón
# (art. 162 LOREG). Respecto a 2023, Madrid gana uno (38) y Cádiz lo pierde (8).
ESCANOS = {
    "01": 4, "02": 4, "03": 12, "04": 6, "05": 3, "06": 5, "07": 8, "08": 32, "09": 4, "10": 4, "11": 8, "12": 5, "13": 5,
    "14": 6, "15": 8, "16": 3, "17": 6, "18": 7, "19": 3, "20": 6, "21": 5, "22": 3, "23": 5, "24": 4, "25": 4, "26": 4,
    "27": 4, "28": 38, "29": 11, "30": 10, "31": 5, "32": 4, "33": 7, "34": 3, "35": 8, "36": 7, "37": 4, "38": 7, "39": 5,
    "40": 3, "41": 12, "42": 2, "43": 6, "44": 3, "45": 6, "46": 16, "47": 5, "48": 8, "49": 3, "50": 7, "51": 1, "52": 1,
}


def padron() -> dict | None:
    """Población de cada provincia (padrón del INE, de la sección de geografía): la base del reparto de escaños."""
    ruta = DATOS / "geografia" / "territorios.json"
    if not ruta.exists():
        return None
    t = json.loads(ruta.read_text())
    return {"anio": t["fuentes"]["padron"], "pob": {c: p["pob"] for c, p in t["provincias"].items()}}


def reparto(pob: dict[str, int], total: int = 350, minimo: int = 2) -> dict[str, int]:
    """Escaños de cada provincia según el art. 162 de la LOREG: un mínimo fijo (Ceuta y Melilla, uno) y el resto por
    población, con los restos mayores. Con el padrón de 2025 da exactamente el anexo del decreto de convocatoria."""
    fijos = {c: 1 if c in ("51", "52") else minimo for c in pob}
    resto = total - sum(fijos.values())
    P = {c: v for c, v in pob.items() if c not in ("51", "52")}
    cuota = sum(P.values()) / resto
    enteros = {c: int(v // cuota) for c, v in P.items()}
    por_resto = sorted(P, key=lambda c: (-(P[c] / cuota - enteros[c]), c))
    for c in por_resto[:resto - sum(enteros.values())]:
        enteros[c] += 1
    return {c: fijos[c] + enteros.get(c, 0) for c in pob}


def _fichas_diputados() -> dict:
    ruta = DATOS / "diputados.json"
    return json.loads(ruta.read_text()) if ruta.exists() else {}


def escanos_cambian() -> list[list]:
    """Provincias cuyo número de diputados cambia respecto a las últimas generales: [código, antes, ahora]."""
    ruta = CARPETA / "historico.json"
    if not ruta.exists():
        return []
    antes = {c: p["e"] for c, p in json.loads(ruta.read_text())["elecciones"][-1]["prov"].items()}
    return [[c, antes[c], n] for c, n in ESCANOS.items() if c in antes and antes[c] != n]


def calendario(conv: date = CONVOCATORIA, votacion: date = VOTACION) -> list[dict]:
    """Los hitos del proceso electoral, con el artículo de la LOREG que los fija."""
    d = lambda n: (conv + timedelta(days=n)).isoformat()
    antes = lambda n: (votacion - timedelta(days=n)).isoformat()
    return [
        {"fecha": conv.isoformat(), "hito": "Disolución y convocatoria",
         "detalle": "El BOE publica el Real Decreto: el Congreso y el Senado quedan disueltos y caducan los asuntos pendientes.",
         "ley": "art. 42"},
        {"fecha": d(15), "hasta": d(20), "hito": "Presentación de candidaturas",
         "detalle": "Los partidos, federaciones, coaliciones y agrupaciones entregan sus listas en cada Junta Electoral Provincial.",
         "ley": "art. 45"},
        {"fecha": d(22), "hito": "Listas presentadas en el BOE",
         "detalle": "Se publican todas las candidaturas presentadas, provincia por provincia.", "ley": "art. 47.1"},
        {"fecha": d(27), "hito": "Proclamación de candidaturas",
         "detalle": "Las Juntas Electorales proclaman las listas válidas; el BOE las publica al día siguiente.",
         "ley": "art. 47.4"},
        {"fecha": (votacion - timedelta(days=16)).isoformat(), "hasta": antes(2), "hito": "Campaña electoral",
         "detalle": "Quince días, de las 0.00 del día 38 tras la convocatoria a las 24.00 del viernes antes de votar.",
         "ley": "art. 51"},
        {"fecha": antes(10), "hito": "Último día para pedir el voto por correo",
         "detalle": "Se pide en cualquier oficina de Correos, en persona o con certificado electrónico.", "ley": "art. 72"},
        {"fecha": antes(4), "hito": "Último día para enviar el voto por correo", "ley": "art. 73"},
        {"fecha": antes(1), "hito": "Jornada de reflexión", "detalle": "Sin campaña ni propaganda.", "ley": "art. 53"},
        {"fecha": votacion.isoformat(), "hito": "Votación",
         "detalle": "Los colegios abren de 9.00 a 20.00. El escrutinio provisional empieza al cerrar las mesas.",
         "ley": "art. 84"},
        {"fecha": CONSTITUCION.isoformat(), "hito": "Constitución de las nuevas Cortes",
         "detalle": "El Congreso y el Senado se reúnen a las 10.00, como fija el Real Decreto de convocatoria. Empieza la XVI legislatura.",
         "ley": "art. 68.6 CE"},
    ]


def _caduca(i: dict) -> bool:
    """Si la disolución deja la iniciativa sin terminar. Las «concluidas» no caducan (aprobadas por las Cortes a la
    espera del BOE, inadmitidas, o las de los parlamentos autonómicos, que pasan al próximo Congreso), salvo las que el
    Congreso cierra precisamente como «Concluido - (Caducado)» al actualizar sus datos tras la disolución."""
    situacion = i.get("situacion", "")
    return i["estado"] in ("en trámite", "caducada") and (not situacion.startswith("Concluido") or "Caducad" in situacion)


def caducan(leyes: dict, disolucion: date = CONVOCATORIA) -> dict:
    """Proyectos y proposiciones de ley que la disolución deja sin terminar.

    Antes de que el Congreso actualice sus datos abiertos aparecen como «en trámite»; después, como «caducada».
    """
    vivas = [i for i in leyes.get("iniciativas", []) if _caduca(i) and "popular" not in i.get("titulo", "").lower()[:60]]
    dias = lambda i: (disolucion - date.fromisoformat(i["presentada"])).days if i.get("presentada") else None
    lista = sorted(vivas, key=lambda i: (-i["etapa"], -(i.get("ampliaciones") or 0), i["exp"]))
    return {
        "total": len(vivas),
        "proyectos": sum(i["tipo"] == "Proyecto de ley" for i in vivas),
        "proposiciones": sum(i["tipo"] != "Proyecto de ley" for i in vivas),
        "por_origen": dict(Counter(i["origen"] for i in vivas).most_common()),
        "por_autor": dict(Counter(a for i in vivas for a in i["autores"]).most_common()),
        "por_etapa": [sum(i["etapa"] == k for i in vivas) for k in range(6)],
        "congelador": sum((i.get("ampliaciones") or 0) >= 10 for i in vivas),
        "max_ampliaciones": max((i.get("ampliaciones") or 0 for i in vivas), default=0),
        "dias_medio": round(sum(dias(i) or 0 for i in vivas) / len(vivas)) if vivas else 0,
        # exp, título, tipo, origen, autores, presentada, etapa, ampliaciones, días en trámite, comisión
        "lista": [[i["exp"], i["titulo"], "PL" if i["tipo"] == "Proyecto de ley" else "PPL", i["origen"], i["autores"],
                   i.get("presentada", ""), i["etapa"], i.get("ampliaciones") or 0, dias(i), i.get("comision", "")]
                  for i in lista],
    }


def _fechas_etapas(ini: dict) -> list[str]:
    """Cuándo llegó a cada etapa del embudo (las de escano.leyes.etapa): [admitida, informe, aprobada en el Congreso,
    vuelta del Senado, ley]; "" si no llegó. La presentación es ini["presentada"]."""
    fs = ini.get("fases") or []
    f = lambda x, k: x.get(k) if isinstance(x, dict) else x[{"organo": 0, "fase": 1, "desde": 2, "hasta": 3}[k]]
    primera = lambda cond, k="desde": next((f(x, k) or f(x, "desde") for x in fs if cond(f(x, "organo"), f(x, "fase"))), "")
    e = ini.get("etapa", 0)
    admitida = (ini.get("presentada", "") if ini["tipo"] == "Proyecto de ley" else
                primera(lambda o, fa: fa.startswith("Acuerdo subsiguiente") or (o.startswith("Comisión") and fa in ("Enmiendas", "Publicación"))))
    informe = primera(lambda o, fa: fa in ("Informe", "Dictamen", "Nuevo dictamen"))
    aprobada = primera(lambda o, fa: o == "Senado") or primera(lambda o, fa: fa.startswith("Aprobación"), "hasta")
    senado = primera(lambda o, fa: o == "Senado", "hasta") if ini.get("origen") != "SEN" else ""
    ley = ini.get("fecha_resultado", "") if ini.get("estado") == "aprobada" else ""
    fechas = [admitida, informe, aprobada, senado, ley]
    # Solo las etapas a las que llegó, y nunca antes que la anterior.
    salida, previa = [], ini.get("presentada", "")
    for k, d in enumerate(fechas, start=1):
        d = (d or previa) if k <= e else ""
        if d and previa and d < previa:
            d = previa
        salida.append(d)
        previa = d or previa
    return salida


def viajes(leyes: dict, disolucion: date = CONVOCATORIA) -> dict:
    """El viaje de cada proyecto y proposición de ley de la legislatura, para la guillotina y el embudo de la web:
    [exp, título, PL/PPL, origen, autores, comisión, presentada, [fechas de cada etapa], estado, fecha final, ampliaciones]."""
    filas = []
    for i in leyes.get("iniciativas", []):
        if not i.get("presentada"):
            continue
        estado = "caduca" if _caduca(i) else i["estado"]
        fin = disolucion.isoformat() if estado == "caduca" else (i.get("fecha_resultado") or "")
        filas.append([i["exp"], i["titulo"], "PL" if i["tipo"] == "Proyecto de ley" else "PPL", i["origen"], i["autores"],
                      i.get("comision", ""), i["presentada"], _fechas_etapas(i), estado, fin, i.get("ampliaciones") or 0])
    filas.sort(key=lambda x: (x[6], x[0]))
    return {"inicio": "2023-08-17", "disolucion": disolucion.isoformat(), "leyes": filas}


def pendientes_de_convalidar(leyes: dict, votaciones: list[dict], hoy: date | None = None) -> list[dict]:
    """Reales decretos-leyes publicados y aún sin votación de convalidación: los heredará la Diputación Permanente."""
    import re
    hoy = hoy or date.today()
    votados = set()
    for v in votaciones:
        if v.get("tipo", "").startswith("Convalidación"):
            for m in re.finditer(r"(?:Real Decreto-ley|RDL)\s+(\d+/\d{4})", v.get("texto", "") + " " + v.get("titulo", "")):
                votados.add(m.group(1))
    out = []
    for a in leyes.get("aprobadas", []):
        if not _es_rdl(a) or a["numero"] in votados or not a.get("fecha"):
            continue
        publicado = date.fromisoformat(a["fecha"])
        if (hoy - publicado).days > 45:   # los de hace más de 30 días hábiles ya se votaron (o decayeron)
            continue
        out.append({"numero": a["numero"], "titulo": a["titulo"], "fecha": a["fecha"], "pdf": a.get("pdf", ""),
                    # 30 días hábiles desde su promulgación para convalidarlo (art. 86 CE); se cuenta en naturales
                    # aproximados: el plazo exacto lo da el Congreso.
                    "limite_aprox": (publicado + timedelta(days=30)).isoformat()})
    return out


def decretos(leyes: dict, votaciones: list[dict], hoy: date | None = None) -> list[dict]:
    """Cada real decreto-ley de la legislatura con su votación de convalidación (o derogación) y, si la hubo, la de
    tramitarlo como proyecto de ley. Los que aún no se han votado van como «pendiente»."""
    import re
    rdl = lambda t: (re.search(r"Real Decreto-ley\s+(\d+/\d{4})", t or "") or [None, None])[1]
    conv, tram = {}, {}
    for v in sorted(votaciones, key=lambda v: (v["fecha"], v.get("id", ""))):
        if not v.get("tipo", "").startswith("Convalidación"):
            continue
        n = rdl(v.get("titulo", "")) or rdl(v.get("texto", ""))
        if not n:
            continue
        num = lambda k: int(v.get(k) or 0)  # noqa: B023 (se usa solo en esta iteración)
        # Los datos de la web no traen «aprobada»: entonces decide la mayoría simple, como en la convalidación.
        voto = {"id": v.get("id"), "fecha": v["fecha"], "si": num("si"), "no": num("no"), "abst": num("abst"),
                "aprobada": str(v["aprobada"]) == "True" if v.get("aprobada") is not None else num("si") > num("no")}
        (tram if v.get("titulo", "").startswith("Tramitación") else conv)[n] = voto
    hoy = hoy or date.today()
    out = []
    for a in leyes.get("aprobadas", []):
        if not _es_rdl(a) or not a.get("fecha"):
            continue
        n = a.get("numero") or rdl(a["titulo"])
        c, t = conv.get(n), tram.get(n)
        estado = ("convalidado" if c["aprobada"] else "derogado") if c else "pendiente"
        out.append({"numero": n, "titulo": a["titulo"], "fecha": a["fecha"], "pdf": a.get("pdf", ""), "estado": estado,
                    "voto": c, "proyecto": t["aprobada"] if t else None, "voto_proyecto": t})
    return sorted(out, key=lambda d: (d["fecha"], int(d["numero"].split("/")[0]) if d["numero"] else 0))


def _es_rdl(a: dict) -> bool:
    """El texto de un real decreto-ley (no las resoluciones que publican su convalidación o derogación)."""
    return a["tipo"] == "Real decreto-ley" and a["titulo"].startswith("Real Decreto-ley")


def relevos(fichas: dict) -> dict:
    """Los diputados que dejaron el escaño durante la legislatura y quién entró en su lugar: el siguiente que da de alta
    su misma lista (provincia y formación) desde el día en que se fue. `fichas`: data/diputados.json."""
    salen = sorted(((n, f) for n, f in fichas.items() if f.get("baja")), key=lambda x: (x[1]["baja"], x[0]))
    usados, out = set(), []
    for n, f in salen:
        entra = min((m for m, g in fichas.items() if m != n and m not in usados and g.get("circunscripcion") == f.get("circunscripcion")
                     and g.get("formacion") == f.get("formacion") and (g.get("alta") or "") >= f["baja"]),
                    key=lambda m: (fichas[m].get("alta") or "", m), default=None)
        if entra:
            usados.add(entra)
        out.append([n, entra, f["baja"], f.get("circunscripcion", ""), f.get("formacion", "")])
    return {"personas": len(fichas), "salidas": sorted(out, key=lambda x: (x[2], x[0]), reverse=True)}


def dia_a_dia(salida: dict, hasta: date = CONVOCATORIA) -> dict:
    """La legislatura día a día, para «La legislatura en cifras»: qué pasó cada día (votaciones, leyes, decretos-leyes
    y preguntas registradas) y cada votación nominal con su resultado (para el histograma de márgenes): la web solo
    tiene en memoria las del periodo que se está viendo."""
    from .construir import titulo_votacion
    d = salida["datos"]
    leyes = salida.get("leyes") or {"iniciativas": [], "aprobadas": []}
    dias: dict[str, list[int]] = {}
    suma = lambda f, k: dias.setdefault(f, [0, 0, 0, 0]).__setitem__(k, dias[f][k] + 1)
    votos = []
    for v in d["votaciones"]:
        if v["fecha"] > hasta.isoformat():
            continue
        suma(v["fecha"], 0)
        si, no = int(v.get("si") or 0), int(v.get("no") or 0)
        if si + no:
            t = titulo_votacion(v.get("titulo") or "", v.get("subgrupo", ""))
            votos.append([v["id"], v["fecha"], t if len(t) <= 110 else t[:108].rsplit(" ", 1)[0] + "…", si, no])
    for a in leyes.get("aprobadas", []):
        if a.get("fecha") and a["fecha"] <= hasta.isoformat():
            if a["tipo"] in ("Ley", "Ley orgánica"):
                suma(a["fecha"], 1)
            elif _es_rdl(a):
                suma(a["fecha"], 2)
    for q in salida.get("preguntas") or []:
        if q.get("presentada") and "2023-08-17" <= q["presentada"] <= hasta.isoformat():
            suma(q["presentada"], 3)
    return {"desde": "2023-08-17", "hasta": hasta.isoformat(), "campos": ["votaciones", "leyes", "decretos", "preguntas"],
            "dias": dict(sorted(dias.items())), "votos": sorted(votos, key=lambda x: (x[1], x[0]))}


def balance(salida: dict) -> dict:
    """La XV legislatura en cifras, de la sesión constitutiva a la disolución."""
    d = salida["datos"]
    votos = d["votaciones"]
    plenos = {v["fecha"] for v in votos}
    margen = lambda v: abs(v["si"] - v["no"])
    ajustadas = [v for v in votos if v["si"] + v["no"] > 300 and margen(v) <= 10]
    leyes = salida.get("leyes") or {"iniciativas": [], "aprobadas": []}
    aprobadas = Counter(a["tipo"] for a in leyes["aprobadas"] if a["tipo"] != "Real decreto-ley" or _es_rdl(a))
    preguntas = salida.get("preguntas") or []
    estrecha = min(votos, key=lambda v: (margen(v), -(v["si"] + v["no"])), default=None)
    return {
        "desde": "2023-08-17", "hasta": CONVOCATORIA.isoformat(),
        "plenos": len(plenos), "votaciones": len(votos), "ajustadas": len(ajustadas),
        "sesiones": len(d["sesiones"]), "intervenciones": len(salida.get("intervenciones") or []),
        "leyes": aprobadas.get("Ley", 0), "leyes_organicas": aprobadas.get("Ley orgánica", 0),
        "decretos_ley": aprobadas.get("Real decreto-ley", 0),
        "convalidados": sum(x["estado"] == "convalidado" for x in decretos(leyes, votos)),
        "derogados": sum(x["estado"] == "derogado" for x in decretos(leyes, votos)),
        "preguntas": len(preguntas), "sin_respuesta": sum(p.get("estado") == "pendiente" for p in preguntas),
        "diputados": len(d["diputados"]),
        "mas_ajustada": {"id": estrecha["id"], "fecha": estrecha["fecha"], "titulo": estrecha["titulo"],
                         "si": estrecha["si"], "no": estrecha["no"]} if estrecha else None,
    }


def escribir(salida: dict, carpeta=None) -> None:
    """Escribe los datos de la sección y copia lo versionado (geometrías, histórico, candidaturas)."""
    carpeta = carpeta or SALIDA
    carpeta.mkdir(parents=True, exist_ok=True)
    leyes = salida.get("leyes") or {"iniciativas": [], "aprobadas": []}
    datos = {
        "convocatoria": CONVOCATORIA.isoformat(), "votacion": VOTACION.isoformat(),
        "calendario": calendario(),
        "decreto": DECRETO,
        "escanos": ESCANOS,
        "escanos_cambian": escanos_cambian(),
        "relevos": relevos(_fichas_diputados()),
        "padron": padron(),
        "caducan": caducan(leyes),
        "convalidar": pendientes_de_convalidar(leyes, salida["datos"]["votaciones"]),
        "decretos": decretos(leyes, salida["datos"]["votaciones"]),
        "balance": balance(salida),
        # Qué piezas que llegan más tarde ya están (la web no pide lo que no existe).
        "hay": {n: (CARPETA / f"{n}.json").exists() for n in ("candidaturas", "promesas", "resultados")},
    }
    (carpeta / "elecciones.json").write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")))
    # La legislatura día a día (para «La legislatura en cifras»): aparte, porque solo lo pide ese apartado.
    (carpeta / "legislatura.json").write_text(json.dumps(dia_a_dia(salida), ensure_ascii=False, separators=(",", ":")))
    # El viaje de cada ley (para «Lo que caduca»): aparte, porque solo lo pide ese apartado.
    (carpeta / "viajes.json").write_text(json.dumps(viajes(leyes), ensure_ascii=False, separators=(",", ":")))
    for f in sorted(CARPETA.rglob("*.json")):   # con las subcarpetas (provincias/)
        destino = carpeta / f.relative_to(CARPETA)
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(f, destino)


# ---------- reparto de escaños (art. 163 de la LOREG) ----------

def dhondt(votos: dict[str, int], escanos: int, validos: int | None = None, barrera: float = 0.03) -> dict:
    """Reparto D'Hondt de una circunscripción.

    `votos`: votos de cada candidatura; `validos`: votos válidos (candidaturas + en blanco), sobre los que se mide
    la barrera del 3 %. Devuelve los escaños de cada candidatura, los cocientes ganadores en orden y el último
    escaño: quién lo ganó, quién se quedó más cerca y cuántos votos más le habrían hecho falta.
    """
    validos = validos if validos is not None else sum(votos.values())
    entran = {c: v for c, v in votos.items() if v > 0 and v >= barrera * validos}
    cocientes = sorted(((v / d, v, c) for c, v in entran.items() for d in range(1, escanos + 1)),
                       key=lambda t: (-t[0], -t[1], t[2]))
    ganadores = cocientes[:escanos]
    reparto: dict[str, int] = {}
    for _, _, c in ganadores:
        reparto[c] = reparto.get(c, 0) + 1
    ultimo = None
    if ganadores:
        q, _, quien = ganadores[-1]
        # El primer cociente que se quedó fuera, de una candidatura distinta a la que ganó el último escaño.
        siguiente = next(((q2, c2) for q2, _, c2 in cocientes[escanos:] if c2 != quien), None)
        if siguiente:
            _, otro = siguiente
            # Votos que le faltaban a `otro` para que su siguiente cociente superara al último ganador.
            faltan = int(q * (reparto.get(otro, 0) + 1)) - entran[otro] + 1
            ultimo = {"gana": quien, "cociente": round(q, 2), "segundo": otro, "faltan": max(faltan, 1)}
        else:
            ultimo = {"gana": quien, "cociente": round(q, 2)}
    return {"escanos": reparto, "ultimo": ultimo,
            "fuera": sorted(c for c, v in votos.items() if v > 0 and c not in entran)}


def votos_sin_escano(votos: dict[str, int], reparto: dict[str, int]) -> int:
    """Votos a candidaturas que se quedaron sin ningún escaño en la circunscripción."""
    return sum(v for c, v in votos.items() if not reparto.get(c))
