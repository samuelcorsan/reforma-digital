"""Métricas y nota sobre 10. Se calculan con código, no las decide el modelo (docs/plan.md, sección 4)."""

from __future__ import annotations

import random
import re

from .esquema import Ataque, Compromiso, Nota, Pregunta, PreguntaComunicacion, Propuesta, Revision, Segmento, Stats

PESOS = {
    "veracidad": 25,
    "alGrano": 20,
    "concrecion": 15,
    # Solo con análisis de comunicación: sin él, la nota se reparte entre los demás criterios
    "propone": 10,
    "sustancia": 15,
    "juegoLimpio": 10,
    "claridad": 5,
}
PUNTOS_VEREDICTO = {"legal": 1.0, "amarilla": 0.75, "fuera": 0.4, "roja": 0.0}
PUNTOS_RESPUESTA = {"directa": 1.0, "parcial": 0.6, "evasiva": 0.2, "cambio": 0.0}
# Las clases del análisis de comunicación, cuando la entrevista lo tiene: sustituye a las del análisis
PUNTOS_RESPUESTA |= {"responde": 1.0, "en_parte": 0.6, "otra_pregunta": 0.2, "ataca_pregunta": 0.2, "cambia_tema": 0.0}
DIRECTAS = {"directa", "responde"}
# Contestar cuando aprietan cuenta el doble
DURAS = {"incomoda", "repregunta", "insistencia"}
PUNTOS_ORIENTACION = {"propone": 1.0, "ambas": 0.5, "critica": 0.0}
FUERA = {"evasiva", "cambio", "otra_pregunta", "ataca_pregunta", "cambia_tema"}
CAMBIOS = {"cambio", "cambia_tema"}


def concrecion_de(p: Propuesta | Compromiso) -> float:
    """Qué, cuánto, cuándo y cómo de una propuesta. Un compromiso: 0,75 si se podrá comprobar y 1 si además dice
    cuándo."""
    if isinstance(p, Compromiso):
        return (1.0 if p.plazo else 0.75) if p.verificable else 0.0
    return (p.que + p.cuanto + p.cuando + p.como) / 4


def peso(p: Pregunta | PreguntaComunicacion) -> float:
    return 2.0 if isinstance(p, PreguntaComunicacion) and p.dureza in DURAS else 1.0


def encoger(puntos: list[float], previo: float = 0.7, k: int = 5, pesos: list[float] | None = None) -> float:
    """Con pocas observaciones la nota se acerca al centro: (Σ peso·puntos + k·previo) / (Σ pesos + k)."""
    pesos = pesos or [1.0] * len(puntos)
    return (sum(w * x for w, x in zip(pesos, puntos)) + k * previo) / (sum(pesos) + k)


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
    preguntas: list[Pregunta] | list[PreguntaComunicacion],
    propuestas: list[Propuesta] | list[Compromiso],
    ataques: list[Ataque],
    revisiones: list[Revision],
) -> dict[str, float]:
    publicadas = [r for r in revisiones if r.estado == "aprobada"]
    # Lo que no tiene fuente no dice nada de su veracidad: no cuenta
    veracidad = encoger([PUNTOS_VEREDICTO[r.veredicto] for r in publicadas if r.veredicto in PUNTOS_VEREDICTO])
    al_grano = encoger([PUNTOS_RESPUESTA[p.respuesta] for p in preguntas], pesos=[peso(p) for p in preguntas])
    concrecion = encoger([concrecion_de(p) for p in propuestas], previo=0.5, k=3)

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
    # Propone frente a critica: solo con las preguntas del análisis de comunicación, sin las que no hacen ninguna
    # de las dos cosas
    comunicacion = [p for p in preguntas if isinstance(p, PreguntaComunicacion)]
    if comunicacion:
        valores["propone"] = encoger(
            [PUNTOS_ORIENTACION[p.orientacion] for p in comunicacion if p.orientacion != "ninguna"], previo=0.5
        )
    return {k: round(10 * v, 1) for k, v in valores.items()}


def global_(crit: dict[str, float]) -> float:
    return sum(crit[k] * w for k, w in PESOS.items() if k in crit) / sum(w for k, w in PESOS.items() if k in crit)


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
    directas = sum(p.respuesta in DIRECTAS for p in preguntas)
    return Stats(
        alGrano=round(100 * directas / len(preguntas)) if preguntas else 0,
        remates=sum(concrecion_de(p) >= 0.75 for p in propuestas),
        entradas=len(ataques),
        balonesFuera=sum(p.respuesta in FUERA for p in preguntas),
        faltas=interrupciones,
        cambios=sum(p.respuesta in CAMBIOS for p in preguntas),
    )
