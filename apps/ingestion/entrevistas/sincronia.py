"""Comprueba que los tiempos de la transcripción cuadran con el vídeo, contra los subtítulos de YouTube.

Gemini a veces desplaza los tiempos varios minutos (en el primer ensayo de Roberto Vaquero, el texto iba hasta
9 min por delante del vídeo). Los subtítulos automáticos de YouTube tienen tiempos fiables aunque su texto no lo
sea, así que se buscan en ellos trozos de cuatro palabras seguidas de cada frase y se mide la diferencia. No
corrige nada: avisa antes de publicar.
"""

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

from .citas import normalizar
from .esquema import Segmento

# Por debajo, la entrevista no se publica sin revisar los tiempos: con el modo audio, el 98 % cae a menos de 15 s.
MINIMO = 0.9
MARGEN = 15  # segundos
LEJOS = 60  # una frase así está claramente fuera de sitio


@dataclass
class Sincronia:
    comparables: int  # frases que se han encontrado en los subtítulos
    dentro: float  # parte de ellas a MARGEN segundos o menos de su sitio
    mediana: float  # desfase mediano, en segundos
    fuera: list[tuple[float, float, str]] = field(default_factory=list)  # (segundo, desfase, texto) a más de LEJOS

    @property
    def bien(self) -> bool:
        return self.comparables >= 20 and self.dentro >= MINIMO

    def resumen(self) -> str:
        return (
            f"{self.comparables} frases comparadas con los subtítulos de YouTube: {self.dentro:.0%} a ≤{MARGEN} s de su "
            f"sitio, desfase mediano {self.mediana:.1f} s, {len(self.fuera)} a más de {LEJOS} s"
        )


def descargar_subtitulos(url: str, carpeta: Path) -> Path | None:
    """Los subtítulos en español del vídeo (los automáticos si no hay otros), o None si YouTube no los da."""
    carpeta.mkdir(parents=True, exist_ok=True)
    previos = sorted(carpeta.glob("subtitulos.es*.json3"))
    if previos:
        return previos[0]
    r = subprocess.run(
        [
            sys.executable,
            "-m",
            "yt_dlp",
            "--no-playlist",
            "--skip-download",
            "--write-subs",
            "--write-auto-subs",
            "--sub-langs",
            "es.*",
            "--sub-format",
            "json3",
            "-o",
            str(carpeta / "subtitulos.%(ext)s"),
            url,
        ],
        capture_output=True,
        text=True,
    )
    encontrados = sorted(carpeta.glob("subtitulos.es*.json3"))
    if r.returncode or not encontrados:
        return None
    return encontrados[0]


def _palabras(ruta: Path) -> list[tuple[str, float]]:
    """Cada palabra de los subtítulos con el segundo en que empieza."""
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    palabras = []
    for evento in datos.get("events", []):
        for trozo in evento.get("segs") or []:
            segundo = (evento.get("tStartMs", 0) + trozo.get("tOffsetMs", 0)) / 1000
            palabras += [(p, segundo) for p in normalizar(trozo.get("utf8", "")).split()]
    return palabras


def medir(segmentos: list[Segmento], subtitulos: Path) -> Sincronia:
    """Para cada frase, dónde suenan sus trozos de cuatro palabras en los subtítulos frente a dónde deberían sonar
    dentro de su intervención (una intervención larga dura un minuto: su final no suena en su segundo inicial). De
    cada trozo cuenta la aparición más cercana, porque las muletillas se repiten en toda la entrevista; el desfase de
    la frase es la mediana de los de sus trozos."""
    palabras = _palabras(subtitulos)
    indice: dict[tuple[str, ...], list[float]] = {}
    for i in range(len(palabras) - 3):
        indice.setdefault(tuple(p for p, _ in palabras[i : i + 4]), []).append(palabras[i][1])
    desfases: list[tuple[float, float, str]] = []
    for s in segmentos:
        texto = normalizar(s.texto).split()
        if len(texto) < 8:
            continue  # frases cortas («sí, claro») se repiten en toda la entrevista
        propios = []
        for j in range(len(texto) - 3):
            veces = indice.get(tuple(texto[j : j + 4]))
            if veces:
                esperado = s.inicio + (s.fin - s.inicio) * j / len(texto)
                propios.append(min((t - esperado for t in veces), key=abs))
        # Hacen falta varios trozos para fiarse: con uno solo, una coincidencia casual decide
        if len(propios) < 3:
            continue
        propios.sort()
        desfases.append((s.inicio, propios[len(propios) // 2], s.texto))
    if not desfases:
        return Sincronia(comparables=0, dentro=0, mediana=0)
    absolutos = sorted(abs(d) for _, d, _ in desfases)
    return Sincronia(
        comparables=len(desfases),
        dentro=sum(d <= MARGEN for d in absolutos) / len(absolutos),
        mediana=absolutos[len(absolutos) // 2],
        fuera=[x for x in desfases if abs(x[1]) > LEJOS],
    )
