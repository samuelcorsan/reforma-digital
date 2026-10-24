"""Proyección de escaños para el 29N a partir de la media de las encuestas.

El modelo, paso a paso (lo cuenta también la página):

1. La media de las encuestas (encuestas.py) da el voto de cada partido en toda España.
2. Ese voto se lleva a cada provincia desde su resultado de 2023 (swing proporcional): si un partido sube un 50 % en
   España, sube un 50 % en cada provincia. Podemos, que en 2023 fue dentro de Sumar, hereda el perfil provincial de
   Sumar; Se Acabó La Fiesta, a medias el reparto uniforme y el de Vox; Aliança Catalana y Adelante Andalucía, solo en
   su comunidad y por igual en sus provincias.
3. En cada provincia, la ley D'Hondt con los escaños de 2026 y la barrera del 3 %.
4. La incertidumbre: miles de simulaciones con el error típico de las encuestas (más grande cuanto mayor es el partido)
   y un ruido provincial; de ahí los intervalos y las probabilidades.
"""
from __future__ import annotations

import heapq
import json
import math
import random
from datetime import date

from .config import DATOS
from .elecciones import ESCANOS

CATALUNA, ANDALUCIA = ("08", "17", "25", "43"), ("04", "11", "14", "18", "21", "23", "29", "41")
REGIONALES = {"ALIANCA": CATALUNA, "AA": ANDALUCIA}
# Familias de la base de 2023 (historico-202307.json) → partido de las encuestas.
FAMILIA = {"PP": "PP", "PSOE": "PSOE", "VOX": "VOX", "IZQ": "SUMAR", "BILDU": "BILDU", "ERC": "ERC", "CIU": "JUNTS",
           "PNV": "PNV", "BNG": "BNG", "CC": "CC"}
POR_SIGLAS = {"U.P.N.": "UPN", "UPN": "UPN", "ADELANTE ANDALUCÍA": "AA"}
BLOQUES = {
    "PP + Vox": ["PP", "VOX"],
    "PSOE y sus socios de 2023": ["PSOE", "SUMAR", "PODEMOS", "ERC", "JUNTS", "BILDU", "PNV", "BNG", "CC"],
    "PSOE + Frente Amplio + Podemos": ["PSOE", "SUMAR", "PODEMOS"],
}
SD_PROVINCIA = 0.10      # ruido provincial (multiplicativo, en logaritmos)
K_ERROR = 0.35           # error nacional de cada partido: 0,35·√(voto), en puntos (PP al 32 %, ±2; Sumar al 6 %, ±0,9)


def base_2023() -> dict:
    """El voto de 2023 en cada provincia, ya en partidos de las encuestas: {provincia: {partido: cuota}} y el total
    nacional de cada partido (cuota de los votos válidos de toda España)."""
    D = json.loads((DATOS / "elecciones" / "historico-202307.json").read_text())
    prov, tot, validos = {}, {}, 0
    for cod, p in D["prov"].items():
        cuotas = {}
        for sig, fam, v, _ in p["c"]:
            pid = POR_SIGLAS.get(sig) or FAMILIA.get(fam, "OTROS")
            cuotas[pid] = cuotas.get(pid, 0) + v / p["validos"]
            tot[pid] = tot.get(pid, 0) + v
        prov[cod] = cuotas
        validos += p["validos"]
    peso = {cod: p["validos"] / validos for cod, p in D["prov"].items()}
    return {"prov": prov, "nacional": {k: v / validos for k, v in tot.items()}, "peso": peso}


def dhondt(cuotas: dict[str, float], escanos: int, barrera: float = 0.03) -> dict[str, int]:
    """Reparto D'Hondt de `escanos` entre las cuotas (fracción de los votos válidos) que pasan la barrera."""
    entran = {p: c for p, c in cuotas.items() if p != "OTROS" and c >= barrera and c > 0}
    if not entran:
        return {}
    monton = [(-c, p, 1) for p, c in entran.items()]
    heapq.heapify(monton)
    rep: dict[str, int] = {}
    for _ in range(escanos):
        q, p, d = heapq.heappop(monton)
        rep[p] = rep.get(p, 0) + 1
        heapq.heappush(monton, (-entran[p] / (d + 1), p, d + 1))
    return rep


def cuotas_provincia(media: dict[str, float], base: dict, cod: str, ruido: dict | None = None) -> dict[str, float]:
    """El voto de cada partido en una provincia, con la media nacional `media` (en tanto por uno)."""
    b, nac = base["prov"][cod], base["nacional"]
    out = {}
    for p, a in media.items():
        if a <= 0:
            continue
        if p == "PODEMOS":
            perfil = b.get("SUMAR", 0) / nac["SUMAR"] if nac.get("SUMAR") else 1
        elif p == "SALF":
            perfil = 0.5 + 0.5 * (b.get("VOX", 0) / nac["VOX"] if nac.get("VOX") else 1)
        elif p in REGIONALES:
            region = REGIONALES[p]
            if cod not in region:
                continue
            perfil = 1 / sum(base["peso"][c] for c in region)   # su voto nacional, todo en su comunidad
        elif p in nac and nac[p] > 0:
            perfil = b.get(p, 0) / nac[p]
        else:
            perfil = 1
        v = a * perfil
        if ruido is not None and v > 0:
            v *= ruido.setdefault((cod, p), math.exp(random.gauss(0, SD_PROVINCIA)))
        if v > 0:
            out[p] = v
    otros = b.get("OTROS", 0)
    total = sum(out.values()) + otros
    if total > 0.99:   # que con el voto en blanco no pase del 100 %
        f = (0.99 - otros) / sum(out.values())
        out = {p: v * f for p, v in out.items()}
    out["OTROS"] = otros
    return out


def proyectar(media: dict[str, float], base: dict, ruido: dict | None = None, escanos: dict | None = None) -> tuple[dict, dict]:
    """Escaños de cada partido en cada provincia y en total (con el reparto de 2026, salvo que se dé otro)."""
    por_prov, total = {}, {}
    for cod, n in (escanos or ESCANOS).items():
        rep = dhondt(cuotas_provincia(media, base, cod, ruido), n)
        por_prov[cod] = rep
        for p, e in rep.items():
            total[p] = total.get(p, 0) + e
    return por_prov, total


def _percentil(xs: list[int], q: float) -> int:
    s = sorted(xs)
    return s[min(len(s) - 1, max(0, int(round(q * (len(s) - 1)))))]


def simular(media: dict[str, float], base: dict, n: int = 4000, semilla: int = 29) -> dict:
    """Las simulaciones: en cada una, un error nacional para cada partido y un ruido en cada provincia."""
    random.seed(semilla)
    partidos = list(media)
    escanos = {p: [] for p in partidos}
    bloques = {b: [] for b in BLOQUES}
    primero = {p: 0.0 for p in partidos}
    for _ in range(n):
        m = {p: max(0.0005, a + random.gauss(0, K_ERROR * math.sqrt(a * 100)) / 100) for p, a in media.items()}
        _, tot = proyectar(m, base, ruido={})
        for p in partidos:
            escanos[p].append(tot.get(p, 0))
        for b, ps in BLOQUES.items():
            bloques[b].append(sum(tot.get(p, 0) for p in ps))
        top = max(tot.values()) if tot else 0
        ganan = [p for p in partidos if tot.get(p, 0) == top]
        for p in ganan:
            primero[p] += 1 / len(ganan)
    hist = lambda xs: [xs.count(k) for k in range(max(xs) + 1)] if xs else []
    return {
        "n": n,
        "partidos": {p: {"med": _percentil(xs, .5), "p05": _percentil(xs, .05), "p95": _percentil(xs, .95),
                         "media": round(sum(xs) / n, 1), "hist": hist(xs)} for p, xs in escanos.items() if max(xs) > 0},
        "bloques": {b: {"partidos": BLOQUES[b], "med": _percentil(xs, .5), "p05": _percentil(xs, .05), "p95": _percentil(xs, .95),
                        "p176": round(sum(1 for x in xs if x >= 176) / n, 3), "hist": hist(xs)} for b, xs in bloques.items()},
        "primero": {p: round(v / n, 3) for p, v in primero.items() if v > 0},
        "solo176": {p: round(sum(1 for x in xs if x >= 176) / n, 3) for p, xs in escanos.items() if any(x >= 176 for x in xs)},
    }


def ultimos_escanos(media: dict[str, float], base: dict) -> dict:
    """En cada provincia, el último escaño de la proyección central y el siguiente cociente: cuánto (en puntos de
    voto de esa provincia) le falta al segundo para quitárselo al primero."""
    out = {}
    for cod, n in ESCANOS.items():
        c = cuotas_provincia(media, base, cod)
        entran = {p: v for p, v in c.items() if p != "OTROS" and v >= 0.03}
        rep = dhondt(c, n)
        ult = min(((v / rep[p], p) for p, v in entran.items() if rep.get(p)), default=None)
        coc = sorted(((v / (rep.get(p, 0) + 1), p) for p, v in entran.items() if not ult or p != ult[1]), reverse=True)   # otro partido
        if not ult or not coc:
            continue
        sig = coc[0]
        # Para pasar al último, el segundo necesita que su cociente supere al del último: (q_ult·(n+1) − v) de voto.
        falta = ult[0] * (rep.get(sig[1], 0) + 1) - entran[sig[1]]
        out[cod] = {"gana": ult[1], "segundo": sig[1], "falta": round(falta * 100, 2)}
    return out


def construir(media_serie: dict, partidos_ids: list[str], hoy: str) -> dict:
    """La proyección de hoy (central, simulaciones y por provincia) y la central semana a semana."""
    base = base_2023()
    dias = media_serie["dias"]
    def media_en(i):
        m = {p: (s["m"][i] or 0) / 100 for p, s in media_serie["partidos"].items() if s["m"][i]}
        return {p: v for p, v in m.items() if v > 0}
    hoy_i = len(dias) - 1
    m_hoy = media_en(hoy_i)
    por_prov, central = proyectar(m_hoy, base)
    serie = []
    for i in range(0, len(dias), 7):
        if i + 7 > len(dias) - 1:
            i = len(dias) - 1
        m = media_en(i)
        if len(m) < 9:   # al principio (verano de 2023) solo hay media de los grandes: hincharía sus escaños
            continue
        _, tot = proyectar(m, base)
        serie.append([dias[i], tot])
        if i == len(dias) - 1:
            break
    sim = simular(m_hoy, base)
    votos = {cod: {p: round(v * 100, 1) for p, v in cuotas_provincia(m_hoy, base, cod).items() if p != "OTROS" and v >= .005} for cod in ESCANOS}
    return {"fecha": hoy, "media": {p: round(v * 100, 2) for p, v in m_hoy.items()}, "central": central,
            "provincias": por_prov, "votos": votos, "ultimos": ultimos_escanos(m_hoy, base), "simulacion": sim, "serie": serie,
            "escanos2026": ESCANOS, "bloques": BLOQUES,
            "base2023": {p: round(v * 100, 2) for p, v in base_2023()["nacional"].items()}}
