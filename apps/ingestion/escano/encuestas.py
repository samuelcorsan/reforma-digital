"""Encuestas, proyección y mercados para las generales del 29N.

- `encuestas.json`: las encuestas publicadas desde las generales de 2023 (la tabla «Voting intention estimates» de
  Wikipedia, que recoge la estimación de voto y de escaños de cada encuestadora) y la media de todas ellas día a día.
- `proyeccion.json`: los escaños que salen de esa media (proyeccion.py): la proyección central, las simulaciones y
  la central semana a semana.
- `mercados.json`: lo que apuestan en Polymarket (quién gana, quién preside, cuándo se va Sánchez), hoy y día a día.
- `aciertos.json`: cuánto acertaron las encuestas en las generales de 2015 a 2023 (aciertos.py), y la proyección de
  hoy si fallaran como entonces.

    python -m escano.encuestas        # descarga lo último y escribe data/encuestas/*.json

La ley electoral (LOREG, art. 69.7) prohíbe publicar, difundir o reproducir encuestas los cinco días anteriores a
la votación: del 24 de noviembre a las 20.00 del 29, la web no las enseña (lo decide la propia página con la fecha
de hoy) y este script no actualiza nada.
"""
from __future__ import annotations

import json
import math
import re
import shutil
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

from .config import DATOS, USER_AGENT

CARPETA = DATOS / "encuestas"
WIKIPEDIA = ("https://en.wikipedia.org/w/api.php?action=parse&page=Opinion_polling_for_the_2026_Spanish_general_election"
             "&prop=text&format=json&formatversion=2&redirects=1")
ELECCION = date(2026, 11, 29)
VEDA = (date(2026, 11, 24), datetime(2026, 11, 29, 20, 0))   # del 24-N a las 20.00 del 29-N, hora peninsular

# Partidos de la tabla: el rótulo de su columna en Wikipedia → id, nombre y color (los de la web). Frente Amplio (FA)
# sucede a Sumar desde octubre de 2026: las dos columnas son la misma serie.
PARTIDOS = {
    "PP": ("PP", "PP", "#2C7BC4"),
    "PSOE": ("PSOE", "PSOE", "#D8342B"),
    "Vox": ("VOX", "Vox", "#5BA83A"),
    "FA": ("SUMAR", "Frente Amplio", "#D9701A"),
    "Sumar": ("SUMAR", "Frente Amplio", "#D9701A"),
    "Podemos": ("PODEMOS", "Podemos", "#7B4BA8"),
    "Se Acabó La Fiesta": ("SALF", "SALF", "#8A6D4E"),
    "ERC": ("ERC", "ERC", "#E0A410"),
    "Junts": ("JUNTS", "Junts", "#1FA8A0"),
    "EH Bildu": ("BILDU", "Bildu", "#86A832"),
    "PNV": ("PNV", "PNV", "#2F7A4A"),
    "BNG": ("BNG", "BNG", "#6FB2DE"),
    "CCa": ("CC", "CC", "#E8C21B"),
    "UPN": ("UPN", "UPN", "#1D4F91"),
    "Aliança.cat": ("ALIANCA", "Aliança", "#3E4C7A"),
    "Adelante Andalucía (2021)": ("AA", "Adelante Andalucía", "#3C9A5A"),
}
AGREGADORES = {"KeyData"}   # medias de encuestas que la tabla recoge como si fueran una más
MESES = {m: i for i, m in enumerate(("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1)}


# ---------- la tabla de Wikipedia ----------

def _rejilla(tabla) -> list[list]:
    """Las filas de una tabla HTML como rejilla, repitiendo las celdas con rowspan/colspan donde caen."""
    filas, pendientes = [], {}   # pendientes: columna → (celda, filas que le quedan)
    for tr in tabla.find_all("tr"):
        fila, col = [], 0
        celdas = tr.find_all(["td", "th"], recursive=False)
        i = 0
        while i < len(celdas) or col in pendientes:
            if col in pendientes:
                celda, quedan = pendientes[col]
                fila.append(celda)
                if quedan > 1:
                    pendientes[col] = (celda, quedan - 1)
                else:
                    del pendientes[col]
                col += 1
                continue
            celda = celdas[i]; i += 1
            for _ in range(int(celda.get("colspan", 1) or 1)):
                fila.append(celda)
                if int(celda.get("rowspan", 1) or 1) > 1:
                    pendientes[col] = (celda, int(celda["rowspan"]) - 1)
                col += 1
        filas.append(fila)
    return filas


def _texto(celda) -> str:
    for sup in celda.find_all("sup"):
        sup.decompose()
    return celda.get_text(" ", strip=True)


def _fechas(txt: str, anio: int) -> tuple[str | None, str | None]:
    """«7–8 Oct», «29 Dec–5 Jan», «31 Dec»: inicio y fin del trabajo de campo (el año es el de la tabla, el del fin)."""
    partes = [p.strip() for p in re.split(r"[–-]", txt) if p.strip()]
    if not partes:
        return None, None
    def leer(p, mes_def=None):
        m = re.match(r"(\d{1,2})\s*([A-Z][a-z]{2})?", p)
        if not m:
            return None, None
        return int(m.group(1)), (MESES.get(m.group(2)) if m.group(2) else mes_def)
    d2, m2 = leer(partes[-1])
    if not m2:
        return None, None
    d1, m1 = leer(partes[0], m2) if len(partes) > 1 else (d2, m2)
    fin = date(anio, m2, d2)
    ini = date(anio - (1 if m1 > m2 else 0), m1, d1)
    return ini.isoformat(), fin.isoformat()


def _numero(txt: str) -> float | None:
    txt = txt.replace(",", "")
    return float(txt) if re.fullmatch(r"\d+(\.\d+)?", txt) else None


def _celda_partido(txt: str) -> tuple[float | None, list[int] | None]:
    """«31.9 123/140» → (31.9, [123, 140]); «? 8» → (None, [8, 8]); «–» → (None, None)."""
    trozos = txt.split()
    pct = _numero(trozos[0]) if trozos else None
    esc = None
    if len(trozos) > 1 and re.fullmatch(r"\d+(/\d+)?", trozos[1]):
        a, _, b = trozos[1].partition("/")
        esc = [int(a), int(b or a)]
    return pct, esc


def leer_wikipedia(html: str) -> tuple[list[dict], dict | None]:
    """Las encuestas de las tablas «Voting intention estimates» (una por año, de la más reciente a 2023)."""
    from bs4 import BeautifulSoup   # aquí y no arriba: el build de Vercel solo copia los JSON y no instala bs4
    soup = BeautifulSoup(html, "html.parser")
    tablas = [t for t in soup.select("table.wikitable")
              if (h := t.find_previous(["h2", "h3", "h4"])) and "Voting intention" in h.get_text()]
    encuestas, resultado = [], None
    for k, tabla in enumerate(tablas):
        rej = _rejilla(tabla)
        if len(rej) < 3:
            continue
        cab = []
        for celda in rej[0]:
            a, img = celda.find("a"), celda.find("img")
            cab.append((a.get("title") if a else None) or (img.get("alt") if img else None) or celda.get_text(strip=True))
        # Las fechas de cada fila no llevan año: es el del título de su tabla («2025», «2026 (with Broad Front)»; un año
        # puede tener más de una). Sin él, las tablas van de la más nueva hacia atrás, una por año.
        titulo = tabla.find_previous("h5")
        anio = int(m.group(1)) if titulo and (m := re.search(r"\b(20\d\d)\b", titulo.get_text())) else ELECCION.year - k
        for fila in rej[2:]:
            if len(fila) < 6 or any(c.get("colspan") and int(c.get("colspan")) > 3 for c in fila[:2]):
                continue
            textos = [_texto(c) for c in fila]
            firma = textos[0]
            if not firma or not cab:
                continue
            ini, fin = _fechas(textos[1], anio)
            if "general election" in firma.lower():
                resultado = {"fecha": fin, "v": {}, "e": {}}
            reg = {"empresa": firma, "ini": ini, "fin": fin, "n": _numero(textos[2]) if len(textos) > 2 else None,
                   "part": _numero(textos[3]) if len(textos) > 3 else None, "v": {}, "e": {}}
            for col, nombre in enumerate(cab):
                if nombre not in PARTIDOS or col >= len(textos):
                    continue
                pid = PARTIDOS[nombre][0]
                pct, esc = _celda_partido(textos[col])
                if pct is not None:
                    reg["v"][pid] = pct
                if esc:
                    reg["e"][pid] = esc
            if "general election" in firma.lower():
                resultado.update(v=reg["v"], e=reg["e"], part=reg["part"])
                continue
            if not fin or not reg["v"]:
                continue
            empresa, _, medio = firma.partition("/")
            reg["empresa"], reg["medio"] = empresa.strip(), medio.strip()
            reg["cis"] = empresa.strip().upper().startswith("CIS")
            if empresa.strip() in AGREGADORES:
                reg["agregador"] = True   # una media de encuestas, no una encuesta: fuera de la media para no contar dos veces
            encuestas.append(reg)
    encuestas.sort(key=lambda e: (e["fin"], e["empresa"]), reverse=True)
    return encuestas, resultado


# ---------- la media ----------

def media(encuestas: list[dict], hasta: date, desde: date = date(2023, 8, 1), tau: float = 21, ventana: int = 45) -> dict:
    """La media de las encuestas cada día: de cada empresa, solo su última encuesta en los `ventana` días anteriores,
    con un peso que se apaga con la antigüedad (exponencial, `tau` días) y crece (poco) con la muestra. Sin el CIS,
    cuya estimación se aparta sistemáticamente del resto, ni las medias de otros (KeyData). Devuelve, por partido, la media y la dispersión (desviación
    típica ponderada de las encuestas), un punto por día."""
    validas = [e for e in encuestas if not e.get("cis") and not e.get("agregador") and e.get("fin")]
    partidos = sorted({p for e in validas for p in e["v"]})
    dias, series = [], {p: {"m": [], "s": []} for p in partidos}
    d = desde
    while d <= hasta:
        tope = d - timedelta(days=ventana)
        ultimas = {}
        for e in validas:
            f = date.fromisoformat(e["fin"])
            if tope < f <= d and (e["empresa"] not in ultimas or e["fin"] > ultimas[e["empresa"]]["fin"]):
                ultimas[e["empresa"]] = e
        dias.append(d.isoformat())
        for p in partidos:
            pares = [(e["v"][p], math.exp(-(d - date.fromisoformat(e["fin"])).days / tau) * math.sqrt(min(e.get("n") or 1000, 3000) / 1000))
                     for e in ultimas.values() if p in e["v"]]
            w = sum(x for _, x in pares)
            if w <= 0 or len(pares) < 2:
                series[p]["m"].append(None); series[p]["s"].append(None)
                continue
            m = sum(v * x for v, x in pares) / w
            s = math.sqrt(sum(x * (v - m) ** 2 for v, x in pares) / w)
            series[p]["m"].append(round(m, 2)); series[p]["s"].append(round(s, 2))
        d += timedelta(days=1)
    return {"dias": dias, "partidos": series}


# ---------- los mercados (Polymarket) ----------

POLYMARKET = "https://gamma-api.polymarket.com/events?slug={}"
HISTORIA = "https://clob.polymarket.com/prices-history?market={}&interval=max&fidelity=1440"
# Los mercados abiertos sobre las generales: su pregunta en castellano y qué es cada uno.
MERCADOS = [
    ("spain-general-election-winner", "¿Qué partido gana las elecciones?", "ganador"),
    ("next-prime-minister-of-spain-20260625005215443", "¿Quién será el próximo presidente del Gobierno?", "presidente"),
    ("pedro-snchez-out-as-pm-of-spain-by", "¿Deja Sánchez de ser presidente antes de 2027?", "fuera"),
]
MESES_EN = {m: i for i, m in enumerate(("January", "February", "March", "April", "May", "June", "July", "August", "September",
                                         "October", "November", "December"), 1)}
MESES_ES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre")


def _opcion_es(nombre: str) -> str:
    """«December 31, 2026» → «31 de diciembre de 2026»; los nombres de personas y partidos, igual."""
    m = re.fullmatch(r"([A-Z][a-z]+) (\d{1,2}), (\d{4})", nombre or "")
    return f"{int(m.group(2))} de {MESES_ES[MESES_EN[m.group(1)] - 1]} de {m.group(3)}" if m and m.group(1) in MESES_EN else nombre


def mercados() -> list[dict]:
    """Cada mercado: la probabilidad que le dan las apuestas a cada opción hoy, su historia día a día y el dinero
    apostado. Solo las opciones que alguien ha apostado y que siguen abiertas."""
    out = []
    for slug, pregunta, tipo in MERCADOS:
        try:
            ev = json.loads(_bajar(POLYMARKET.format(slug)))[0]
        except Exception as e:   # sin red o sin mercado: se queda fuera, sin romper lo demás
            print(f"Polymarket: no se ha podido leer {slug} ({e})")
            continue
        opciones = []
        for m in ev.get("markets", []):
            if float(m.get("volume") or 0) <= 0 or m.get("closed"):
                continue
            precio = float(json.loads(m.get("outcomePrices") or "[0]")[0])
            token = (json.loads(m.get("clobTokenIds") or "[]") or [None])[0]
            opciones.append({"nombre": _opcion_es(m.get("groupItemTitle") or m.get("question")), "p": round(precio, 4),
                             "vol": round(float(m.get("volume") or 0)), "token": token})
        opciones.sort(key=lambda o: -o["p"])
        for o in opciones[:6]:   # la historia, de las que cuentan
            try:
                h = json.loads(_bajar(HISTORIA.format(o["token"]))).get("history", [])
                dias = {}
                for x in h:
                    dias[datetime.fromtimestamp(x["t"], timezone.utc).date().isoformat()] = round(float(x["p"]), 4)
                o["hist"] = sorted(dias.items())
            except Exception:
                o["hist"] = []
        for o in opciones:
            o.pop("token", None)
        out.append({"slug": slug, "pregunta": pregunta, "tipo": tipo, "titulo": ev.get("title"),
                    "url": f"https://polymarket.com/event/{slug}", "volumen": round(float(ev.get("volume") or 0)),
                    "inicio": (ev.get("creationDate") or ev.get("startDate") or "")[:10], "fin": (ev.get("endDate") or "")[:10],
                    "opciones": opciones})
    return out


# ---------- escribir ----------

def _bajar(url: str) -> str:
    r = requests.get(url, headers={"User-Agent": f"{USER_AGENT} (https://github.com/jorgegarcelan/escano-abierto)"}, timeout=60)
    r.raise_for_status()
    return r.text


def en_veda(ahora: datetime | None = None) -> bool:
    ahora = ahora or datetime.now(timezone(timedelta(hours=1)))   # noviembre: hora peninsular de invierno
    return VEDA[0] <= ahora.date() and ahora.replace(tzinfo=None) < VEDA[1]


def construir_datos(hoy: date | None = None) -> dict:
    hoy = hoy or date.today()
    html = json.loads(_bajar(WIKIPEDIA))["parse"]["text"]
    encuestas, resultado = leer_wikipedia(html)
    return {
        "actualizado": hoy.isoformat(), "eleccion": ELECCION.isoformat(), "veda": [VEDA[0].isoformat(), VEDA[1].isoformat(timespec="minutes")],
        "fuente": "https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Spanish_general_election",
        "partidos": [{"id": pid, "nombre": nom, "color": col} for pid, nom, col in dict.fromkeys(PARTIDOS.values())],
        "resultado2023": resultado, "encuestas": encuestas,
        "media": media(encuestas, min(hoy, ELECCION)),
    }


def congeladas(ahora: datetime | None = None) -> bool:
    """Desde el 24-N no se actualiza nada: primero la veda; después, ya hay resultados y las encuestas son historia."""
    ahora = ahora or datetime.now(timezone(timedelta(hours=1)))
    return ahora.date() >= VEDA[0]


def escribir_datos() -> dict:
    if congeladas():
        print("Encuestas congeladas desde el 24-N (veda electoral, LOREG art. 69.7, y después los resultados): no se actualizan.")
        return json.loads((CARPETA / "encuestas.json").read_text())
    datos = construir_datos()
    CARPETA.mkdir(parents=True, exist_ok=True)
    (CARPETA / "encuestas.json").write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")))
    merc = mercados()
    if merc:
        (CARPETA / "mercados.json").write_text(json.dumps({"actualizado": datos["actualizado"], "veda": datos["veda"], "mercados": merc},
                                                           ensure_ascii=False, separators=(",", ":")))
    from . import aciertos     # cuánto acertaron las encuestas de 2015 a 2023 (páginas que ya no cambian: caché)
    try:
        ac = aciertos.analizar()
        hoy_m = {p: s["m"][-1] for p, s in datos["media"]["partidos"].items() if s["m"] and s["m"][-1]}
        ac["escenarios"] = aciertos.escenarios(ac, hoy_m)
        (CARPETA / "aciertos.json").write_text(json.dumps(ac, ensure_ascii=False, separators=(",", ":")))
    except Exception as e:
        print(f"Aciertos: no se ha podido analizar ({e})")
    from . import proyeccion   # la proyección de escaños, con la media de hoy
    proy = proyeccion.construir(datos["media"], [p["id"] for p in datos["partidos"]], datos["actualizado"])
    (CARPETA / "proyeccion.json").write_text(json.dumps(proy, ensure_ascii=False, separators=(",", ":")))
    return datos


def escribir(carpeta: Path) -> None:
    """Copia a la web lo que haya en data/encuestas (lo descarga `python -m escano.encuestas`)."""
    if not CARPETA.exists():
        return
    carpeta.mkdir(parents=True, exist_ok=True)
    for f in sorted(CARPETA.glob("*.json")):
        shutil.copyfile(f, carpeta / f.name)


if __name__ == "__main__":
    from .config import SITIO
    d = escribir_datos()
    escribir(SITIO / "datos" / "encuestas")   # y a la web, sin esperar a reconstruir todo
    print(f"{len(d['encuestas'])} encuestas, de {d['encuestas'][-1]['fin']} a {d['encuestas'][0]['fin']}")
    ult = {p: s["m"][-1] for p, s in d["media"]["partidos"].items() if s["m"] and s["m"][-1] is not None}
    print("media de hoy:", ", ".join(f"{p} {v:.1f}" for p, v in sorted(ult.items(), key=lambda t: -t[1])))
    sys.exit(0)
