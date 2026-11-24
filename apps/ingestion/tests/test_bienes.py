"""Índice de declaraciones de bienes del BOCG, con nombres sintéticos y las erratas de formato reales."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from escano import bienes

CABECERA = "Declaración de bienes y rentas de los señores Diputados 1 de enero de 2024 "

INDICE = """
BOLETÍN OFICIAL DE LAS CORTES GENERALES   Núm. 7   12 de marzo de 2024
Declaración de bienes y rentas de los señores Diputados
PÉREZ GÓMEZ, Ana (GS) (Núm. expte. 005/000001/0000) 0 ................ 12
DE LA FUENTE-RÍOS, Luis Mª (GV) (EAJ-PNV) (núm. expte. 005/000002/0001) ........ 1 30
URIBE ETXEBERRIA, Ane GV (EAJ-PNV) (Núm. expte.005/000003/0000) ........ 41
SANZ LORA, Eva (GV (EAJ-PNV)) (Núm. expte. 005/000004/0002) 2 ........ 52
"""


def test_reads_every_entry_despite_format_typos():
    filas = bienes.leer_indice(INDICE, 7)
    assert [(f["nombre"], f["tipo"], f["url"].rsplit("#", 1)[1]) for f in filas] == [
        ("perez gomez, ana", "inicial", "page=12"),
        ("de la fuente rios, luis maria", "modificación", "page=30"),
        ("uribe etxeberria, ane", "inicial", "page=41"),
        ("sanz lora, eva", "final", "page=52"),
    ]
    assert {f["fecha"] for f in filas} == {"2024-03-12"}
    assert filas[0]["url"].startswith(bienes.URL.format(leg=bienes.LEGISLATURA, n=7))


def test_page_number_is_not_split_into_type():
    texto = "Declaración de bienes y rentas de los señores 1 de enero de 2024 LÓPEZ RUIZ, Marta (GP) (Núm. expte. 005/000005/0000) 12"
    [fila] = bienes.leer_indice(texto, 9)
    assert (fila["tipo"], fila["pagina"]) == ("inicial", 12)


def test_lowercase_particles_stay_in_the_surname():
    [fila] = bienes.leer_indice(CABECERA + "LÓPEZ de HARO, Ana (GS) (Núm. expte. 005/000006/0000) 0 .... 12", 9)
    assert fila["nombre"] == "lopez de haro, ana"
    [fila] = bienes.leer_indice(CABECERA + "y PÉREZ, Ana (GS) (Núm. expte. 005/000006/0000) 0 .... 12", 9)
    assert fila["nombre"] == "perez, ana"


@pytest.mark.parametrize("entrada", [
    "RUIZ SANZ Eva (GS) (Núm. expte. 005/000007/0001) 1 .... 20",  # sin la coma del nombre
    "RUIZ SANZ, Eva (GS) (Núm. expte. 005/000007/0003) 3 .... 20",  # tipo que no se conoce
    "RUIZ SANZ, Eva (GS) (Núm. expte. 005/000007/0003) 13 .... 20",
])
def test_an_entry_that_cannot_be_read_fails_instead_of_being_dropped(entrada):
    buena = "PÉREZ GÓMEZ, Ana (GS) (Núm. expte. 005/000001/0000) 0 .... 12 "
    with pytest.raises(ValueError, match="anuncia 2 declaraciones de bienes y se han leído 1"):
        bienes.leer_indice(CABECERA + buena + entrada, 9)


def test_numbers_without_asset_declarations_are_ignored():
    assert bienes.leer_indice("Declaraciones de actividades (Núm. expte. 006/000001/0000) 3", 8) == []


def test_key_matches_open_data_spelling():
    assert bienes.clave("De la Fuente-Ríos, Luis M.ª") == bienes.clave("DE LA FUENTE RÍOS, Luis Mª")
