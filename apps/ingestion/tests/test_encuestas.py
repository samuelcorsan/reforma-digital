"""La tabla de encuestas de Wikipedia, con HTML sintético que imita su estructura."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from escano.encuestas import leer_wikipedia


def _tabla(titulo: str, izquierda: str, filas: list[tuple[str, str, str]], nivel: str = "h5") -> str:
    cabecera = "".join(f'<th><a title="{p}">{p}</a></th>' for p in ("PP", "PSOE", izquierda))
    cuerpo = "".join(
        f"<tr><td>{firma}</td><td>{fecha}</td><td>1,000</td><td>?</td><td>32.0</td><td>27.0</td><td>{izq}</td></tr>"
        for firma, fecha, izq in filas
    )
    return (f"<{nivel}>{titulo}</{nivel}><table class=\"wikitable\"><tr><th>Firm</th><th>Date</th><th>Sample</th><th>Turnout</th>"
            f"{cabecera}</tr><tr><td colspan=\"7\"></td></tr>{cuerpo}</table>")


def test_un_ano_con_dos_tablas_y_frente_amplio_como_sucesor_de_sumar():
    html = ("<h3>Voting intention estimates</h3>"
            + _tabla("2026 (with Broad Front)", "FA", [("Empresa A", "15–17 Oct", "8.1")])
            + _tabla("2026 (before Broad Front)", "Sumar", [("Empresa B", "6–9 Oct", "6.3")])
            + _tabla("2025", "Sumar", [("Empresa C", "27 Dec–3 Jan", "7.0")]))

    encuestas, _ = leer_wikipedia(html)

    assert [(e["empresa"], e["ini"], e["fin"], e["v"]["SUMAR"]) for e in encuestas] == [
        ("Empresa A", "2026-10-15", "2026-10-17", 8.1),
        ("Empresa B", "2026-10-06", "2026-10-09", 6.3),
        ("Empresa C", "2024-12-27", "2025-01-03", 7.0),
    ]


def test_una_encuesta_sin_inicio_publicado_conserva_su_fin():
    html = "<h3>Voting intention estimates</h3>" + _tabla("2026", "Sumar", [("Empresa A", "?–17 Nov", "6.5")])

    encuestas, _ = leer_wikipedia(html)

    assert [(e["empresa"], e["ini"], e["fin"]) for e in encuestas] == [("Empresa A", None, "2026-11-17")]



def test_la_pagina_de_2023_2024_aporta_sus_encuestas_y_el_resultado_de_2023():
    actual = "<h4>Voting intention estimates</h4>" + _tabla("2025", "Sumar", [("Empresa A", "6–9 Oct", "6.3")])
    # La página de 2023–2024 pone el año de cada tabla en un h3 bajo «Polling».
    anterior = ("<h2>Polling</h2>"
                + _tabla("2024", "Sumar", [("Empresa B", "27 Dec–3 Jan", "7.0")], nivel="h3")
                + _tabla("2023", "Sumar", [("2023 general election", "23 Jul", "12.3")], nivel="h3"))

    encuestas, resultado = leer_wikipedia(actual + anterior)

    assert [(e["empresa"], e["ini"], e["fin"]) for e in encuestas] == [
        ("Empresa A", "2025-10-06", "2025-10-09"),
        ("Empresa B", "2023-12-27", "2024-01-03"),
    ]
    assert (resultado["fecha"], resultado["v"]["SUMAR"]) == ("2023-07-23", 12.3)
