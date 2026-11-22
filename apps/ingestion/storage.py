"""Estado privado y archivos originales en Vercel Blob; nunca en Git."""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, UTC
from pathlib import Path

from vercel.blob import BlobClient


def put(path: str, file: Path) -> str:
    with BlobClient(token=os.environ["BLOB_READ_WRITE_TOKEN"]) as client, file.open("rb") as body:
        return client.put(path, body, access="private", multipart=True, overwrite=True).url


def get(url: str, destination: Path) -> None:
    with BlobClient(token=os.environ["BLOB_READ_WRITE_TOKEN"]) as client:
        result = client.get(url, access="private", timeout=180, use_cache=False)
        if result.status_code != 200:
            raise RuntimeError("Blob: no se ha podido restaurar el archivo")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(result.content)


def raw_file(path: Path, *, save: bool, source: str | None = None) -> bool:
    """Cada descarga se almacena por su hash; el manifiesto viaja en el checkpoint."""
    from escano.config import CRUDOS, DATOS
    if not os.environ.get("BLOB_READ_WRITE_TOKEN"):
        return False
    manifest = DATOS / "raw-index.json"
    entries = json.loads(manifest.read_text()) if manifest.exists() else {}
    name = path.relative_to(CRUDOS).as_posix()
    if not save:
        if name not in entries:
            return False
        get(entries[name]["url"], path)
        if hashlib.sha256(path.read_bytes()).hexdigest() != entries[name]["sha256"]:
            path.unlink()
            raise ValueError("Blob: el hash del original no coincide")
        return True
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if entries.get(name, {}).get("sha256") != digest:
        previous = entries.get(name, {})
        history = previous.get("versions", [])
        if previous:
            history = [*history, {k: v for k, v in previous.items() if k != "versions"}]
        entries[name] = {"sha256": digest, "url": put(f"congreso/raw/{digest}/{path.name}", path),
                         "source": source, "downloaded_at": datetime.now(UTC).isoformat(), "versions": history}
        temporary = manifest.with_suffix(".tmp")
        temporary.write_text(json.dumps(entries))
        temporary.replace(manifest)
    return True


def delete(urls: list[str]) -> None:
    if urls:
        with BlobClient(token=os.environ["BLOB_READ_WRITE_TOKEN"]) as client:
            client.delete(urls)
