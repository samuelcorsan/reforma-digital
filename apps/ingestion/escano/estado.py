"""El organigrama del Estado a partir de los nombramientos y ceses del BOE (data/boe.json).

Cada cargo es una cadena de mandatos: un nombramiento abre uno y el cese de esa persona lo cierra. Quien tiene el
mandato abierto es el titular de hoy. Los cargos se agrupan por ministerio (el departamento que firma la disposición)
y se ordenan por rango: ministro, secretarías de Estado, subsecretaría y secretarías generales, direcciones generales.
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date, timedelta

from . import boe
from .config import DATOS, SITIO

# Femenino -> forma del cargo en masculino, para que «Directora General de X» y «Director General de X» sean el mismo.
_GENERO = {
    "Ministra": "Ministro", "Vicepresidenta": "Vicepresidente", "Presidenta": "Presidente", "Secretaria": "Secretario",
    "Subsecretaria": "Subsecretario", "Directora": "Director", "Subdirectora": "Subdirector", "Delegada": "Delegado",
    "Subdelegada": "Subdelegado", "Comisionada": "Comisionado", "Embajadora": "Embajador", "Consejera": "Consejero",
    "Abogada": "Abogado", "Interventora": "Interventor", "Gobernadora": "Gobernador", "Subgobernadora": "Subgobernador",
    "Defensora": "Defensor", "Adjunta": "Adjunto", "Magistrada": "Magistrado", "Jefa": "Jefe", "Representante": "Representante",
    "Primera": "Primero", "Segunda": "Segundo", "Tercera": "Tercero", "Cuarta": "Cuarto", "Alta": "Alto",
    "Coordinadora": "Coordinador", "Gerenta": "Gerente", "Portavoz": "Portavoz", "Enviada": "Enviado", "Cónsul": "Cónsul",
}
_RE_GENERO = re.compile(r"\b(" + "|".join(_GENERO) + r")\b")
_RE_DE_LA = re.compile(r"\bde la (Ministra|Vicepresidenta|Presidenta|Secretaria|Subsecretaria|Directora|Delegada|Comisionada|Alta)\b")


def masculino(cargo: str) -> str:
    cargo = _RE_DE_LA.sub(lambda m: "del " + _GENERO[m[1]], cargo)
    cargo = re.sub(r"\bGeneral Técnica\b", "General Técnico", cargo)
    # «Gabinete de la Secretaría de Estado» (la unidad) y «del Secretario de Estado» (la persona) son el mismo cargo.
    cargo = re.sub(r"\b(Gabinete(?: Adjunto)?) de la Secretaría de Estado\b", r"\1 del Secretario de Estado", cargo)
    return _RE_GENERO.sub(lambda m: _GENERO[m[1]], cargo)


def clave(cargo: str, departamento: str = "") -> str:
    """Identificador del cargo. Los que se llaman igual en todos los ministerios llevan además el del ministerio."""
    # «Abogado General del Estado-Director del Servicio Jurídico del Estado» es el mismo cargo que «Abogado General del
    # Estado»: cuenta el cargo principal, antes del guion.
    cargo = re.split(r"\s*-\s*(?=(?:Director|Directora|Presidente|Presidenta|Secretari)\b)", cargo)[0]
    k = _slug(masculino(cargo))
    if _GENERICO.match(masculino(cargo)) and departamento:
        k += "--" + _slug(departamento)  # «secretario-general-tecnico--ministerio-de-defensa»
    return k


def _slug(texto: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", boe.sin_tildes(texto).lower()).strip("-")


# Cargos que existen con el mismo nombre en cada ministerio («Secretario General Técnico»).
_GENERICO = re.compile(r"^(Secretario General Técnico|Director del Gabinete( Adjunto)?|Director Adjunto del Gabinete|"
                       r"Director del Gabinete( Adjunto)? del (Ministro|Vicepresidente)|Subsecretario|Interventor Delegado)$")


def clave_persona(nombre: str) -> str:
    return re.sub(r"[^a-z]+", " ", boe.sin_tildes(nombre).lower()).strip()


# Cargos de órganos colegiados: varias personas a la vez, cada cese cierra el suyo.
_COLEGIADO = re.compile(r"^(miembro|vocal|consejero|magistrado|adjunto|representante)", re.I)

# Rango para ordenar y dibujar (0 = presidente del Gobierno).
_RANGOS = [
    (0, re.compile(r"^Presidente del Gobierno$")),
    (1, re.compile(r"^(Vicepresidente (Primero |Segundo |Tercero |Cuarto )?del Gobierno|Ministro)\b")),
    (2, re.compile(r"^Secretario de Estado\b")),
    (3, re.compile(r"^(Subsecretario|Secretario General|Abogado General del Estado|Interventor General)\b")),
    (4, re.compile(r"^(Director|Comisionado|Alto Comisionado|Presidente|Vicepresidente|Gobernador|Subgobernador|"
                   r"Fiscal General|Defensor)\b")),
]


def rango(cargo: str) -> int:
    for n, r in _RANGOS:
        if r.search(cargo):
            return n
    return 5


def grupo(cargo: str, departamento: str) -> str:
    """Rama del organigrama: gobierno (ministerios), territorio (delegaciones), exterior (embajadas) u organismos."""
    if re.match(r"^(Embajador|Representante Permanente|Cónsul|Enviado)", cargo):
        return "exterior"
    if re.match(r"^Delegado del Gobierno en ", cargo):
        return "territorio"
    if re.match(r"^Presidente (del Gobierno (Vasco|de |del )|de la (Generalitat|Junta|Comunidad|Xunta|Región|Diputación General|Ciudad)|"
                r"del (Principado|Consejo de Gobierno|Gobierno de)|de las Illes|de Canarias|de Cantabria|de Aragón)", cargo):
        return "comunidades"
    if departamento and not departamento.startswith(("Ministerio", "Presidencia del Gobierno", "Jefatura del Estado")):
        return "organismos"
    return "gobierno"


def ministerio_de(cargo: str, departamento: str) -> str:
    """Ministerio al que pertenece el cargo. Los ministros y vicepresidentes se nombran desde Presidencia del Gobierno."""
    m = re.match(r"^Ministro (de|del|para) (.+)$", cargo)
    if m:
        return f"Ministerio {m[1]} {m[2]}"
    if cargo == "Presidente del Gobierno" or departamento in ("Jefatura del Estado",):
        return "Presidencia del Gobierno"
    return departamento


# ---------------------------------------------------------------------------------------------------------------

_MIEMBRO_GOBIERNO = re.compile(r"^(Ministro|Vicepresidente (Primero |Segundo |Tercero |Cuarto )?del Gobierno)\b")


def _formaciones(eventos: list[dict]) -> dict[str, set]:
    """Días en que toma posesión un Gobierno nuevo -> (cargo, persona) de sus miembros nombrados ese día.

    Tras una investidura el BOE nombra al presidente y, días después, a los ministros; el cese de los salientes no se
    publica (cesan con el Gobierno, art. 101 de la Constitución). Ese día se cierran los mandatos que no se renuevan.
    """
    salida = {}
    for e in eventos:
        if e["tipo"] == "nombramiento" and masculino(e["cargo"]) == "Presidente del Gobierno":
            fin = (date.fromisoformat(e["fecha"]) + timedelta(days=20)).isoformat()
            dias = sorted(x["fecha"] for x in eventos if x["tipo"] == "nombramiento" and e["fecha"] <= x["fecha"] <= fin
                          and _MIEMBRO_GOBIERNO.match(masculino(x["cargo"])))
            if dias:
                salida[dias[0]] = {(clave(x["cargo"]), clave_persona(x["persona"])) for x in eventos
                                   if x["fecha"] == dias[0] and x["tipo"] == "nombramiento"}
    return salida


def mandatos(eventos: list[dict]) -> dict[str, dict]:
    """Por cada cargo, sus mandatos en orden: persona, desde, hasta y las disposiciones del BOE de cada extremo."""
    cargos: dict[str, dict] = {}
    formaciones = _formaciones(eventos)
    por_persona: dict[str, list] = defaultdict(list)  # persona -> [(cargo, mandato)] de cargos unipersonales
    for e in sorted(eventos, key=lambda e: (e["fecha"], e["tipo"] != "cese", e["boe"])):
        if e["fecha"] in formaciones:
            renovados = formaciones.pop(e["fecha"])
            for c in cargos.values():
                if not _MIEMBRO_GOBIERNO.match(c["cargo"]):
                    continue
                for m in c["mandatos"]:
                    sigue = any(k == c["id"] and _misma_persona(p, clave_persona(m["persona"])) for k, p in renovados)
                    if m["hasta"] is None and not sigue:
                        m.update(hasta=e["fecha"], motivo="cesa con la formación de un nuevo Gobierno")
        cargo = masculino(e["cargo"])
        k = clave(cargo, e["departamento"])
        c = cargos.setdefault(k, {"id": k, "cargo": cargo, "departamento": e["departamento"], "mandatos": []})
        if e["tipo"] == "nombramiento":
            c["departamento"] = e["departamento"]
        abiertos = [m for m in c["mandatos"] if m["hasta"] is None]
        persona = clave_persona(e["persona"])
        if e["tipo"] == "cese":
            suyo = next((m for m in abiertos if _misma_persona(clave_persona(m["persona"]), persona)), None)
            if suyo and e.get("en_funciones"):  # sigue en el cargo, en funciones, hasta el nuevo nombramiento
                suyo.setdefault("en_funciones", []).append({"fecha": e["fecha"], "boe": e["boe"], "disposicion": e["disposicion"]})
            elif suyo:
                suyo.update(hasta=e["fecha"], boe_cese=e["boe"], disposicion_cese=e["disposicion"],
                            **({"motivo": e["motivo"]} if e.get("motivo") else {}))
            else:  # nombrado antes de que empiece nuestra serie
                c["mandatos"].append({"persona": e["persona"], "genero": e["genero"], "cargo": e["cargo"], "desde": None,
                                      "boe": None, "hasta": e["fecha"], "boe_cese": e["boe"],
                                      "disposicion_cese": e["disposicion"], **({"motivo": e["motivo"]} if e.get("motivo") else {})})
        else:
            if not _COLEGIADO.match(cargo):
                for m in abiertos:  # un cargo unipersonal: el nuevo nombramiento cierra el anterior aunque no se publique cese
                    if not _misma_persona(clave_persona(m["persona"]), persona):
                        m["hasta"] = e["fecha"]
            mismo = next((m for m in abiertos if _misma_persona(clave_persona(m["persona"]), persona)), None)
            if mismo:  # renovación (un nuevo Gobierno, un nuevo periodo): sigue el mismo mandato, con su decreto
                if e["boe"] != mismo["boe"]:
                    mismo.setdefault("renovaciones", []).append({"fecha": e["fecha"], "boe": e["boe"], "disposicion": e["disposicion"]})
                continue
            nuevo = {"persona": e["persona"], "genero": e["genero"], "cargo": e["cargo"], "desde": e["fecha"],
                     "boe": e["boe"], "disposicion": e["disposicion"], "hasta": None}
            c["mandatos"].append(nuevo)
            if _unipersonal(cargo):
                # Quien pasa a otro cargo deja el anterior aunque el BOE no publique ese cese (p. ej., al reestructurarse
                # un ministerio se le nombra con el nombre nuevo del cargo).
                for otro, m in por_persona[persona]:
                    if m["hasta"] is None and otro is not c:
                        m.update(hasta=e["fecha"], motivo="pasa a otro cargo (sin cese publicado)")
                por_persona[persona].append((c, nuevo))
    return cargos


def _unipersonal(cargo: str) -> bool:
    """Cargos que se ocupan de uno en uno y en exclusiva: ni ministros (que pueden ser también vicepresidentes) ni
    miembros de órganos colegiados."""
    return not _COLEGIADO.match(cargo) and not _MIEMBRO_GOBIERNO.match(cargo) and rango(cargo) >= 2 \
        and not cargo.startswith(("Embajador", "Presidente de la Delegación"))


def _misma_persona(a: str, b: str) -> bool:
    if a == b:
        return True
    pa, pb = a.split(), b.split()  # a veces falta el segundo apellido o un segundo nombre
    return len(pa) >= 2 and len(pb) >= 2 and pa[-2:] == pb[-2:] or (pa[0] == pb[0] and pa[-1] == pb[-1] and len(set(pa) & set(pb)) >= 3)


def _diputados() -> dict[str, str]:
    """Nombre completo normalizado -> slug de su página en la web, para los diputados de la legislatura."""
    from .construir import slug_web
    ruta = DATOS / "diputados.json"
    if not ruta.exists():
        return {}
    salida = {}
    for clave_dip in json.loads(ruta.read_text()):
        apellidos, _, nombre = clave_dip.partition(",")
        salida[clave_persona(f"{nombre} {apellidos}")] = slug_web(clave_dip)
    return salida


def _slug_diputado(persona: str, diputados: dict[str, str]) -> str | None:
    """El BOE a veces pone el nombre completo («María Margarita») y el Congreso el de uso («Margarita»)."""
    k = clave_persona(persona)
    if k in diputados:
        return diputados[k]
    ap = k.split()[-2:]
    candidatos = [s for d, s in diputados.items() if d.split()[-2:] == ap and set(d.split()[:-2]) & set(k.split()[:-2])]
    return candidatos[0] if len(candidatos) == 1 else None


def construir(hoy: date | None = None) -> dict:
    datos = boe.leer()
    hoy = hoy or date.fromisoformat(datos["hasta"])
    cargos = mandatos(datos["eventos"])
    diputados = _diputados()
    for c in cargos.values():
        for m in c["mandatos"]:
            if (slug := _slug_diputado(m["persona"], diputados)):
                m["diputado"] = slug

    # Ministerios de hoy: los de los ministros en ejercicio.
    ministros = {}
    for c in cargos.values():
        abierto = [m for m in c["mandatos"] if m["hasta"] is None]
        if abierto and re.match(r"^Ministro (de|del|para) ", c["cargo"]):
            ministros[ministerio_de(c["cargo"], c["departamento"])] = c["id"]

    linaje = _linaje(datos["eventos"], set(ministros) | {"Presidencia del Gobierno"})
    ramas: dict[str, dict] = {}
    sin_rama = Counter()
    for c in cargos.values():
        c["rango"] = rango(c["cargo"])
        c["grupo"] = grupo(c["cargo"], c["departamento"])
        c["ministerio"] = ministerio_de(c["cargo"], c["departamento"])
        abierto = [m for m in c["mandatos"] if m["hasta"] is None]
        if not abierto:
            continue
        if c["grupo"] == "gobierno" and c["ministerio"] not in ministros and c["ministerio"] != "Presidencia del Gobierno":
            # Ministerio que ya no existe con ese nombre: se le nombró antes de una reestructuración y el BOE no ha
            # publicado ni su cese ni un nombramiento con el nombre nuevo. Va a su ministerio de hoy, sin confirmar.
            actual = _por_nombre(c["cargo"], ministros) or linaje.get(c["ministerio"])
            if actual:
                c["antiguo"], c["ministerio"] = c["ministerio"], actual
            else:
                sin_rama[c["ministerio"]] += 1
                c["grupo"] = "antiguos"
        nombre_rama = {"gobierno": c["ministerio"], "territorio": "Delegaciones del Gobierno",
                       "comunidades": "Presidencias autonómicas",
                       "exterior": "Embajadas y representaciones", "organismos": c["departamento"],
                       "antiguos": "Nombrados en ministerios que ya no existen"}[c["grupo"]]
        r = ramas.setdefault(nombre_rama, {"nombre": nombre_rama, "grupo": c["grupo"], "cargos": []})
        for m in abierto:
            r["cargos"].append({"id": c["id"], "cargo": _cargo_titular(c, m), "rango": c["rango"], "persona": m["persona"],
                                "genero": m["genero"], "desde": m["desde"], "boe": m["boe"], "disposicion": m.get("disposicion"),
                                **({"diputado": m["diputado"]} if m.get("diputado") else {}),
                                "anteriores": sum(1 for x in c["mandatos"] if x["hasta"] is not None),
                                **({"antiguo": c["antiguo"]} if c.get("antiguo") else {})})

    for r in ramas.values():
        r["cargos"].sort(key=lambda x: (x["rango"], x["cargo"]))
        titular = next((x for x in r["cargos"] if x["rango"] == 1 and x["cargo"].startswith("Minist")), None)
        r["ministro"] = titular["persona"] if titular else None

    # Orden de precedencia: el del último decreto que nombra a todo el Gobierno; los ministerios creados después, al final.
    por_decreto = defaultdict(list)
    for e in datos["eventos"]:
        if e["tipo"] == "nombramiento" and re.match(r"^Ministr[oa] ", e["cargo"]):
            por_decreto[e["boe"]].append(ministerio_de(masculino(e["cargo"]), e["departamento"]))
    completos = [v for v in por_decreto.values() if len(v) >= 10]
    precedencia = {m: i for i, m in enumerate(["Presidencia del Gobierno"] + (completos[-1] if completos else []))}
    orden_grupo = {"gobierno": 0, "organismos": 1, "territorio": 2, "comunidades": 3, "exterior": 4, "antiguos": 5}
    lista_ramas = sorted(ramas.values(), key=lambda r: (orden_grupo[r["grupo"]], precedencia.get(r["nombre"], 99),
                                                        r["nombre"]))

    # Últimos cambios: cada evento con su contexto (a quién sustituye, quién le sustituye).
    cambios = []
    for e in reversed(datos["eventos"][-400:]):
        k = clave(e["cargo"], e["departamento"])
        cambios.append({"fecha": e["fecha"], "tipo": e["tipo"], "cargo": e["cargo"], "persona": e["persona"],
                        "boe": e["boe"], "disposicion": e["disposicion"], "cargo_id": k,
                        **({"motivo": e["motivo"]} if e.get("motivo") else {})})

    ocupados = sum(len(r["cargos"]) for r in lista_ramas if r["grupo"] != "antiguos")
    hace = lambda dias: (hoy - timedelta(days=dias)).isoformat()
    vacantes = []
    for c in cargos.values():
        if c["mandatos"] and all(m["hasta"] is not None for m in c["mandatos"]) and c["mandatos"][-1]["hasta"] >= hace(90):
            ultimo = c["mandatos"][-1]
            vacantes.append({"id": c["id"], "cargo": c["cargo"], "desde": ultimo["hasta"], "persona": ultimo["persona"],
                             # Un mandato cerrado por otro nombramiento o por un nuevo Gobierno no tiene cese en el BOE.
                             "boe": ultimo.get("boe_cese")})
    salida = {
        "actualizado": datos["hasta"],
        "desde_serie": datos["eventos"][0]["fecha"] if datos["eventos"] else None,
        "cifras": {
            "cargos_ocupados": ocupados,
            "sin_confirmar": sum(1 for r in lista_ramas for x in r["cargos"] if x.get("antiguo")),
            "ministerios": len(ministros),
            "cambios_30": sum(e["fecha"] >= hace(30) for e in datos["eventos"]),
            "cambios_90": sum(e["fecha"] >= hace(90) for e in datos["eventos"]),
            "sin_sustituto_90": len(vacantes),
            "disposiciones": len({e["boe"] for e in datos["eventos"]}),
            "sin_leer": len(datos.get("sin_leer", [])),
        },
        "por_mes": _por_mes(datos["eventos"]),
        "ramas": lista_ramas,
        "cambios": cambios[:150],
        "sin_sustituto": sorted(vacantes, key=lambda v: v["desde"], reverse=True),
        "cargos": {c["id"]: {"cargo": c["cargo"], "ministerio": c["ministerio"], "mandatos": list(reversed(c["mandatos"])),
                             **({"antiguo": c["antiguo"]} if c.get("antiguo") else {})}
                   for c in cargos.values()},
    }
    return salida | {"_sin_rama": sin_rama}


def escribir(carpeta=None) -> dict:
    """Escribe en site/datos el organigrama completo (para su pestaña) y un índice ligero de personas: el buscador
    y las fichas de los diputados lo cargan sin traerse el organigrama entero."""
    carpeta = carpeta or SITIO / "datos"
    salida = construir()
    salida.pop("_sin_rama", None)
    (carpeta / "organigrama.json").write_text(json.dumps(salida, ensure_ascii=False))
    actuales = [[x["id"], x["persona"], x["cargo"], r["nombre"]] for r in salida["ramas"] for x in r["cargos"]]
    diputados = defaultdict(list)
    for k, c in salida["cargos"].items():
        for m in c["mandatos"]:
            if m.get("diputado"):
                diputados[m["diputado"]].append([k, m.get("cargo") or c["cargo"], m["desde"], m["hasta"]])
    (carpeta / "organigrama-indice.json").write_text(json.dumps(
        {"actualizado": salida["actualizado"], "actuales": actuales, "diputados": diputados,
         "ultimos": salida["cambios"][:8]}, ensure_ascii=False))
    return salida


def _cargo_titular(c: dict, m: dict) -> str:
    """El cargo tal y como lo lleva quien lo ocupa (Directora General, Ministra…)."""
    return m.get("cargo") or c["cargo"]


def _por_mes(eventos: list[dict]) -> list[list]:
    """[mes, nombramientos, ceses] de cada mes de la serie, también los meses sin cambios."""
    cuenta = defaultdict(lambda: [0, 0])
    for e in eventos:
        cuenta[e["fecha"][:7]][e["tipo"] == "cese"] += 1
    if not cuenta:
        return []
    salida, (a, m) = [], map(int, min(cuenta).split("-"))
    fin = max(cuenta)
    while f"{a:04d}-{m:02d}" <= fin:
        k = f"{a:04d}-{m:02d}"
        salida.append([k, *cuenta.get(k, [0, 0])])
        a, m = (a + 1, 1) if m == 12 else (a, m + 1)
    return salida


_VACIAS = {"ministerio", "de", "del", "la", "las", "el", "los", "y", "e", "para", "con"}


def _linaje(eventos: list[dict], actuales: set[str]) -> dict[str, str]:
    """Ministerio de hoy que hereda cada ministerio desaparecido o renombrado.

    Primero, los cargos que se han nombrado con los dos nombres (la Dirección General de Carreteras pasó de Fomento a
    Transportes); si no hay, el ministerio de hoy con el que comparte más palabras («Consumo» -> «Derechos Sociales,
    Consumo y Agenda 2030»).
    """
    votos: dict[str, Counter] = defaultdict(Counter)
    ultimo: dict[str, str] = {}
    for e in eventos:
        cargo = masculino(e["cargo"])
        if _GENERICO.match(cargo) or _MIEMBRO_GOBIERNO.match(cargo) or not e["departamento"].startswith("Ministerio"):
            continue
        k = clave(cargo)
        if k in ultimo and ultimo[k] != e["departamento"]:
            votos[ultimo[k]][e["departamento"]] += 1
        ultimo[k] = e["departamento"]
    palabras = lambda m: set(boe.sin_tildes(m).lower().replace(",", " ").split()) - _VACIAS
    salida = {}
    for antiguo in {e["departamento"] for e in eventos} - actuales:
        m, vistos = antiguo, set()
        while m not in actuales and m not in vistos:
            vistos.add(m)
            siguiente = [d for d, _ in votos[m].most_common() if d not in vistos]
            if siguiente:
                m = siguiente[0]
                continue
            parecidos = sorted(actuales, key=lambda a: -len(palabras(a) & palabras(m)))
            if parecidos and palabras(parecidos[0]) & palabras(m):
                m = parecidos[0]
            break
        if m in actuales:
            salida[antiguo] = m
    return salida


# Palabras que no dicen de qué ministerio es un cargo.
_GENERICAS = _VACIAS | {"estado", "general", "secretario", "director", "subsecretario", "gabinete", "adjunto", "seguridad",
                        "social", "nacional", "agencia", "instituto", "espana", "espanola", "oficina", "centro", "politica",
                        "politicas", "presidente", "consejo", "comisionado", "alto", "tecnico", "servicio", "servicios",
                        "asuntos", "territorial", "cooperacion", "coordinacion", "evaluacion", "relaciones"}


def _por_nombre(cargo: str, ministerios) -> str | None:
    """El ministerio de hoy cuyo nombre comparte más palabras con el cargo («… de Memoria Democrática»), si es uno solo."""
    palabras = lambda t: set(re.findall(r"[a-z0-9]+", boe.sin_tildes(t).lower())) - _GENERICAS
    del_cargo = palabras(cargo)
    puntos = sorted(((len(palabras(m) & del_cargo), m) for m in ministerios), reverse=True)
    if puntos and puntos[0][0] and (len(puntos) == 1 or puntos[0][0] > puntos[1][0]):
        return puntos[0][1]
    return None
