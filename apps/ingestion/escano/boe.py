"""Nombramientos y ceses de altos cargos en el BOE: el organigrama del Estado, con su BOE enlazado.

El BOE publica cada día su sumario en datos abiertos (JSON). En la sección II.A («Nombramientos, situaciones e
incidencias») salen todos los nombramientos y ceses, de un ministro a un profesor titular. El propio BOE marca los de
altos cargos con la alerta 139 («Nombramientos y ceses de altos cargos») en el XML de cada disposición: ese es el filtro,
no una lista nuestra. De cada disposición se saca el cargo, la persona y la fecha; con todas juntas, quién ocupa hoy
cada cargo, desde cuándo y con qué Real Decreto.
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import requests

from .config import CRUDOS, DATOS, USER_AGENT

URL_SUMARIO = "https://www.boe.es/datosabiertos/api/boe/sumario/{fecha}"
URL_XML = "https://www.boe.es/diario_boe/xml.php?id={id}"
URL_HTML = "https://www.boe.es/diario_boe/txt.php?id={id}"
ALERTA_ALTOS_CARGOS = "139"

DIR_SUMARIOS = CRUDOS / "boe" / "sumarios"   # solo la sección II.A de cada día
DIR_DOCS = CRUDOS / "boe" / "docs"           # XML de las disposiciones que se miran
FICHERO = DATOS / "boe.json"                 # eventos (nombramientos y ceses) de altos cargos, versionado

_sesion = requests.Session()
_sesion.headers["User-Agent"] = USER_AGENT


def _get(url: str, **kw) -> requests.Response | None:
    for intento in range(3):
        try:
            r = _sesion.get(url, timeout=60, **kw)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r
        except requests.RequestException:
            if intento == 2:
                raise
            time.sleep(2 * (intento + 1))
    return None


def _lista(x) -> list:
    return x if isinstance(x, list) else ([] if x is None else [x])


# ---------------------------------------------------------------------------------------------------------------
# Descarga

def sumario_2a(d: date) -> list[dict]:
    """Disposiciones de la sección II.A del BOE de `d` ([] si ese día no hay BOE).

    Se guarda la sección tal cual (de todos los números del día, extraordinarios incluidos) y se recorre entera: el
    BOE no siempre anida igual (a veces los epígrafes van dentro de un «texto»).
    """
    ruta = DIR_SUMARIOS / f"{d:%Y%m%d}.json"
    if ruta.exists():
        secciones = json.loads(ruta.read_text())
    else:
        r = _get(URL_SUMARIO.format(fecha=f"{d:%Y%m%d}"), headers={"Accept": "application/json"})
        if r is None and d >= date.today():
            return []  # el BOE de hoy puede no estar publicado todavía: no se guarda el vacío
        secciones = [] if r is None else [
            sec for diario in _lista(r.json()["data"]["sumario"]["diario"])
            for sec in _lista(diario.get("seccion")) if sec.get("codigo") == "2A"]
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_text(json.dumps(secciones, ensure_ascii=False))
    items = []
    for sec in secciones:
        for dep in _lista(sec.get("departamento")):
            _items(dep, dep.get("nombre", ""), "", items)
    return items


def _items(nodo, departamento: str, epigrafe: str, salida: list) -> None:
    if isinstance(nodo, list):
        for x in nodo:
            _items(x, departamento, epigrafe, salida)
    elif isinstance(nodo, dict):
        if "identificador" in nodo and "titulo" in nodo:
            salida.append({"id": nodo["identificador"], "titulo": nodo["titulo"], "departamento": departamento,
                           "epigrafe": epigrafe})
            return
        for v in nodo.values():
            if isinstance(v, (dict, list)):
                _items(v, departamento, nodo.get("nombre", epigrafe) if "item" in nodo else epigrafe, salida)


# Lo que seguro no es un alto cargo: se descarta sin pedir el XML. Lo demás se abre y decide la alerta 139 del BOE.
_DEPARTAMENTOS_FUERA = re.compile(r"^(UNIVERSIDADES|COMUNIDAD AUTÓNOMA|COMUNIDAD FORAL|CIUDAD DE|ADMINISTRACIÓN LOCAL)")
_TITULO_DENTRO = re.compile(r"\b(nombra|nombran|nombramiento|cese|ceses|designa|designan)\b", re.I)
_TITULO_FUERA = re.compile(
    r"personal funcionario|funcionari[oa]s? de carrera|en prácticas|profesor|catedrátic|concurso|libre designación|"
    r"jubilaci|excedencia|notari[oa]|registrador|promueve al empleo|juzgado|juez|jueces|letrad[oa]s? de la administración|"
    r"cuerpo de|cuerpos de|escala de|consejo escolar|a propuesta de la consejería|tribunal calificador|"
    r"proceso selectivo|pruebas selectivas|oposición|reingreso|destino|adscrib|adscripci|situación administrativa",
    re.I)


def es_candidato(item: dict) -> bool:
    if _DEPARTAMENTOS_FUERA.match(item["departamento"]):
        return False
    t = item["titulo"]
    return bool(_TITULO_DENTRO.search(t)) and not _TITULO_FUERA.search(t)


def documento(id_boe: str) -> dict:
    """Metadatos, alertas y párrafos de una disposición (XML del BOE, con caché)."""
    ruta = DIR_DOCS / f"{id_boe}.xml"
    if ruta.exists():
        crudo = ruta.read_bytes()
    else:
        r = _get(URL_XML.format(id=id_boe))
        if r is None:
            return {}
        crudo = r.content
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_bytes(crudo)
    raiz = ET.fromstring(crudo)
    m = raiz.find("metadatos")
    campo = lambda k: (m.findtext(k) or "").strip()
    return {
        "id": id_boe,
        "titulo": campo("titulo"),
        "departamento": campo("departamento"),
        "rango": campo("rango"),
        "numero": campo("numero_oficial"),
        "fecha": _iso(campo("fecha_publicacion")),
        "fecha_disposicion": _iso(campo("fecha_disposicion")),
        "alertas": [a.get("codigo") for a in raiz.iter("alerta")],
        "parrafos": [" ".join("".join(p.itertext()).split()) for p in raiz.find("texto").iter("p")],
    }


def _iso(aaaammdd: str) -> str:
    return f"{aaaammdd[:4]}-{aaaammdd[4:6]}-{aaaammdd[6:8]}" if len(aaaammdd) == 8 else ""


# ---------------------------------------------------------------------------------------------------------------
# Lectura de cada disposición: quién, qué cargo, nombramiento o cese

_TRAT = r"(?P<trat>don|doña|dona)"  # «dona»: alguna errata del BOE
_NOMBRE = r"(?P<persona>[A-ZÁÉÍÓÚÑÜÇ][^,;]*?)"


def _limpio(s: str) -> str:
    return " ".join(s.split()).strip(" .,;:")


def eventos_de(doc: dict) -> list[dict]:
    """Nombramientos y ceses que contiene una disposición de altos cargos (lista vacía si no se entiende)."""
    base = {"boe": doc["id"], "fecha": doc["fecha"], "disposicion": f"{doc['rango']} {doc['numero']}".strip(),
            "departamento": doc["departamento"]}
    titulo = doc["titulo"]
    if titulo.startswith("Corrección"):
        return []  # las correcciones de errores repiten un nombramiento ya leído
    salida = []
    leidos = _leer_titulo(titulo) or _leer_parrafos(titulo, doc["parrafos"]) or _leer_texto(titulo, doc["parrafos"])
    # Tras unas elecciones el presidente cesa «y continuará en funciones hasta la toma de posesión del nuevo».
    en_funciones = any("continuará en funciones" in p for p in doc["parrafos"])
    for tipo, cargo, trat, persona, motivo in leidos:
        salida.append({**base, "tipo": tipo, "cargo": _limpio(cargo), "persona": _limpio(persona),
                       "genero": "f" if trat in ("doña", "dona") else "m", **({"motivo": motivo} if motivo else {}),
                       **({"en_funciones": True} if tipo == "cese" and en_funciones else {})})
    # Las delegaciones que van a una ceremonia no son cargos del organigrama.
    return [e for e in salida if not _PROTOCOLO.search(e["cargo"])]


_EN_FUNCIONES = re.compile(r"cese de los miembros del Gobierno", re.I)
_PROTOCOLO = re.compile(r"Delegación (española )?que (asistirá|asistió|representará)|ceremonia|toma de posesión", re.I)


# «por el que se nombra Directora General de Carreteras a doña X.»
_NOMBRA = re.compile(rf"se (?:nombra|designa|renueva el nombramiento(?: como| de)?) (?P<cargo>.+) a {_TRAT} {_NOMBRE}\.?$")
# «por el que se nombra a don X como Presidente de …» / «se nombra a doña X Directora de …»
_NOMBRA_ANTES = re.compile(rf"se (?:nombra|designa) a {_TRAT} {_NOMBRE},? como (?P<cargo>.+?)\.?$")
_NOMBRA_ANTES_SIN_COMO = re.compile(
    rf"se (?:nombra|designa) a {_TRAT} {_NOMBRE},? (?P<cargo>(?:Director|Directora|Presidente|Presidenta|Secretari|"
    rf"Subsecretari|Embajador|Delegad|Consejer|Vocal|miembro|Miembro|Jefe|Jefa|Comisionad|Fiscal|Abogad|Interventor|"
    rf"Gobernador|Defensor|Adjunt|Vicepresident|Representante|Agente|Coordinador)\b.+?)\.?$")
# «se nombra Secretario General Técnico al General Consejero Togado … don X»: militares, jueces y diplomáticos con su grado
_NOMBRA_GRADO = re.compile(
    rf"se nombra (?P<cargo>.+?) al? (?:(?:General|Teniente|Almirante|Vicealmirante|Contralmirante|Coronel|Capitán|"
    rf"Comandante|Magistrad[oa]|Fiscal|Embajador|Ministro Plenipotenciario)[^,]*? ){_TRAT} {_NOMBRE}\.?$")
# «por el que se dispone el cese de doña X como Directora General de Y, a petición propia.»
_CESE = re.compile(rf"se (?:dispone|declara) el cese(?:,? (?P<motivo1>[^,]+),)? (?:de |del [^,]*? |de la [^,]*? ){_TRAT} {_NOMBRE},? como (?P<cargo>.+?)"
                   rf"(?:,? (?P<motivo2>a petición propia|por (?:pase|jubilaci|renuncia|fallecimiento|cumplimiento|expiración|haber)[^.]*))?\.?$")


def _leer_titulo(titulo: str) -> list[tuple]:
    t = titulo.split(" por el que ", 1)[-1].split(" por la que ", 1)[-1]
    if (m := _CESE.search(t)):
        return [("cese", m["cargo"], m["trat"], m["persona"], _limpio(m["motivo1"] or m["motivo2"] or ""))]
    if (m := _NOMBRA.search(t)) and " a don " not in m["cargo"] and " a doña " not in m["cargo"]:
        return [("nombramiento", m["cargo"], m["trat"], m["persona"], "")]
    if (m := _NOMBRA_ANTES.search(t) or _NOMBRA_ANTES_SIN_COMO.search(t)):
        return [("nombramiento", m["cargo"], m["trat"], m["persona"], "")]
    if (m := _NOMBRA_GRADO.search(t)):
        return [("nombramiento", m["cargo"], m["trat"], m["persona"], "")]
    return []


# Párrafos de los decretos colectivos: «Ministro del Interior a don X.» / «Doña X como Ministra de Y.»
_P_NOMBRA = re.compile(rf"^(?P<cargo>[A-ZÁÉÍÓÚ].+?) a {_TRAT} {_NOMBRE}\.?$")
_P_CESE = re.compile(rf"^(?:De )?{_TRAT.replace('don|doña', '[Dd]on|[Dd]oña')} {_NOMBRE},? como (?P<cargo>.+?)\.?$")


# Solo los decretos colectivos traen un cargo por párrafo («se nombran Ministros», «cese de Consejeros electivos»).
_PLURAL = re.compile(r"se (nombran|designan)|ceses|nombramientos|cese de (los |las )?[A-ZÁÉÍÓÚ]\w+s\b")


def _leer_parrafos(titulo: str, parrafos: list[str]) -> list[tuple]:
    if not _PLURAL.search(titulo):
        return []
    cese = bool(re.search(r"\bcese", titulo, re.I))
    salida = []
    for p in parrafos:
        if cese and (m := _P_CESE.match(p)):
            salida.append(("cese", m["cargo"], m["trat"].lower(), m["persona"], ""))
        elif not cese and (m := _P_NOMBRA.match(p)) and len(m["cargo"]) < 200:
            salida.append(("nombramiento", m["cargo"], m["trat"], m["persona"], ""))
    return salida


# Una disposición que cita otra («Como consecuencia del Real Decreto 257/2026, por el que se dispone el cese de…»)
# no es un cese nuevo.
_CITA = re.compile(r"\b(Real Decreto|Orden [A-Z]+/)\s*\d+/\d{4}")
# Último recurso, en el cuerpo: «Dar publicidad … al cese de don X como Presidente de la Autoridad Portuaria de Y».
_EN_TEXTO = re.compile(
    rf"(?P<accion>cese|separación|nombramiento|designación|nombrar a|designar a|designa a|nombra a|cesa a)(?: de)? "
    rf"{_TRAT} {_NOMBRE},? como (?P<cargo>[A-ZÁÉÍÓÚ][^.;]*?)(?:,|\.|$| dispuesto| con efectos| agradeci)")
# «ha nombrado Director de la Agencia … a don X» / «del nombramiento como Director de … de don X»
_EN_TEXTO_2 = re.compile(
    rf"(?:(?P<accion>ha nombrado|ha designado|nombrar|designar) (?P<cargo>[A-ZÁÉÍÓÚ][^.;]*?) a|nombramiento como "
    rf"(?P<cargo2>[A-ZÁÉÍÓÚ][^.;]*?) de) {_TRAT} {_NOMBRE}(?:,|\.|$)")


def _leer_texto(titulo: str, parrafos: list[str]) -> list[tuple]:
    for p in reversed(parrafos):  # el último párrafo con contenido es el que dispone
        if (m := _EN_TEXTO.search(p)) and not _CITA.search(p[:m.start()]):
            tipo = "cese" if m["accion"] in ("cese", "separación", "cesa a") else "nombramiento"
            return [(tipo, m["cargo"], m["trat"], m["persona"], "")]
    if not re.search(r"\bcese", titulo, re.I):
        for p in reversed(parrafos):
            if (m := _EN_TEXTO_2.search(p)) and not _CITA.search(p[:m.start()]):
                return [("nombramiento", m["cargo"] or m["cargo2"], m["trat"], m["persona"], "")]
    return []


# ---------------------------------------------------------------------------------------------------------------
# Actualización

def leer() -> dict:
    if FICHERO.exists():
        return json.loads(FICHERO.read_text())
    return {"hasta": None, "eventos": [], "sin_leer": []}


def guardar(datos: dict) -> None:
    """Un evento por línea: los cambios de cada día se leen bien en el historial de git."""
    linea = lambda x: json.dumps(x, ensure_ascii=False)
    FICHERO.write_text(
        '{"hasta": ' + linea(datos["hasta"]) + ',\n"eventos": [\n' + ",\n".join(map(linea, datos["eventos"])) +
        '\n],\n"sin_leer": [\n' + ",\n".join(map(linea, datos["sin_leer"])) + "\n]}\n")


def actualizar(desde: date | None = None, hasta: date | None = None, *, avisar=print) -> dict:
    """Recorre los sumarios de `desde` a `hasta` y añade a data/boe.json los nombramientos y ceses de altos cargos."""
    datos = leer()
    hasta = hasta or date.today()
    if desde is None:
        desde = date.fromisoformat(datos["hasta"]) - timedelta(days=3) if datos["hasta"] else date(2023, 8, 17)
    por_boe = {}
    for e in datos["eventos"]:
        por_boe.setdefault(e["boe"], []).append(e)
    sin_leer = {s["boe"]: s for s in datos.get("sin_leer", [])}

    por_dia = {}
    d = desde
    while d <= hasta:
        por_dia[d] = [it for it in sumario_2a(d) if es_candidato(it)]
        d += timedelta(days=1)
    # Los XML que falten se piden en paralelo, con pocos hilos para no cargar al BOE.
    pendientes = [it["id"] for its in por_dia.values() for it in its if not (DIR_DOCS / f"{it['id']}.xml").exists()]
    if pendientes:
        avisar(f"  {len(pendientes)} disposiciones por abrir")
        with ThreadPoolExecutor(max_workers=4) as ex:
            list(ex.map(documento, pendientes))

    dias, candidatos, altos = 0, 0, 0
    for items in por_dia.values():
        dias += bool(items)
        for it in items:
            candidatos += 1
            doc = documento(it["id"])
            if not doc or ALERTA_ALTOS_CARGOS not in doc["alertas"]:
                continue
            if doc["titulo"].startswith("Corrección") or _PROTOCOLO.search(doc["titulo"]) or _EN_FUNCIONES.search(doc["titulo"]):
                continue  # correcciones, delegaciones de protocolo y el cese en bloque tras unas elecciones (el Gobierno
                # sigue en funciones hasta que se nombra el nuevo): no cambian el organigrama
            altos += 1
            evs = eventos_de(doc)
            if evs:
                por_boe[it["id"]] = evs
                sin_leer.pop(it["id"], None)
            elif it["id"] not in por_boe:
                sin_leer[it["id"]] = {"boe": it["id"], "fecha": doc["fecha"], "titulo": doc["titulo"]}

    eventos = sorted((e for evs in por_boe.values() for e in evs), key=lambda e: (e["fecha"], e["boe"]))
    datos = {"hasta": max(hasta, date.fromisoformat(datos["hasta"])).isoformat() if datos["hasta"] else hasta.isoformat(),
             "eventos": eventos, "sin_leer": sorted(sin_leer.values(), key=lambda s: s["fecha"])}
    guardar(datos)
    avisar(f"· BOE del {desde} al {hasta}: {dias} días con nombramientos, {candidatos} disposiciones abiertas, "
           f"{altos} de altos cargos; {len(eventos)} nombramientos y ceses, {len(sin_leer)} sin leer")
    return datos


def sin_tildes(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
