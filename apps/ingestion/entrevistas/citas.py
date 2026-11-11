"""Antiinvención: toda cita que se publique tiene que aparecer literal en la transcripción."""

from __future__ import annotations

import re
import unicodedata

from .esquema import Segmento


def normalizar(texto: str) -> str:
    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9% ]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def en_contraste(cita: str, segundo: float, otra: list[Segmento], ventana: float = 90, umbral: float = 0.6) -> bool:
    """Si la cita también está en otra transcripción independiente (la del vídeo), cerca del mismo minuto.
    Se compara por trigramas de palabras: dos transcripciones nunca coinciden letra a letra."""
    palabras = normalizar(cita).split()
    if len(palabras) < 3:
        return bool(palabras) and normalizar(cita) in normalizar(" ".join(s.texto for s in otra))
    cerca = " ".join(s.texto for s in otra if abs(s.inicio - segundo) <= ventana)
    texto = f" {normalizar(cerca)} "
    trigramas = [" ".join(palabras[k : k + 3]) for k in range(len(palabras) - 2)]
    return sum(f" {t} " in texto for t in trigramas) / len(trigramas) >= umbral


def coincidencia(a: list[Segmento], b: list[Segmento]) -> float:
    """Qué parte de los trigramas de palabras de `a` aparece también en `b` (0 a 1)."""
    pa = normalizar(" ".join(s.texto for s in a)).split()
    trigramas = {" ".join(pa[k : k + 3]) for k in range(len(pa) - 2)}
    if not trigramas:
        return 1.0
    pb = normalizar(" ".join(s.texto for s in b)).split()
    otros = {" ".join(pb[k : k + 3]) for k in range(len(pb) - 2)}
    return len(trigramas & otros) / len(trigramas)


def localizar(cita: str, segmentos: list[Segmento]) -> Segmento | None:
    """Devuelve el segmento donde aparece la cita literal (ignorando mayúsculas, tildes y puntuación), o None."""
    objetivo = normalizar(cita)
    if not objetivo:
        return None
    for s in segmentos:
        if objetivo in normalizar(s.texto):
            return s
    return None
