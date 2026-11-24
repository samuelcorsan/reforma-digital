"""Descargas con caché en disco y reintentos."""
from __future__ import annotations

import hashlib
import time
from pathlib import Path

import requests

from .config import CRUDOS, USER_AGENT

_sesion = requests.Session()
_sesion.headers["User-Agent"] = USER_AGENT


def descargar(url: str, destino: Path | None = None, *, reintentos: int = 3, cache: bool = True,
              archivar: bool = True) -> bytes | None:
    """Descarga `url`. Devuelve None si el recurso no existe (404).

    Si `cache` es True guarda el fichero en data/raw y no vuelve a pedirlo.
    """
    if destino is None:
        nombre = url.rstrip("/").split("/")[-1].split("?")[0] or "index"
        destino = CRUDOS / f"{hashlib.sha1(url.encode()).hexdigest()[:10]}-{nombre}"
    if cache and destino.exists():
        return destino.read_bytes()

    if cache:
        from storage import raw_file
        if raw_file(destino, save=False):
            return destino.read_bytes()

    for intento in range(reintentos):
        try:
            r = _sesion.get(url, timeout=60)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            destino.parent.mkdir(parents=True, exist_ok=True)
            temporal = destino.with_suffix(destino.suffix + ".tmp")
            temporal.write_bytes(r.content)
            temporal.replace(destino)
            if archivar:
                from storage import raw_file
                raw_file(destino, save=True, source=url)
            time.sleep(0.5)  # ser amables con el servidor del Congreso
            return r.content
        except requests.RequestException:
            if intento == reintentos - 1:
                raise
            time.sleep(2 ** intento)
    return None
