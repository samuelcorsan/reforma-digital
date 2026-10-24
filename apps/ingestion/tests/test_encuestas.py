"""La tabla de encuestas de Wikipedia, con HTML sintético que imita su estructura."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from escano.encuestas import leer_wikipedia


def _tabla(titulo: str, izquierda: str, filas: list[tuple[str, str, str]]) -> str:
    cabecera = "".join(f'<th><a title="{p}">{p}</a></th>' for p in ("PP", "PSOE", izquierda))
    cuerpo = "".join(
        f"<tr><td>{firma}</td><td>{fecha}</td><td>1,000</td><td>?</td><td>32.0</td><td>27.0</td><td>{izq}</td></tr>"
        for firma, fecha, izq in filas
    )
    return (f"<h5>{titulo}</h5><table class=\"wikitable\"><tr><th>Firm</th><th>Date</th><th>Sample</th><th>Turnout</th>"
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
