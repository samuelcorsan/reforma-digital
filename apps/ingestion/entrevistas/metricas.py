"""Métricas y nota sobre 10. Se calculan con código, no las decide el modelo (docs/plan.md, sección 4)."""

from __future__ import annotations

import random
import re

from .esquema import Nota, Pregunta, Propuesta, Ataque, Revision, Segmento, Stats

PESOS = {"veracidad": 25, "alGrano": 25, "concrecion": 20, "sustancia": 15, "juegoLimpio": 10, "claridad": 5}
PUNTOS_VEREDICTO = {"legal": 1.0, "amarilla": 0.75, "fuera": 0.4, "roja": 0.0}
PUNTOS_RESPUESTA = {"directa": 1.0, "parcial": 0.6, "evasiva": 0.2, "cambio": 0.0}


def encoger(puntos: list[float], previo: float = 0.7, k: int = 5) -> float:
    """Con pocas observaciones la nota se acerca al centro: (Σ puntos + k·previo) / (n + k)."""
    return (sum(puntos) + k * previo) / (len(puntos) + k)


def silabas(palabra: str) -> int:
    return max(1, len(re.findall(r"[aeiouáéíóúü]+", palabra.lower())))


def legibilidad(texto: str) -> float:
    """Índice de Fernández-Huerta (español): 206,84 − 0,60·P − 1,02·F, con P sílabas y F frases por cada 100 palabras."""
    palabras = re.findall(r"[a-záéíóúüñ]+", texto.lower())
    if not palabras:
        return 60.0
    frases = max(1, len(re.findall(r"[.!?]+", texto)))
    p = 100 * sum(silabas(w) for w in palabras) / len(palabras)
    f = 100 * frases / len(palabras)
    return 206.84 - 0.60 * p - 1.02 * f


def criterios(
    segmentos: list[Segmento],
    preguntas: list[Pregunta],
    propuestas: list[Propuesta],
    ataques: list[Ataque],
    revisiones: list[Revision],
) -> dict[str, float]:
    publicadas = [r for r in revisiones if r.estado == "aprobada"]
    veracidad = encoger([PUNTOS_VEREDICTO[r.veredicto] for r in publicadas])
    al_grano = encoger([PUNTOS_RESPUESTA[p.respuesta] for p in preguntas])
    concrecion = encoger([(p.que + p.cuanto + p.cuando + p.como) / 4 for p in propuestas], previo=0.5, k=3)

    del_candidato = [s for s in segmentos if s.hablante == "candidato"]
    tiempo = sum(s.fin - s.inicio for s in del_candidato) or 1
    momentos = {p.segundo for p in propuestas} | {r.segundo for r in publicadas}
    con_sustancia = sum(
        s.fin - s.inicio
        for s in del_candidato
        if re.search(r"\d", s.texto) or any(s.inicio - 1 <= m <= s.fin for m in momentos)
    )
    sustancia = min(1.0, 1.6 * con_sustancia / tiempo)

    juego = encoger([1.0 if a.tipo == "politica" else 0.0 for a in ataques], previo=0.8, k=3)
    juego = max(0.0, juego - 0.05 * sum(a.tipo == "personal" for a in ataques))

    lectura = legibilidad(" ".join(s.texto for s in del_candidato))
    claridad = min(1.0, max(0.0, (lectura - 30) / 60))

    valores = {
        "veracidad": veracidad,
        "alGrano": al_grano,
        "concrecion": concrecion,
        "sustancia": sustancia,
        "juegoLimpio": juego,
        "claridad": claridad,
    }
    return {k: round(10 * v, 1) for k, v in valores.items()}


def global_(crit: dict[str, float]) -> float:
    return sum(crit[k] * w for k, w in PESOS.items()) / sum(PESOS.values())


def nota(segmentos, preguntas, propuestas, ataques, revisiones, iteraciones: int = 300, semilla: int = 29) -> Nota:
    """Nota global con margen de error por remuestreo (bootstrap) de preguntas y revisiones."""
    crit = criterios(segmentos, preguntas, propuestas, ataques, revisiones)
    rng = random.Random(semilla)
    muestras = []
    for _ in range(iteraciones):
        pr = [rng.choice(preguntas) for _ in preguntas] if preguntas else []
        rv = [rng.choice(revisiones) for _ in revisiones] if revisiones else []
        muestras.append(global_(criterios(segmentos, pr, propuestas, ataques, rv)))
    muestras.sort()
    margen = (muestras[int(0.95 * len(muestras)) - 1] - muestras[int(0.05 * len(muestras))]) / 2
    return Nota(**{"global": round(global_(crit), 1), "margen": round(max(0.2, margen), 1), "criterios": crit})


def estadisticas(preguntas, propuestas, ataques, interrupciones: int) -> Stats:
    directas = sum(p.respuesta == "directa" for p in preguntas)
    return Stats(
        alGrano=round(100 * directas / len(preguntas)) if preguntas else 0,
        remates=sum((p.que + p.cuanto + p.cuando + p.como) >= 3 for p in propuestas),
        entradas=len(ataques),
        balonesFuera=sum(p.respuesta in ("evasiva", "cambio") for p in preguntas),
        faltas=interrupciones,
        cambios=sum(p.respuesta == "cambio" for p in preguntas),
    )
