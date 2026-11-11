"""Acceso al modelo. `ClienteGemini` usa la API real; `ClienteSimulado` permite probar todo sin clave ni coste."""

from __future__ import annotations

import logging
import os
import random
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from . import prompts
from .costes import Contador
from .esquema import (
    Agrupacion,
    Decision,
    Dictamen,
    Eleccion,
    Extraccion,
    Fuente,
    Segmento,
    Transcripcion,
    TranscripcionCruda,
    TranscripcionVideoCruda,
    Visual,
    a_segundos,
)

log = logging.getLogger("entrevistas")

MODELO_POR_DEFECTO = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")

# Cuánto razona el modelo en cada paso (el razonamiento se cobra como salida y añade espera).
# Transcribir no necesita razonar; clasificar la entrevista sí. None = lo que el modelo haga por defecto.
RAZONAR = {
    "transcripcion": "low",
    "analisis": None,
    "momentos": None,
    "comunes": None,
    "verificacion": "medium",
    "dictamen": "low",
    "revision": "medium",
    "decision": "low",
}

# Errores pasajeros de la API que merece la pena reintentar (límite de ritmo, sobrecarga…)
REINTENTABLES = {408, 429, 500, 502, 503, 504}

# Los enlaces de la búsqueda de Google llegan como redirecciones temporales: nunca se publican tal cual
REDIRECCION_GOOGLE = "vertexaisearch.cloud.google.com"

# Fuentes: primero las oficiales; vídeos y redes sociales nunca sirven de prueba
OFICIALES = (
    ".gob.es", "ine.es", "boe.es", "congreso.es", "senado.es", "bde.es", "airef.es", "seg-social.es", "cis.es",
    "poderjudicial.es", "tribunalconstitucional.es", "europa.eu", "oecd.org", "un.org", "who.int", "imf.org",
    "worldbank.org", ".gov", ".gob.mx", "sepe.es", "cnmc.es", "tcu.es", "defensordelpueblo.es", "gencat.cat",
    "juntadeandalucia.es", "comunidad.madrid", "madrid.org", "euskadi.eus", "xunta.gal", "gva.es",
)
# Ni vídeos ni redes; tampoco Wikipedia (no es fuente primaria) ni webs que transcriben podcasts (prueba circular)
NO_VALEN = (
    "youtube.com", "youtu.be", "x.com", "twitter.com", "facebook.com", "instagram.com", "tiktok.com",
    "wikipedia.org", "wikidata.org", "happyscribe.com", "podscripts.co", "ivoox.com", "spotify.com",
    "blogspot.com", "wordpress.com", "medium.com",
)


def con_reintentos(fn, que: str, intentos: int = 5):
    """Repite `fn` ante cortes de red (TLS, conexión, tiempo de espera) con esperas crecientes."""
    import httpx

    for k in range(intentos):
        try:
            return fn()
        except httpx.TransportError as e:
            if k == intentos - 1:
                raise
            espera = min(30.0, 2 ** (k + 1)) + random.random()
            log.warning("%s: fallo de red (%s), reintento en %.0f s", que, type(e).__name__, espera)
            time.sleep(espera)


def dominio(url: str) -> str:
    return urlparse(url).netloc.lower().removeprefix("www.")


def es_oficial(url: str) -> bool:
    d = dominio(url)
    return any(d == o.lstrip(".") or d.endswith("." + o.lstrip(".")) for o in OFICIALES)


def ordenar_fuentes(fuentes: list[Fuente]) -> list[Fuente]:
    """Quita vídeos y redes, y pone primero las fuentes oficiales (manteniendo el orden dentro de cada grupo)."""
    validas = [f for f in fuentes if not any(dominio(f.url) == d or dominio(f.url).endswith("." + d) for d in NO_VALEN)]
    return sorted(validas, key=lambda f: not es_oficial(f.url))


@dataclass
class Comprobacion:
    dictamen: Dictamen
    fuentes: list[Fuente]


@dataclass
class Revisado:
    """La segunda revisión: la decisión y las fuentes que encontró por su cuenta."""

    decision: Decision
    fuentes: list[Fuente]


def url_final(url: str, espera: float = 5.0) -> str | None:
    """Destino real de un enlace de la búsqueda de Google, o None si no se puede resolver.
    Algunas webs oficiales rechazan HEAD, así que se prueba también con GET (sin leer el cuerpo)."""
    for metodo in ("HEAD", "GET"):
        try:
            peticion = urllib.request.Request(url, method=metodo, headers={"User-Agent": "Mozilla/5.0 (Reforma Digital)"})
            with urllib.request.urlopen(peticion, timeout=espera) as r:
                destino = r.geturl()
        except Exception:
            continue
        if destino.startswith("http") and REDIRECCION_GOOGLE not in urlparse(destino).netloc:
            return destino
    return None


def titulo_fuente(titulo: str, url: str) -> str:
    """Si el modelo solo da el dominio como título, se usa el dominio limpio (sin www)."""
    dominio = urlparse(url).netloc.removeprefix("www.")
    return titulo if titulo and titulo not in (url, dominio, "www." + dominio) else dominio


class Cliente(Protocol):
    def transcribir(self, trozo, candidato: str, contexto: str = "", intento: int = 0) -> Transcripcion: ...
    def extraer(self, transcripcion: str, candidato: str, bloque: str = "la entrevista completa") -> Extraccion: ...
    def elegir_momentos(self, lista: str, candidato: str) -> list[int]: ...
    def comprobar(self, cita: str, contexto: str, candidato: str, fecha: str) -> Comprobacion: ...
    def revisar(self, cita: str, contexto: str, candidato: str, fecha: str, propuesta: Comprobacion) -> Revisado: ...


class ClienteGemini:
    def __init__(self, modelo: str = MODELO_POR_DEFECTO):
        from google import genai

        clave = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not clave:
            raise SystemExit("Falta GEMINI_API_KEY (ver pipeline/.env.example).")
        self.genai = genai
        self.cliente = genai.Client(api_key=clave)
        self.modelo = modelo
        self.contador = Contador(modelo)
        self._sin_razonar = False  # si el modelo no acepta thinking_level, se deja de enviar
        # None: entrevista de Jordi. En ensayos con otras entrevistas, quien la conduce ("" si no se sabe)
        self.entrevistador: str | None = None

    def _generar(self, paso: str, contenidos, *, intentos: int = 5, **config):
        """Llamada al modelo con reintentos ante errores pasajeros; anota consumo y tiempo del paso."""
        from google.genai import errors, types

        nivel = RAZONAR.get(paso)
        for k in range(intentos):
            extra = {}
            if nivel and not self._sin_razonar:
                extra["thinking_config"] = types.ThinkingConfig(thinking_level=nivel)
            inicio = time.time()
            try:
                r = con_reintentos(
                    lambda: self.cliente.models.generate_content(
                        model=self.modelo,
                        contents=contenidos,
                        config=types.GenerateContentConfig(system_instruction=prompts.SISTEMA, **config, **extra),
                    ),
                    paso,
                )
            except errors.APIError as e:
                if e.code == 400 and extra and "think" in str(e).lower():
                    log.warning("El modelo no acepta thinking_level: se usa su razonamiento por defecto")
                    self._sin_razonar = True
                    continue
                if e.code == 429 and "free_tier" in str(e).lower():
                    # El plan gratuito permite ~5 peticiones por minuto: reintentar no sirve, hay que activar facturación
                    raise SystemExit(
                        "La clave de Gemini está en el plan gratuito (5 peticiones/minuto). Activa la facturación del "
                        "proyecto en https://aistudio.google.com/ y vuelve a lanzar el análisis."
                    ) from e
                if e.code not in REINTENTABLES or k == intentos - 1:
                    raise
                espera = min(60.0, 2 ** (k + 1)) + random.random()
                log.warning("%s: error %s, reintento en %.0f s", paso, e.code, espera)
                time.sleep(espera)
                continue
            meta = r.candidates[0].grounding_metadata if r.candidates else None
            busquedas = len(getattr(meta, "web_search_queries", None) or [])
            self.contador.anotar(paso, r.usage_metadata, busquedas=busquedas, segundos=time.time() - inicio)
            return r
        raise RuntimeError(f"{paso}: sin respuesta tras {intentos} intentos")

    def _json(self, paso: str, contenidos, esquema, temperatura: float = 0.0, **config):
        r = self._generar(
            paso,
            contenidos,
            temperature=temperatura,
            response_mime_type="application/json",
            response_schema=esquema,
            **config,
        )
        if r.parsed is None:
            return esquema.model_validate_json(r.text)
        return r.parsed

    def _subir(self, ruta: Path):
        archivo = con_reintentos(lambda: self.cliente.files.upload(file=str(ruta)), f"subida de {ruta.name}")
        # El archivo tarda unos segundos en procesarse antes de poder usarse (el vídeo, algo más)
        while getattr(archivo.state, "name", str(archivo.state)) == "PROCESSING":
            time.sleep(2)
            nombre = archivo.name
            archivo = con_reintentos(lambda: self.cliente.files.get(name=nombre), f"estado de {ruta.name}")
        return archivo

    def transcribir(self, trozo, candidato: str, contexto: str = "", intento: int = 0) -> Transcripcion:
        from google.genai import types

        largo = int(trozo.largo)
        texto = prompts.TRANSCRIBIR.format(
            medio="vídeo" if trozo.es_video else "audio",
            **prompts.presentacion(self.entrevistador, candidato),
            candidato=candidato,
            largo=largo,
            fin_mmss=f"{largo // 60:02d}:{largo % 60:02d}",
            extra=prompts.VISUAL if trozo.es_video else "",
            contexto=contexto,
        )
        # En el reintento, algo de variación para no repetir el mismo fallo
        temperatura = 0.0 if intento == 0 else 0.4
        if trozo.url:
            # Vídeo de YouTube recortado por Gemini, en baja resolución (~100 tokens/s en vez de ~300)
            parte = types.Part(
                file_data=types.FileData(file_uri=trozo.url),
                video_metadata=types.VideoMetadata(
                    start_offset=f"{int(trozo.desfase)}s", end_offset=f"{int(trozo.desfase + trozo.largo)}s"
                ),
            )
            return self._a_segundos(
                self._json(
                    "transcripcion",
                    [parte, texto],
                    TranscripcionVideoCruda,
                    temperatura=temperatura,
                    media_resolution=types.MediaResolution.MEDIA_RESOLUTION_LOW,
                )
            )
        # Archivo local: un trozo de audio o, fuera de YouTube, un tramo de vídeo ya reducido
        archivo = self._subir(trozo.video or trozo.audio)
        try:
            if trozo.video:
                return self._a_segundos(
                    self._json(
                        "transcripcion",
                        [archivo, texto],
                        TranscripcionVideoCruda,
                        temperatura=temperatura,
                        media_resolution=types.MediaResolution.MEDIA_RESOLUTION_LOW,
                    )
                )
            return self._a_segundos(self._json("transcripcion", [archivo, texto], TranscripcionCruda, temperatura=temperatura))
        finally:
            try:
                self.cliente.files.delete(name=archivo.name)  # caducaría a las 48 h; se borra en cuanto se usa
            except Exception:
                pass

    @staticmethod
    def _a_segundos(t: TranscripcionCruda) -> Transcripcion:
        return Transcripcion(
            segmentos=[
                Segmento(inicio=a_segundos(s.inicio), fin=a_segundos(s.fin), hablante=s.hablante, texto=s.texto)
                for s in t.segmentos
            ],
            visuales=[
                Visual(segundo=int(a_segundos(v.inicio)), tipo=v.tipo, descripcion=v.descripcion)
                for v in getattr(t, "visual", [])
            ],
        )

    def extraer(self, transcripcion: str, candidato: str, bloque: str = "la entrevista completa") -> Extraccion:
        texto = prompts.ANALIZAR.format(candidato=candidato, bloque=bloque, transcripcion=transcripcion)
        return self._json("analisis", [texto], Extraccion)

    def agrupar_comunes(self, lista: str) -> Agrupacion:
        return self._json("comunes", [prompts.AGRUPAR_COMUNES.format(lista=lista)], Agrupacion)

    def elegir_momentos(self, lista: str, candidato: str) -> list[int]:
        texto = prompts.ELEGIR_MOMENTOS.format(candidato=candidato, lista=lista)
        return self._json("momentos", [texto], Eleccion).elegidos

    def comprobar(self, cita: str, contexto: str, candidato: str, fecha: str) -> Comprobacion:
        from google.genai import types

        # 1) Búsqueda con Google y lectura de las páginas: los datos oficiales (texto libre + fuentes). Las mismas
        # herramientas y reglas que la segunda revisión, para que lo dudoso se descarte ya aquí
        r = self._generar(
            "verificacion",
            prompts.VERIFICAR.format(candidato=candidato, cita=cita, contexto=contexto, fecha=fecha),
            temperature=0.0,
            tools=[types.Tool(url_context=types.UrlContext()), types.Tool(google_search=types.GoogleSearch())],
        )
        fuentes = self._fuentes(r)
        # 2) Veredicto estructurado a partir de lo encontrado
        dictamen = self._json("dictamen", [prompts.DICTAMINAR.format(cita=cita, comprobacion=r.text)], Dictamen)
        return Comprobacion(dictamen=dictamen, fuentes=fuentes)

    @staticmethod
    def _fuentes(r) -> list[Fuente]:
        """Las webs que el modelo consultó con la búsqueda de Google. Los enlaces se resuelven a la vez; los que no
        llevan a una web real se descartan (nunca se publican rotos)."""
        meta = r.candidates[0].grounding_metadata if r.candidates else None
        trozos = [t.web for t in ((meta.grounding_chunks or []) if meta else []) if t.web and t.web.uri][:6]
        with ThreadPoolExecutor(max_workers=6) as ex:
            destinos = list(ex.map(lambda w: url_final(w.uri), trozos))
        fuentes: list[Fuente] = []
        for web, destino in zip(trozos, destinos):
            if destino and all(f.url != destino for f in fuentes):
                fuentes.append(Fuente(titulo=titulo_fuente(web.title or "", destino), url=destino))
        return ordenar_fuentes(fuentes)[:4]

    def revisar(self, cita: str, contexto: str, candidato: str, fecha: str, propuesta: Comprobacion) -> Revisado:
        """Segunda revisión independiente: abre las fuentes propuestas (url_context), busca la oficial por su cuenta
        (Google) y confirma, corrige o descarta. Sustituye a la revisión de una persona."""
        from google.genai import types

        lista = "\n".join(f"- {f.titulo}: {f.url}" for f in propuesta.fuentes) or "(ninguna)"
        r = self._generar(
            "revision",
            prompts.SEGUNDA_REVISION.format(
                candidato=candidato,
                fecha=fecha,
                cita=cita,
                contexto=contexto,
                veredicto=propuesta.dictamen.veredicto,
                explicacion=propuesta.dictamen.explicacion,
                fuentes=lista,
            ),
            temperature=0.0,
            tools=[types.Tool(url_context=types.UrlContext()), types.Tool(google_search=types.GoogleSearch())],
        )
        decision = self._json("decision", [prompts.DECIDIR_REVISION.format(revision=r.text)], Decision)
        return Revisado(decision=decision, fuentes=self._fuentes(r))


class ClienteSimulado:
    """Respuestas deterministas a partir de una transcripción conocida. Solo para pruebas: nunca para candidatos reales."""

    def __init__(self, transcripcion: Transcripcion, extraccion: Extraccion):
        self._t = transcripcion
        self._e = extraccion
        self.contador = Contador("simulado")

    def transcribir(self, trozo, candidato: str, contexto: str = "", intento: int = 0) -> Transcripcion:
        return self._t

    def extraer(self, transcripcion: str, candidato: str, bloque: str = "la entrevista completa") -> Extraccion:
        # Solo lo que cae dentro del bloque recibido, como haría el modelo
        marcas = [int(m) for m in re.findall(r"^\[(\d+)\]", transcripcion, flags=re.M)]
        desde, hasta = (min(marcas), max(marcas)) if marcas else (0, 10**9)
        dentro = lambda xs: [x for x in xs if desde <= x.segundo <= hasta]  # noqa: E731
        return self._e.model_copy(
            update={
                "temas": [t for t in self._e.temas if desde <= t.inicio <= hasta],
                "preguntas": dentro(self._e.preguntas),
                "propuestas": dentro(self._e.propuestas),
                "ataques": dentro(self._e.ataques),
                "afirmaciones": [x for x in self._e.afirmaciones if desde <= x.segundo <= hasta and x.segundo > 0]
                + [x for x in self._e.afirmaciones if x.segundo == 0 and desde <= 60],
                "momentos": [m for m in self._e.momentos if m.cita in transcripcion]
                + [m for m in self._e.momentos if m.cita not in transcripcion and desde <= 60],
            }
        )

    def elegir_momentos(self, lista: str, candidato: str) -> list[int]:
        return list(range(1, len(lista.splitlines()) + 1))

    def agrupar_comunes(self, lista: str) -> Agrupacion:
        # Simulado: agrupa por texto idéntico de la pregunta
        grupos: dict[str, list[str]] = {}
        for fila in lista.splitlines():
            ident, _, texto = (x.strip() for x in fila.split("|", 2))
            grupos.setdefault(texto.lower(), []).append(ident)
        return Agrupacion(grupos=[{"tema": "Tema", "pregunta": t, "ids": ids} for t, ids in grupos.items()])

    def comprobar(self, cita: str, contexto: str, candidato: str, fecha: str) -> Comprobacion:
        veredicto = "legal" if "%" in cita else "amarilla"
        return Comprobacion(
            dictamen=Dictamen(veredicto=veredicto, explicacion="Comprobación simulada."),
            fuentes=[Fuente(titulo="Fuente simulada", url="https://example.org")],
        )

    def revisar(self, cita: str, contexto: str, candidato: str, fecha: str, propuesta: Comprobacion) -> Revisado:
        # Simulado: confirma lo que trae fuente y descarta lo que no
        d = propuesta.dictamen
        return Revisado(
            decision=Decision(
                decision="confirmar" if propuesta.fuentes else "descartar",
                veredicto=d.veredicto,
                explicacion=d.explicacion,
                fuentes_ok=bool(propuesta.fuentes),
                nota="Revisión simulada.",
            ),
            fuentes=[],
        )
