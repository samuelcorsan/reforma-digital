"""Geometrías de España para los mapas de la sección de elecciones.

Sale del TopoJSON de `es-atlas` (IGN, con códigos INE) y se proyecta aquí, en Python, para que la web no necesite
librerías: cada provincia y cada municipio es un `path` de SVG ya dibujado en un lienzo de ANCHO × ALTO.
Canarias se acerca a la península, abajo a la izquierda, con su recuadro, como en los mapas de siempre.

    python -m escano.geo        # descarga es-atlas (si falta) y escribe data/elecciones/geo-*.json
"""
from __future__ import annotations

import json
import math

from .config import CRUDOS, DATOS

ES_ATLAS = "https://cdn.jsdelivr.net/npm/es-atlas@0.6.0/es/{}.json"
CARPETA_CRUDOS = CRUDOS / "elecciones" / "geo"
SALIDA = DATOS / "elecciones"
ANCHO, ALTO = 1000, 820
MARGEN = 12

# Código INE de provincia -> nombre de la circunscripción tal como lo escribe el Congreso (y la web).
CIRCUNSCRIPCIONES = {
    "01": "Araba/Álava", "02": "Albacete", "03": "Alicante/Alacant", "04": "Almería", "05": "Ávila",
    "06": "Badajoz", "07": "Balears (Illes)", "08": "Barcelona", "09": "Burgos", "10": "Cáceres",
    "11": "Cádiz", "12": "Castellón/Castelló", "13": "Ciudad Real", "14": "Córdoba", "15": "Coruña (A)",
    "16": "Cuenca", "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa",
    "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida", "26": "Rioja (La)",
    "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia", "31": "Navarra", "32": "Ourense",
    "33": "Asturias", "34": "Palencia", "35": "Palmas (Las)", "36": "Pontevedra", "37": "Salamanca",
    "38": "S/C Tenerife", "39": "Cantabria", "40": "Segovia", "41": "Sevilla", "42": "Soria",
    "43": "Tarragona", "44": "Teruel", "45": "Toledo", "46": "Valencia/València", "47": "Valladolid",
    "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta", "52": "Melilla",
}
CANARIAS = {"35", "38"}

# Nombre corto para rótulos y abreviatura de tres letras para las casillas (las del mapa de diputados).
NOMBRE_CORTO = {
    "01": "Álava", "03": "Alicante", "07": "Baleares", "12": "Castellón", "15": "A Coruña", "26": "La Rioja",
    "35": "Las Palmas", "38": "Tenerife", "46": "Valencia",
}


# ---------- TopoJSON ----------

def _arcos(topo: dict) -> list[list[tuple[float, float]]]:
    """Los arcos del TopoJSON en longitud y latitud (deshace la cuantización y las diferencias)."""
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    salida = []
    for arco in topo["arcs"]:
        x = y = 0
        puntos = []
        for dx, dy in arco:
            x += dx
            y += dy
            puntos.append((x * sx + tx, y * sy + ty))
        salida.append(puntos)
    return salida


def _anillos(geom: dict) -> list[list[list[int]]]:
    """Polígonos de una geometría como listas de anillos, cada anillo una lista de índices de arco."""
    if geom["type"] == "Polygon":
        return [geom["arcs"]]
    if geom["type"] == "MultiPolygon":
        return geom["arcs"]
    return []


# ---------- proyección ----------

def _lambert(lon: float, lat: float) -> tuple[float, float]:
    """Cónica conforme de Lambert para la península (paralelos 37° y 43°, centrada en 40° N 3,7° O)."""
    f1, f2, f0, l0 = map(math.radians, (37.0, 43.0, 40.0, -3.7))
    n = math.log(math.cos(f1) / math.cos(f2)) / math.log(math.tan(math.pi / 4 + f2 / 2) / math.tan(math.pi / 4 + f1 / 2))
    F = math.cos(f1) * math.tan(math.pi / 4 + f1 / 2) ** n / n
    rho = lambda f: F / math.tan(math.pi / 4 + f / 2) ** n
    r, r0 = rho(math.radians(lat)), rho(f0)
    t = n * (math.radians(lon) - l0)
    return r * math.sin(t), -(r0 - r * math.cos(t))   # y hacia abajo, como en SVG


class Proyeccion:
    """Lambert para la península, Baleares, Ceuta y Melilla; Canarias desplazada y en su recuadro."""

    def __init__(self, arcos: list[list[tuple[float, float]]], usados: set[int], canarias_arcos: set[int]):
        pen = [_lambert(*p) for i in usados - canarias_arcos for p in arcos[i]]
        can = [_lambert(*p) for i in canarias_arcos for p in arcos[i]]
        px0, px1 = min(x for x, _ in pen), max(x for x, _ in pen)
        py0, py1 = min(y for _, y in pen), max(y for _, y in pen)
        cx0, cx1 = min(x for x, _ in can), max(x for x, _ in can)
        cy0, cy1 = min(y for _, y in can), max(y for _, y in can)
        # Canarias va abajo a la izquierda: su borde derecho, a la altura de la costa de Huelva, y su borde inferior
        # alineado con el de la península (Melilla).
        self.dx_can = px0 + (px1 - px0) * 0.10 - cx1
        self.dy_can = py1 - cy1
        x0, x1 = min(px0, cx0 + self.dx_can), max(px1, cx1 + self.dx_can)
        y0, y1 = min(py0, cy0 + self.dy_can), max(py1, cy1 + self.dy_can)
        self.k = min((ANCHO - 2 * MARGEN) / (x1 - x0), (ALTO - 2 * MARGEN) / (y1 - y0))
        self.ox = MARGEN - x0 * self.k + ((ANCHO - 2 * MARGEN) - (x1 - x0) * self.k) / 2
        self.oy = MARGEN - y0 * self.k + ((ALTO - 2 * MARGEN) - (y1 - y0) * self.k) / 2
        self.recuadro = self._recuadro(cx0 + self.dx_can, cx1 + self.dx_can, cy0 + self.dy_can, cy1 + self.dy_can)

    def __call__(self, lon: float, lat: float, canarias: bool = False) -> tuple[float, float]:
        x, y = _lambert(lon, lat)
        if canarias:
            x, y = x + self.dx_can, y + self.dy_can
        return x * self.k + self.ox, y * self.k + self.oy

    def _recuadro(self, x0, x1, y0, y1) -> str:
        """La escuadra que separa Canarias del resto del mapa (borde superior y derecho)."""
        h = (x1 - x0) * 0.04
        a = (x0 - h) * self.k + self.ox, (y0 - h) * self.k + self.oy
        b = (x1 + h) * self.k + self.ox, (y0 - h) * self.k + self.oy
        c = (x1 + h) * self.k + self.ox, (y1 + h) * self.k + self.oy
        return f"M{a[0]:.0f} {a[1]:.0f}H{b[0]:.0f}V{c[1]:.0f}"


# ---------- simplificación y paths ----------

def _douglas_peucker(puntos: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    if len(puntos) < 3:
        return puntos
    marca = [False] * len(puntos)
    marca[0] = marca[-1] = True
    pila = [(0, len(puntos) - 1)]
    while pila:
        i, j = pila.pop()
        (ax, ay), (bx, by) = puntos[i], puntos[j]
        dx, dy = bx - ax, by - ay
        largo = math.hypot(dx, dy) or 1e-9
        peor, k = -1.0, -1
        for m in range(i + 1, j):
            px, py = puntos[m]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / largo
            if d > peor:
                peor, k = d, m
        if peor > tol:
            marca[k] = True
            pila += [(i, k), (k, j)]
    return [p for p, m in zip(puntos, marca) if m]


def _anillo_puntos(anillo: list[int], arcos: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    puntos: list[tuple[float, float]] = []
    for i in anillo:
        a = arcos[i] if i >= 0 else arcos[~i][::-1]
        puntos.extend(a if not puntos else a[1:])
    return puntos


def _path(anillos: list[list[tuple[float, float]]], decimales: int) -> str:
    """Path SVG compacto: un punto absoluto por anillo y el resto relativo."""
    f = 10 ** decimales
    partes = []
    for anillo in anillos:
        q = [(round(x * f), round(y * f)) for x, y in anillo]
        limpio = [q[0]] + [p for a, p in zip(q, q[1:]) if p != a]
        if len(limpio) < 3:
            continue
        num = (lambda v: str(v)) if decimales == 0 else (lambda v: f"{v / f:g}")
        s = [f"M{num(limpio[0][0])} {num(limpio[0][1])}"]
        rel = []
        for (ax, ay), (bx, by) in zip(limpio, limpio[1:]):
            rel.append(f"{num(bx - ax)} {num(by - ay)}".replace(" -", "-"))
        s.append("l" + " ".join(rel).replace(" -", "-") + "z")
        partes.append("".join(s))
    return "".join(partes)


def _area_centroide(anillo: list[tuple[float, float]]) -> tuple[float, float, float]:
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(anillo, anillo[1:] + anillo[:1]):
        c = x0 * y1 - x1 * y0
        a += c
        cx += (x0 + x1) * c
        cy += (y0 + y1) * c
    if abs(a) < 1e-9:
        xs, ys = zip(*anillo)
        return 0.0, sum(xs) / len(xs), sum(ys) / len(ys)
    return a / 2, cx / (3 * a), cy / (3 * a)


def _capa(topo: dict, objeto: str, tol: float, decimales: int, proj: Proyeccion | None = None,
          es_canarias=lambda cod: cod[:2] in CANARIAS) -> tuple[dict, Proyeccion]:
    arcos_ll = _arcos(topo)
    geoms = topo["objects"][objeto]["geometries"]
    # Arcos de Canarias: por defecto, los de las geometrías cuyo código empieza por 35 o 38 (provincia o municipio);
    # en la capa de comunidades, la de código 05.
    arcos_de = lambda gs: {(i if i >= 0 else ~i) for g in gs for pol in _anillos(g) for anillo in pol for i in anillo}
    can = arcos_de(g for g in geoms if es_canarias(str(g.get("id", ""))))
    proj = proj or Proyeccion(arcos_ll, arcos_de(g for g in geoms if not str(g.get("id", "")).startswith("54")), can)
    arcos = [_douglas_peucker([proj(lon, lat, i in can) for lon, lat in a], tol) for i, a in enumerate(arcos_ll)]
    salida = {}
    for g in geoms:
        cod = str(g.get("id", ""))
        if not cod or cod.startswith("54"):   # Gibraltar no es una circunscripción
            continue
        anillos = [_anillo_puntos(anillo, arcos) for pol in _anillos(g) for anillo in pol]
        exteriores = [_anillo_puntos(pol[0], arcos) for pol in _anillos(g)]
        area, cx, cy = max((_area_centroide(a) for a in exteriores), key=lambda t: abs(t[0]))
        xs = [x for a in exteriores for x, _ in a]
        ys = [y for a in exteriores for _, y in a]
        salida[cod] = {"n": g.get("properties", {}).get("name", ""), "d": _path(anillos, decimales),
                       "c": [round(cx, 1), round(cy, 1)],
                       "bb": [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)] if xs else None,
                       "a": round(sum(abs(_area_centroide(a)[0]) for a in exteriores), 1)}
    return salida, proj


def _siluetas(topo: dict, objeto: str, codigos: set[str], lado: float = 100.0) -> dict[str, str]:
    """El contorno a gran escala de las provincias que en el mapa de España no llegan a dibujarse (Ceuta y Melilla):
    cada una en su propio lienzo de `lado` de ancho, sin simplificar. Para la silueta del simulador."""
    arcos_ll = _arcos(topo)
    salida = {}
    for g in topo["objects"][objeto]["geometries"]:
        cod = str(g.get("id", ""))
        if cod not in codigos:
            continue
        anillos = [[_lambert(lon, lat) for lon, lat in _anillo_puntos(anillo, arcos_ll)] for pol in _anillos(g) for anillo in pol]
        xs = [x for a in anillos for x, _ in a]
        ys = [y for a in anillos for _, y in a]
        if not xs:
            continue
        k = lado / max(max(xs) - min(xs), max(ys) - min(ys))
        locales = [[((x - min(xs)) * k, (y - min(ys)) * k) for x, y in a] for a in anillos]   # pocos puntos: sin simplificar
        salida[cod] = _path(locales, 1)
    return salida


def descargar() -> None:
    from .red import descargar as bajar
    CARPETA_CRUDOS.mkdir(parents=True, exist_ok=True)
    # Las provincias salen del propio fichero de municipios, así que basta con descargar ese.
    ruta = CARPETA_CRUDOS / "municipalities.json"
    if not ruta.exists():
        bajar(ES_ATLAS.format("municipalities"), ruta)


def escribir() -> dict:
    """Escribe data/elecciones/geo-provincias.json (52 circunscripciones) y geo-municipios.json."""
    descargar()
    muni_topo = json.loads((CARPETA_CRUDOS / "municipalities.json").read_text())
    # La proyección se calcula una vez, con las provincias del fichero de municipios, para que las dos capas casen.
    _, proj = _capa(muni_topo, "provinces", 0.5, 1)
    provincias, _ = _capa(muni_topo, "provinces", 0.35, 1, proj)
    municipios, _ = _capa(muni_topo, "municipalities", 0.45, 1, proj)
    # Las que se quedan sin dibujo a esta escala, con un contorno propio a gran escala.
    siluetas = _siluetas(muni_topo, "provinces", {c for c, p in provincias.items() if not p["d"]})
    for c, d in siluetas.items():
        provincias[c]["silueta"] = d
    SALIDA.mkdir(parents=True, exist_ok=True)
    geo_prov = {
        "ancho": ANCHO, "alto": ALTO, "canarias": proj.recuadro,
        "provincias": {c: {**p, "circ": CIRCUNSCRIPCIONES[c], "corto": NOMBRE_CORTO.get(c, CIRCUNSCRIPCIONES[c])}
                       for c, p in sorted(provincias.items()) if c in CIRCUNSCRIPCIONES},
    }
    (SALIDA / "geo-provincias.json").write_text(json.dumps(geo_prov, ensure_ascii=False, separators=(",", ":")))
    geo_muni = {"ancho": ANCHO, "alto": ALTO,
                "municipios": {c: [m["n"], m["d"]] for c, m in sorted(municipios.items())}}
    # Las comunidades de tierras (53…) no son municipios: no tienen resultados propios.
    (SALIDA / "geo-municipios.json").write_text(json.dumps(geo_muni, ensure_ascii=False, separators=(",", ":")))
    return geo_prov


if __name__ == "__main__":
    g = escribir()
    for f in ("geo-provincias.json", "geo-municipios.json"):
        print(f"{f}: {(SALIDA / f).stat().st_size / 1024:.0f} KB")
    print(f"{len(g['provincias'])} provincias")
