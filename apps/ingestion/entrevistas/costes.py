"""Coste y tiempo reales de cada paso, a partir de lo que la API dice que ha consumido (usage_metadata)."""

from __future__ import annotations

import threading
from dataclasses import asdict, dataclass

# USD por millón de tokens. Precio de lanzamiento de Gemini 3.8 Flash, vigente hasta el 31/12/2026.
# La página no da un precio de audio aparte para este modelo: se asume igual que el texto (revisar en el ensayo).
# Fuente: https://ai.google.dev/gemini-api/docs/pricing
PRECIOS = {
    "gemini-3.8-flash": {"entrada": 0.75, "audio": 0.75, "salida": 3.75},
}
# Búsquedas de Google (Gemini 3): 5.000 gratis al mes compartidas; después, 14 $ por cada 1.000.
PRECIO_BUSQUEDA = 14 / 1000


@dataclass
class Paso:
    llamadas: int = 0
    entrada_texto: int = 0
    entrada_audio: int = 0
    salida: int = 0
    razonamiento: int = 0
    busquedas: int = 0
    segundos: float = 0.0


class Contador:
    """Suma lo consumido por paso (transcripción, análisis, verificación, dictamen). Seguro entre hilos."""

    def __init__(self, modelo: str):
        self.modelo = modelo
        self.pasos: dict[str, Paso] = {}
        self._cerrojo = threading.Lock()

    def anotar(self, paso: str, uso, *, busquedas: int = 0, segundos: float = 0.0) -> None:
        audio = 0
        for d in (getattr(uso, "prompt_tokens_details", None) or []) if uso else []:
            if "AUDIO" in str(getattr(d, "modality", "")):
                audio += d.token_count or 0
        entrada = (getattr(uso, "prompt_token_count", 0) or 0) if uso else 0
        # Lo que devuelve la búsqueda de Google también entra al modelo como texto
        herramientas = (getattr(uso, "tool_use_prompt_token_count", 0) or 0) if uso else 0
        with self._cerrojo:
            p = self.pasos.setdefault(paso, Paso())
            p.llamadas += 1
            p.entrada_audio += audio
            p.entrada_texto += entrada - audio + herramientas
            p.salida += (getattr(uso, "candidates_token_count", 0) or 0) if uso else 0
            p.razonamiento += (getattr(uso, "thoughts_token_count", 0) or 0) if uso else 0
            p.busquedas += busquedas
            p.segundos += segundos

    def coste(self, p: Paso) -> float | None:
        precio = PRECIOS.get(self.modelo)
        if not precio:
            return None
        return (
            p.entrada_texto * precio["entrada"]
            + p.entrada_audio * precio["audio"]
            # El razonamiento se cobra como salida
            + (p.salida + p.razonamiento) * precio["salida"]
        ) / 1_000_000

    def resumen(self) -> dict:
        pasos = {k: {**asdict(p), "coste_usd": self.coste(p)} for k, p in self.pasos.items()}
        busquedas = sum(p.busquedas for p in self.pasos.values())
        tokens = [c["coste_usd"] for c in pasos.values()]
        return {
            "modelo": self.modelo,
            "pasos": pasos,
            "coste_modelo_usd": None if None in tokens else round(sum(tokens), 4),
            "busquedas": busquedas,
            "coste_busquedas_si_se_pagan_usd": round(busquedas * PRECIO_BUSQUEDA, 2),
        }

    def tabla(self) -> str:
        filas = [f"{'paso':<14}{'llamadas':>9}{'audio':>10}{'texto':>10}{'salida':>9}{'razona':>9}{'busq.':>7}{'seg.':>7}{'USD':>8}"]
        for k, p in self.pasos.items():
            c = self.coste(p)
            filas.append(
                f"{k:<14}{p.llamadas:>9}{p.entrada_audio:>10}{p.entrada_texto:>10}{p.salida:>9}"
                f"{p.razonamiento:>9}{p.busquedas:>7}{p.segundos:>7.0f}{'?' if c is None else f'{c:.3f}':>8}"
            )
        r = self.resumen()
        total = "?" if r["coste_modelo_usd"] is None else f"{r['coste_modelo_usd']:.2f}"
        filas.append(
            f"Total modelo: {total} USD · {r['busquedas']} búsquedas de Google "
            f"(gratis dentro de 5.000/mes; si no, {r['coste_busquedas_si_se_pagan_usd']:.2f} USD)"
        )
        return "\n".join(filas)
