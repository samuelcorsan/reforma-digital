"""Declaraciones de bienes y rentas de los diputados (BOCG, Serie D).

No están en los datos abiertos: el Congreso las publica en el Boletín Oficial de las Cortes Generales como
formularios escaneados. Solo se lee el índice de cada número, que es texto («APELLIDOS, Nombre (Grupo)
(Núm. expte. 005/…) tipo ..... página»), y se enlaza la página del original.
"""
from __future__ import annotations

import json
import re
import subprocess
import unicodedata

from .config import BASE, CRUDOS, DATOS, LEGISLATURA
from .red import descargar

URL = BASE + "/public_oficiales/L{leg}/CONG/BOCG/D/BOCG-{leg}-D-{n}.PDF"
FICHERO = DATOS / "bienes.json"
TIPOS = {"0": "inicial", "1": "modificación", "2": "final"}
MESES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split()
RE_FECHA = re.compile(r"(\d{1,2}) de (" + "|".join(MESES) + r") de (\d{4})")
MAY = r"A-ZÀ-ÖØ-Þ"
# El índice tiene erratas de formato
RE_ENTRADA = re.compile(
    rf"((?:[{MAY}][{MAY}'’-]*\s+)*[{MAY}][{MAY}'’-]*),\s*([^,()]+?),?\s*"
    r"\(((?:[^()]|\([^()]*\))+)\)(?:\s*\((?![Nn]úm)[^()]+\))?\s*"
    r"\([Nn]úm\.\s*expte\.\s*(005/\d+/\d+)\)"
    r"\s*(?:([012])(?=[\s.]))?[\s.]*(?:([012])\s+)?(\d+)"
)


def clave(nombre: str) -> str:
    """«Apellidos, Nombre» sin tildes, mayúsculas ni guiones, para casar el índice con los datos abiertos."""
    s = "".join(c for c in unicodedata.normalize("NFD", nombre.lower()) if unicodedata.category(c) != "Mn")
    s = re.sub(r"\bm\.?ª", "maria", s)  # «Mª», «M.ª»
    return ", ".join(" ".join(p.replace("-", " ").split()) for p in s.split(","))


def leer_indice(texto: str, numero: int) -> list[dict]:
    """Declaraciones que anuncia el índice de un número de la Serie D, o [] si no trae ninguna."""
    texto = " ".join(texto.split())
    if "Declaración de bienes y rentas de los señores" not in texto or not (f := RE_FECHA.search(texto)):
        return []
    fecha = f"{f[3]}-{MESES.index(f[2]) + 1:02}-{int(f[1]):02}"
    salida = []
    for apellidos, nombre, _grupo, expte, tipo, tipo2, pagina in RE_ENTRADA.findall(texto):
        apellidos = re.sub(r"^(?:ÍNDICE|PÁGINA)\s+", "", apellidos)
        nombre = re.sub(r"\s+GV$", "", nombre.strip())
        tipo = tipo or tipo2 or ("0" if expte.endswith("/0000") else "")
        salida.append({"nombre": clave(f"{apellidos}, {nombre}"), "fecha": fecha, "tipo": TIPOS.get(tipo, ""),
                       "bocg": f"D-{numero}", "pagina": int(pagina),
                       "url": URL.format(leg=LEGISLATURA, n=numero) + f"#page={pagina}"})
    esperadas = len(re.findall(r"[Nn]úm\.\s*expte\.\s*005/", texto))
    if len(salida) != esperadas:
        print(f"  Bienes: el BOCG D-{numero} anuncia {esperadas} declaraciones y se han leído {len(salida)}")
    return salida


def actualizar(max_huecos: int = 3) -> dict:
    """Lee los números de la Serie D publicados desde la última vez, hasta `max_huecos` seguidos sin publicar."""
    datos = leer()
    n, huecos = datos["ultimo"] + 1, 0
    destino = CRUDOS / "bocg-d.pdf"
    FICHERO.parent.mkdir(parents=True, exist_ok=True)
    while huecos < max_huecos:
        try:
            # Algunos números pesan casi 100 MB por los escaneos: no se guardan, solo se lee su índice.
            if descargar(URL.format(leg=LEGISLATURA, n=n), destino, cache=False, archivar=False) is None:
                huecos += 1
            else:
                huecos = 0
                texto = subprocess.run(["pdftotext", "-layout", "-enc", "UTF-8", str(destino), "-"],
                                       capture_output=True, check=True).stdout.decode("utf-8", "replace")
                for d in leer_indice(texto, n):
                    datos["declaraciones"].setdefault(d.pop("nombre"), []).append(d)
                datos["ultimo"] = n
                # Se guarda número a número: si una descarga falla, la siguiente ejecución sigue desde aquí.
                FICHERO.write_text(json.dumps(datos, ensure_ascii=False, indent=1, sort_keys=True))
        finally:
            destino.unlink(missing_ok=True)
        n += 1
    return datos


def leer() -> dict:
    """{'ultimo': último número leído, 'declaraciones': {clave del nombre: [{fecha, tipo, bocg, pagina, url}]}}."""
    return json.loads(FICHERO.read_text()) if FICHERO.exists() else {"ultimo": 0, "declaraciones": {}}
