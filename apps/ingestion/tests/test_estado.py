"""El organigrama del BOE, con eventos sintéticos."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from escano import estado


def _nombramiento(fecha: str, cargo: str, persona: str, boe: str) -> dict:
    return {"fecha": fecha, "tipo": "nombramiento", "cargo": cargo, "persona": persona, "genero": "f",
            "departamento": "Ministerio de Pruebas", "boe": boe, "disposicion": f"Real Decreto {boe}"}


def test_un_cargo_que_queda_vacante_sin_cese_publicado_no_tiene_boe_de_cese(monkeypatch, tmp_path):
    monkeypatch.setattr(estado, "DATOS", tmp_path)
    monkeypatch.setattr(estado.boe, "leer", lambda: {"hasta": "2026-11-20", "eventos": [
        _nombramiento("2026-10-01", "Directora General de Ensayos", "Ana Pérez López", "BOE-A-2026-1"),
        _nombramiento("2026-11-18", "Secretaria General de Pruebas", "Ana Pérez López", "BOE-A-2026-2"),
    ]})

    salida = estado.construir()

    assert [(v["cargo"], v["persona"], v["desde"], v["boe"]) for v in salida["sin_sustituto"]] == [
        ("Director General de Ensayos", "Ana Pérez López", "2026-11-18", None)]
