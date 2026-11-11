"""Antiinvención: toda cita que se publique tiene que aparecer literal en la transcripción."""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

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


def recuperar(cita: str, segmentos: list[Segmento], umbral: float = 0.8) -> tuple[Segmento, str] | None:
    """La cita y el segmento donde empieza. Si el modelo la copió con alguna palabra cambiada o partida entre dos
    trozos de la transcripción, el tramo que más se le parece, con las palabras tal como se dijeron: lo publicado
    sigue siendo literal. Se busca en todo lo que dice cada persona seguido (sin los «mhm» de los demás), con las
    palabras en el mismo orden (al menos `umbral` de ellas) y en un tramo de longitud parecida. None si no se parece
    a nada."""
    seg = localizar(cita, segmentos)
    if seg is not None:
        return seg, cita
    buscadas = normalizar(cita).split()
    n = len(buscadas)
    if n == 0:
        return None
    # Las palabras clave (las largas) dicen dónde mirar; con solo palabras cortas no hay forma fiable de ubicarla
    claves = {p for p in buscadas if len(p) >= 5}
    if not claves:
        return None
    mejor: tuple[int, Segmento, str] | None = None
    for hablante in dict.fromkeys(s.hablante for s in segmentos):
        # Todo lo que dice esa persona, seguido: (segmento, palabra tal cual, palabra normalizada)
        flujo = [
            (s, m.group(), normalizar(m.group()))
            for s in segmentos
            if s.hablante == hablante
            for m in re.finditer(r"\S+", s.texto)
            if normalizar(m.group())
        ]
        normales = [p for _, _, p in flujo]
        vistos: set[int] = set()
        for k, p in enumerate(normales):
            if p not in claves:
                continue
            inicio = max(0, k - n)
            if inicio in vistos:
                continue
            vistos.add(inicio)
            ventana = normales[inicio : k + n]
            bloques = [b for b in SequenceMatcher(None, buscadas, ventana, autojunk=False).get_matching_blocks() if b.size]
            aciertos = sum(b.size for b in bloques)
            if not bloques or aciertos < umbral * n:
                continue
            desde, hasta = inicio + bloques[0].b, inicio + bloques[-1].b + bloques[-1].size
            if hasta - desde > 1.3 * n:
                continue  # las palabras están demasiado repartidas: no es esa frase
            if mejor is None or aciertos > mejor[0]:
                mejor = (aciertos, flujo[desde][0], " ".join(t for _, t, _ in flujo[desde:hasta]))
    return (mejor[1], mejor[2]) if mejor else None
