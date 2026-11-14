"""Esquema de datos. La web lo valida con `interviewSchema` (apps/web/lib/elecciones/interviews.ts): si cambias
uno, cambia el otro."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Hablante = Literal["jordi", "candidato", "verificador", "otro"]
Respuesta = Literal["directa", "parcial", "evasiva", "cambio"]
# "sinfuente": nada público la confirma ni la desmiente. Se publica, sin calificar, y no cuenta en la valoración
Veredicto = Literal["legal", "amarilla", "fuera", "roja", "sinfuente"]
Estado = Literal["propuesta", "aprobada", "descartada"]
TipoMomento = Literal["anuncio", "choque", "titular", "rectificacion"]
TipoVisual = Literal["verificador", "rotulo", "documento", "accion"]


class Segmento(BaseModel):
    inicio: float
    fin: float
    hablante: Hablante
    texto: str


class TramoTema(BaseModel):
    tema: str
    inicio: float
    fin: float


class Pregunta(BaseModel):
    id: str = ""
    segundo: int
    texto: str
    respuesta: Respuesta
    comun: bool = False
    repregunta: bool = False


class PreguntaComunicacion(BaseModel):
    """Una pregunta del análisis de comunicación (apps/web/lib/elecciones/comunicacion), con su clase de respuesta."""

    segundo: int
    dureza: Literal["insistencia", "repregunta", "incomoda", "neutra", "comoda"]
    respuesta: Literal["responde", "en_parte", "otra_pregunta", "ataca_pregunta", "cambia_tema"]
    orientacion: Literal["propone", "critica", "ambas", "ninguna"]


class Compromiso(BaseModel):
    """Un compromiso del análisis de comunicación: verificable si tiene un objeto que se podrá comprobar."""

    segundo: int
    verificable: bool
    plazo: str | None = None


class Propuesta(BaseModel):
    id: str = ""
    segundo: int
    texto: str
    que: bool
    cuanto: bool
    cuando: bool
    como: bool


class Ataque(BaseModel):
    id: str = ""
    segundo: int
    objetivo: str
    tipo: Literal["politica", "personal"]
    texto: str


class Fuente(BaseModel):
    titulo: str
    url: str


class SegundaRevision(BaseModel):
    """Lo que dejó la segunda revisión de IA (o, a mano, la skill segunda-revision): si las fuentes respaldan la
    explicación y qué se comprobó. `sugerencia`: el veredicto que proponía la primera pasada, si se corrigió."""

    sugerencia: Veredicto | None = None
    fuentesOk: bool
    nota: str


class Revision(BaseModel):
    id: str
    candidato: str
    segundo: int
    cita: str
    veredicto: Veredicto
    explicacion: str
    fuentes: list[Fuente]
    pilladoEnDirecto: bool = False
    # Si la cita aparece también en la transcripción independiente del vídeo (None: no hubo vídeo)
    enVideo: bool | None = None
    segundaRevision: SegundaRevision | None = None
    estado: Estado = "propuesta"


class Visual(BaseModel):
    """Algo que se ve y no se oye: verificadores en plató, rótulos en pantalla, documentos mostrados a cámara."""

    segundo: int
    tipo: TipoVisual
    descripcion: str


class Interrupcion(BaseModel):
    """Alguien corta al otro antes de que termine. quien = quien interrumpe."""

    segundo: int
    quien: Literal["candidato", "jordi"]


class Momento(BaseModel):
    id: str
    segundo: int
    tipo: TipoMomento
    titulo: str
    cita: str
    porQue: str
    enVideo: bool | None = None
    estado: Estado = "propuesta"


class Nota(BaseModel):
    global_: float = Field(alias="global")
    margen: float
    criterios: dict[str, float]

    model_config = {"populate_by_name": True}


class Stats(BaseModel):
    alGrano: int
    remates: int
    entradas: int
    balonesFuera: int
    faltas: int
    cambios: int


class FichaEntrevista(BaseModel):
    """Quién hace la entrevista y dónde se publicó."""

    entrevistador: str = ""
    medio: str = ""
    programa: str = ""
    url: str = ""


class Analisis(BaseModel):
    # Identificador de la entrevista (<jornada>-<candidato>) y jornada a la que pertenece
    id: str = ""
    jornada: str = ""
    entrevista: FichaEntrevista | None = None
    candidato: str
    titulo: str
    youtubeId: str | None
    publicado: str
    duracion: float
    ficticio: bool = False
    nota: Nota
    stats: Stats
    segmentos: list[Segmento]
    temas: list[TramoTema]
    preguntas: list[Pregunta]
    propuestas: list[Propuesta]
    ataques: list[Ataque]
    revisiones: list[Revision]
    momentos: list[Momento] = []
    visuales: list[Visual] = []
    interrupciones: list[Interrupcion] = []
    # Silencios del audio [inicio, fin] en segundos (≥ 0,5 s): para medir la pausa antes de responder
    silencios: list[list[float]] = []

    def a_json(self) -> str:
        return self.model_dump_json(by_alias=True, indent=2)


# ── Respuestas que se piden al modelo (salida estructurada) ──


class SegmentoCrudo(BaseModel):
    """Lo que devuelve el modelo: tiempos como texto MM:SS. Con números, Gemini a veces escribe 2:17 como 217."""

    inicio: str = Field(description="Minuto y segundo de inicio desde el principio del fragmento, formato MM:SS")
    fin: str = Field(description="Minuto y segundo de fin desde el principio del fragmento, formato MM:SS")
    hablante: Hablante
    texto: str


class TranscripcionCruda(BaseModel):
    segmentos: list[SegmentoCrudo]


class VisualCrudo(BaseModel):
    inicio: str = Field(description="Minuto y segundo desde el principio del fragmento, formato MM:SS")
    tipo: TipoVisual
    descripcion: str


class TranscripcionVideoCruda(TranscripcionCruda):
    """Del vídeo se pide además lo que solo se ve."""

    visual: list[VisualCrudo] = []


def a_segundos(marca: str) -> float:
    """'02:17' → 137 · '1:02:17' → 3737 · '137' o '137.5' → 137(.5)."""
    partes = marca.strip().replace(",", ".").split(":")
    try:
        valores = [float(p) for p in partes]
    except ValueError:
        return 0.0
    total = 0.0
    for v in valores:
        total = total * 60 + v
    return total


class Transcripcion(BaseModel):
    """Transcripción de un trozo. Tiempos en segundos desde el inicio del trozo."""

    segmentos: list[Segmento]
    visuales: list[Visual] = []  # solo con vídeo


class Afirmacion(BaseModel):
    """Afirmación comprobable con datos: la cita debe copiarse literal de la transcripción."""

    segundo: int
    cita: str
    por_que_comprobable: str
    pillado_en_directo: bool = False


class MomentoPropuesto(BaseModel):
    """Momento clave propuesto por el modelo: la cita debe copiarse literal de la transcripción."""

    tipo: TipoMomento
    titulo: str
    cita: str
    por_que: str


class InterrupcionPropuesta(BaseModel):
    """Propuesta del modelo: la cita (primeras palabras de quien interrumpe) debe ser literal para ubicarla."""

    quien: Literal["candidato", "jordi"]
    cita: str


class Extraccion(BaseModel):
    temas: list[TramoTema]
    preguntas: list[Pregunta]
    propuestas: list[Propuesta]
    ataques: list[Ataque]
    afirmaciones: list[Afirmacion]
    momentos: list[MomentoPropuesto] = []
    interrupciones: list[InterrupcionPropuesta] = []


class Eleccion(BaseModel):
    """Números (1, 2, 3…) de los momentos elegidos de la lista."""

    elegidos: list[int]


class GrupoComun(BaseModel):
    """Una misma pregunta hecha a varios candidatos. ids: "slug:idPregunta"."""

    tema: str
    pregunta: str
    ids: list[str]


class Agrupacion(BaseModel):
    grupos: list[GrupoComun]


class Dictamen(BaseModel):
    veredicto: Veredicto
    explicacion: str


class Decision(BaseModel):
    """La decisión de la segunda revisión sobre una verificación."""

    decision: Literal["confirmar", "corregir", "descartar"]
    veredicto: Veredicto
    explicacion: str
    fuentes_ok: bool
    nota: str
