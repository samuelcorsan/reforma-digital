"""Descarga del audio (yt-dlp) y troceado (ffmpeg); el vídeo, por tramos desde YouTube sin descargar nada o, si no
está en YouTube (RTVE Play…), descargado y troceado en baja resolución."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Trozo:
    """Un tramo de la entrevista que se transcribe de una vez."""

    desfase: float  # segundo de la entrevista en el que empieza
    largo: float  # duración en segundos
    audio: Path | None = None  # modo audio: archivo del trozo
    url: str | None = None  # modo vídeo: Gemini lee el tramo directamente de YouTube
    video: Path | None = None  # modo vídeo fuera de YouTube: archivo del tramo, que se sube como el audio

    @property
    def es_video(self) -> bool:
        return bool(self.url or self.video)

    @property
    def nombre(self) -> str:
        return self.audio.name if self.audio else f"vídeo {int(self.desfase // 60)}-{int((self.desfase + self.largo) // 60)} min"


@dataclass
class Video:
    id: str
    titulo: str
    duracion: float
    publicado: str
    audio: Path


def descargar(url: str, carpeta: Path) -> Video:
    carpeta.mkdir(parents=True, exist_ok=True)
    previo = _video(carpeta)
    if previo and previo.id in url:
        return previo  # ya descargado: al repetir un análisis no se vuelve a bajar
    for viejo in carpeta.glob("audio.*"):
        viejo.unlink()
    subprocess.run(
        [
            # El yt-dlp del entorno del pipeline (requirements.txt), no el del sistema, que puede estar desfasado
            sys.executable,
            "-m",
            "yt_dlp",
            "--no-playlist",
            "-f",
            "bestaudio",
            # Sin convertir: el troceado ya pasa el audio a mono 16 kHz (convertir aquí costaba ~2 min por entrevista)
            "--write-info-json",
            "-o",
            str(carpeta / "audio.%(ext)s"),
            url,
        ],
        check=True,
    )
    video = _video(carpeta)
    if not video:
        raise RuntimeError(f"yt-dlp no dejó el audio en {carpeta}")
    return video


def _video(carpeta: Path) -> Video | None:
    """El audio ya descargado en la carpeta (con su info.json), o None."""
    ruta_info = carpeta / "audio.info.json"
    audios = [p for p in carpeta.glob("audio.*") if not p.name.endswith((".json", ".part", ".ytdl"))]
    if not ruta_info.exists() or not audios:
        return None
    info = json.loads(ruta_info.read_text())
    fecha = info.get("upload_date") or ""
    publicado = f"{fecha[:4]}-{fecha[4:6]}-{fecha[6:8]}" if len(fecha) == 8 else ""
    return Video(
        id=info["id"],
        titulo=info.get("title", ""),
        duracion=float(info.get("duration") or 0),
        publicado=publicado,
        audio=audios[0],
    )


def informacion(url: str) -> dict:
    """Metadatos del vídeo (título, duración, fecha) sin descargarlo."""
    r = subprocess.run(
        [sys.executable, "-m", "yt_dlp", "--no-playlist", "--skip-download", "--dump-json", url],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(r.stdout)


def video_sin_descarga(url: str) -> Video:
    info = informacion(url)
    fecha = info.get("upload_date") or ""
    return Video(
        id=info["id"],
        titulo=info.get("title", ""),
        duracion=float(info.get("duration") or 0),
        publicado=f"{fecha[:4]}-{fecha[4:6]}-{fecha[6:8]}" if len(fecha) == 8 else "",
        audio=Path(),
    )


def trozos_video(url: str, duracion: float, minutos: int = 5) -> list[Trozo]:
    """Tramos del vídeo de YouTube: Gemini los recorta él mismo, no hay que descargar nada."""
    paso = minutos * 60
    return [Trozo(desfase=d, largo=min(paso, duracion - d), url=url) for d in range(0, int(duracion), paso)]


def es_youtube(url: str) -> bool:
    return bool(re.search(r"(^|\.|//)(youtube\.com|youtu\.be)/", url))


def descargar_video(url: str, carpeta: Path) -> Path:
    """Solo para vídeos fuera de YouTube: Gemini no puede leerlos por URL. Se baja la imagen (sin sonido, el audio ya
    está descargado) en la menor calidad disponible hasta 720p, y se reutiliza si ya está."""
    previo = next(iter(sorted(carpeta.glob("video.*"))), None)
    if previo:
        return previo
    subprocess.run(
        [
            sys.executable, "-m", "yt_dlp", "--no-playlist", "-N", "8",
            "-f", "wv*[height>=360][height<=720]/bv*[height<=720]/wv*",
            "-o", str(carpeta / "video.%(ext)s"), url,
        ],
        check=True,
    )
    previo = next(iter(sorted(carpeta.glob("video.*"))), None)
    if not previo:
        raise RuntimeError(f"yt-dlp no dejó el vídeo en {carpeta}")
    return previo


def trocear_video(video: Path, audio: Path, duracion: float, minutos: int = 5, hilos: int = 6) -> list[Trozo]:
    """Tramos de vídeo ligeros para subirlos a Gemini: 360p a 1 imagen por segundo (Gemini muestrea a 1 fps) con el
    audio mono de 16 kHz. Cada tramo pesa unos pocos MB; se generan en paralelo."""
    from concurrent.futures import ThreadPoolExecutor

    destino = video.parent / "trozos-video"
    destino.mkdir(exist_ok=True)
    paso = minutos * 60

    def uno(k: int) -> Trozo:
        desde = k * paso
        largo = min(paso, duracion - desde)
        salida = destino / f"tramo_{k:03d}.mp4"
        if not salida.exists():
            subprocess.run(
                [
                    "ffmpeg", "-loglevel", "error", "-y",
                    "-ss", str(desde), "-t", str(largo), "-i", str(video),
                    "-ss", str(desde), "-t", str(largo), "-i", str(audio),
                    "-map", "0:v:0", "-map", "1:a:0",
                    "-vf", "scale=-2:360,fps=1", "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
                    "-ac", "1", "-ar", "16000", "-c:a", "aac", "-b:a", "48k",
                    str(salida.with_suffix(".tmp.mp4")),
                ],
                check=True,
            )
            salida.with_suffix(".tmp.mp4").rename(salida)
        return Trozo(desfase=float(desde), largo=largo, video=salida)

    with ThreadPoolExecutor(max_workers=hilos) as ex:
        return list(ex.map(uno, range(int(-(-duracion // paso)))))


def duracion_de(ruta: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ruta)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(r.stdout.strip())


def silencios(audio: Path, hasta: float | None = None, umbral_db: int = -35, minimo: float = 0.5) -> list[list[float]]:
    """Silencios reales del audio (ffmpeg silencedetect): sirven para medir cuánto tarda alguien en responder.
    Los tiempos de Gemini van pegados turno a turno y no dejan ver las pausas."""
    r = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-nostats", "-i", str(audio), *(["-t", str(hasta)] if hasta else []),
            "-af", f"silencedetect=n={umbral_db}dB:d={minimo}", "-f", "null", "-",
        ],
        capture_output=True,
        text=True,
    )
    inicios = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    finales = [float(m) for m in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    return [[round(a, 2), round(b, 2)] for a, b in zip(inicios, finales)]


def trocear(audio: Path, minutos: int = 5, hasta: float | None = None) -> list[Trozo]:
    """Trozos de audio mono a 16 kHz (más ligeros para el modelo). Trozos cortos: los tiempos que devuelve el
    modelo se desvían menos. `hasta` (segundos) limita el troceado al principio de la entrevista (ensayos)."""
    destino = audio.parent / "trozos"
    destino.mkdir(exist_ok=True)
    for viejo in destino.glob("trozo_*.m4a"):
        viejo.unlink()
    subprocess.run(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-i",
            str(audio),
            *(["-t", str(hasta)] if hasta else []),
            "-f",
            "segment",
            "-segment_time",
            str(minutos * 60),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "aac",
            str(destino / "trozo_%03d.m4a"),
        ],
        check=True,
    )
    trozos = sorted(destino.glob("trozo_*.m4a"))
    return [Trozo(desfase=k * minutos * 60.0, largo=duracion_de(t), audio=t) for k, t in enumerate(trozos)]
