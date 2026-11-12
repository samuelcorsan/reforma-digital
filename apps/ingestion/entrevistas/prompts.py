"""Instrucciones para el modelo. Son públicas (metodología) y las mismas para todos los candidatos.

Nadie revisa a mano lo que sale de aquí: lo comprueba una segunda pasada de IA (SEGUNDA_REVISION). Por eso las
instrucciones piden ser exhaustivo al buscar, contrastar cada dato con su fuente primaria y citar exactamente de dónde
sale cada cifra."""

SISTEMA = """Eres analista de Reforma Digital, un proyecto independiente que revisa entrevistas políticas con los \
mismos criterios para todos los candidatos. Eres neutral: no valoras ideas ni ideología, solo rigor, claridad y \
sustancia. Nunca inventas datos, citas, cifras ni fuentes: si no lo encuentras, lo dices. Lo que escribes se publica \
sin que una persona lo revise, así que cada afirmación tuya tiene que poder comprobarse en la fuente que citas. \
Responde siempre en español."""

TRANSCRIBIR = """Transcribe este fragmento de {medio} de {entrevista} a {candidato}.
El fragmento dura exactamente {largo} segundos.

Reglas:
- Divide en segmentos por turno de palabra. Cada segmento: inicio y fin en formato MM:SS (minutos:segundos) DESDE EL
  INICIO DE ESTE FRAGMENTO, entre 00:00 y {fin_mmss}. Ningún segmento puede empezar después de {fin_mmss}.
- Transcribe solo lo que se oye en este fragmento. Si acaba a mitad de frase, corta ahí: no la completes.
- hablante: {hablantes}
- Transcripción literal y fiel: sin resumir, sin corregir lo que dicen, sin añadir nada. Puntuación normal.
- Si dos personas hablan a la vez, corta el segmento y empieza otro.
{extra}{contexto}"""

# Quién es quién en la transcripción. En las entrevistas de Jordi hay verificadores en plató; en los ensayos con
# otras entrevistas, "jordi" es quien las conduce (sea quien sea), para que las cifras del árbitro sigan midiendo algo
ENTREVISTA_JORDI = "una entrevista de Jordi Wild (The Wild Project)"
HABLANTES_JORDI = """"jordi" (el entrevistador), "candidato" ({candidato}), "verificador" (los periodistas \
verificadores que están en plató y a los que Jordi consulta para comprobar datos) u "otro"."""
HABLANTES_ENSAYO = """"jordi" para quien conduce la entrevista y hace las preguntas{nombre}, aunque no se llame \
Jordi: usa siempre esta etiqueta para el entrevistador principal; "candidato" ({candidato}); u "otro" para el resto \
(otros presentadores o colaboradores, tertulianos, público, vídeos insertados)."""


def presentacion(entrevistador: str | None, candidato: str) -> dict[str, str]:
    """Cómo se presenta la entrevista al modelo. None: una entrevista de Jordi; si no, un ensayo con otra."""
    if entrevistador is None:
        return {"entrevista": ENTREVISTA_JORDI, "hablantes": HABLANTES_JORDI.format(candidato=candidato)}
    return {
        "entrevista": f"una entrevista de {entrevistador}" if entrevistador else "una entrevista",
        "hablantes": HABLANTES_ENSAYO.format(nombre=f" ({entrevistador})" if entrevistador else "", candidato=candidato),
    }


# Solo con vídeo: lo que se ve y no se oye. Nada de lenguaje corporal: no es medible y no sería neutral.
VISUAL = """
Además, en "visual", anota SOLO hechos que se ven en pantalla (inicio en MM:SS, como los segmentos):
- "verificador": los periodistas verificadores aparecen en plano, o el entrevistador les pide que comprueben un dato.
- "rotulo": texto con información que aparece sobreimpreso en pantalla sobre lo que se habla en la entrevista \
(titulares, datos, cifras, gráficos). Copia el texto. No anotes el nombre del invitado, el del programa, logos de la \
cadena ni el teletipo con titulares de otras noticias que pasa por la parte de abajo.
- "documento": alguien muestra a cámara un papel, gráfico, móvil, libro u otro objeto. Di qué es, sin interpretarlo.
- "accion": SOLO acciones relacionadas con lo que se está hablando: consulta sus notas para responder, lee un \
papel, señala una pantalla o un gráfico, se levanta o abandona el plató. Describe solo lo que hace, en pocas palabras.
No anotes beber, coger o tocar objetos de atrezo, colocarse la ropa, el contacto entre personas ni bromas visuales. \
Nunca describas expresiones, emociones, nervios, actitud ni aspecto físico, ni interpretes por qué hace algo. No \
nombres a nadie salvo al candidato y al entrevistador; a cualquier otra persona, descríbela por su papel ("una colaboradora", \
"el público"). Si no hay nada de esto, deja la lista vacía.
"""

ANALIZAR = """Analiza este bloque de la entrevista a {candidato}: {bloque}. Cada línea es [segundo] hablante: texto.
Recorre el bloque entero, de principio a fin, sin resumir: cada lista debe estar completa.

Devuelve:
1. temas: tramos continuos dedicados a un tema (vivienda, economía, inmigración, pensiones, corrupción, Europa, \
sanidad, educación, etc.). Sin presentación ni despedida. Usa nombres cortos y consistentes.
2. preguntas: TODAS las preguntas del entrevistador (hablante "jordi") del bloque, también las cortas, las de seguimiento y las repreguntas; \
una por cada intervención en la que pide una respuesta. No agrupes varias en una. segundo = cuando la formula. Clasifica la respuesta del candidato:
   - "directa": responde a lo que se pregunta.
   - "parcial": responde solo a una parte o con ambigüedad.
   - "evasiva": habla del tema sin responder a lo preguntado.
   - "cambio": cambia de tema o ataca a otro en lugar de responder.
   comun = true solo si es una pregunta que claramente se haría a cualquier candidato (programa, vivienda, impuestos…).
   repregunta = true si el entrevistador insiste en lo mismo porque la respuesta anterior no contestó lo preguntado \
("pero no me has contestado", "te pregunto por tu plan"…).
3. propuestas: medidas concretas que propone el candidato. Marca que/cuanto/cuando/como solo si lo dice explícitamente \
(qué medida, cuánto cuesta o cuánto, en qué plazo, cómo se financia o ejecuta).
4. ataques: críticas del candidato a otros. tipo "politica" si critica decisiones o políticas; "personal" si \
descalifica a personas (insultos, "mentirosos", "sinvergüenzas"…).
5. afirmaciones: TODOS los hechos o cifras de interés público que afirma el candidato y que se pueden comprobar con \
datos oficiales: estadísticas, leyes, votaciones, presupuestos, decisiones de gobierno, sucesos públicos. Sé \
exhaustivo: recorre el bloque frase a frase y no te saltes ninguna aunque parezca menor, obvia o ya dicha antes \
(si la repite con otra cifra, son dos). Cada cifra, porcentaje, comparación («más que nunca», «el primero de \
Europa») o atribución («la ley X dice», «el Gobierno aprobó») cuenta. También las anécdotas sobre hechos o \
personas públicas («yo vi a…», «me dijeron que el ministro…»): si nada las puede comprobar, se dirá. No: \
opiniones, promesas ni detalles biográficos menores (qué estudió, quién fue su profesor, a quién conoció). \
La cita debe contener la afirmación completa (al menos ocho palabras), no un fragmento suelto. cita = copia LITERAL \
del texto de la transcripción, sin cambiar ni una palabra. pillado_en_directo = true si un verificador lo corrige \
en la entrevista.
6. momentos: entre 0 y 3 candidatos a momento clave de este bloque (después se eligen los mejores de toda la \
entrevista). tipo:
   - "anuncio": dice algo nuevo (una medida, un compromiso o un dato que no había contado).
   - "choque": tensión con el entrevistador o una pregunta incómoda que marca la entrevista.
   - "titular": la frase que mejor resume su postura en un tema.
   - "rectificacion": reconoce un error, matiza lo que dijo o cambia de postura.
   titulo: máximo ocho palabras, neutral, sin adjetivos valorativos ni juicios ("Propone 100.000 viviendas \
públicas", no "Gran propuesta de vivienda"). cita: copia LITERAL de la transcripción. por_que: una frase neutral. \
Elige los momentos por su relevancia informativa, nunca por si favorecen o perjudican al candidato.
7. interrupciones: cada vez que alguien corta al otro antes de que termine su idea y le quita la palabra. No cuenta: \
completar la frase del otro, asentir ("sí", "claro", "ya"), ni empezar a hablar cuando el otro ya ha terminado. \
quien = quien interrumpe ("candidato" o "jordi"). cita = las primeras palabras LITERALES de quien interrumpe, tal \
como aparecen en la transcripción.

TRANSCRIPCIÓN DEL BLOQUE:
{transcripcion}"""

# Lo que vale como prueba, igual en la verificación y en la segunda revisión.
REGLAS_FUENTES = """- Busca a fondo cada afirmación, también las que parecen menores: varias búsquedas, con otras palabras si la \
primera no da nada.
- Fuente primaria y oficial siempre que exista: INE, Eurostat, Banco de España, BOE, Diario de Sesiones del \
Congreso, Seguridad Social, AIReF, ministerios, CIS, CGPJ y tribunales, OCDE… Si no la hay, prensa o \
verificadores de referencia, citando el medio. Nunca vídeos, redes sociales, blogs ni Wikipedia.
- Abre las páginas que cites y comprueba que dicen lo que afirmas, con el dato, el periodo y el organismo exactos.
- Si no encuentras ninguna fuente que la confirme o la desmienta, la afirmación queda «sin fuente»: no la califiques \
ni supongas. Pasa siempre con las anécdotas (lo que alguien dice haber visto u oído, lo que pasó en privado): que un \
documento no recoja algo no prueba que no ocurriera."""

VERIFICAR = """Comprueba esta afirmación de {candidato} en una entrevista ({fecha}):

"{cita}"

Contexto: {contexto}

Cómo hacerlo:
1. Separa la afirmación en cada dato comprobable que contiene (cifra, periodo, comparación, atribución) y \
comprueba cada uno: una afirmación es tan cierta como su parte menos cierta.
2. Busca de forma exhaustiva la fuente primaria y oficial más reciente disponible en esa fecha. Haz varias \
búsquedas si hace falta, abre las páginas y contrasta con al menos dos fuentes independientes siempre que existan.
3. Cita exactamente de dónde sale cada dato: el organismo, el nombre de la estadística, tabla o norma, el periodo \
y la cifra tal como aparece («INE, EPA, tercer trimestre de 2026: 11,2 % de paro»). Nunca des una cifra sin decir \
de dónde sale.
4. Fíjate en el contexto: el periodo al que se refiere, si compara cosas comparables y si omite algo que cambia \
el sentido.

Reglas:
""" + REGLAS_FUENTES + """

Explica en tres o cuatro frases, en tono neutral, qué dicen los datos y si la afirmación se sostiene. Si es una \
anécdota o no encuentras fuentes que permitan concluir, dilo claramente: no supongas."""

AGRUPAR_COMUNES = """Estas son las preguntas que se hicieron a los candidatos en entrevistas distintas de la misma \
ronda, marcadas como comunes. Formato: id | candidato | pregunta tal como la hizo.

{lista}

Agrupa las que preguntan lo mismo (aunque estén formuladas distinto). Para cada grupo: tema (una palabra o dos), \
pregunta (redacción neutral y corta, máximo 15 palabras, que valga para todos) e ids (los ids del grupo, como \
mucho uno por candidato). Devuelve solo grupos con al menos dos candidatos. No inventes ids."""

ELEGIR_MOMENTOS = """Estos son los candidatos a momento clave de la entrevista a {candidato}, en orden:

{lista}

Elige entre 4 y 8, repartidos a lo largo de la entrevista, por su relevancia informativa: lo que un votante \
necesitaría ver. Nunca por si favorecen o perjudican al candidato. Evita dos momentos sobre lo mismo. \
Devuelve sus números."""

# Los identificadores de la escala son los del esquema de datos; los nombres, los que se publican.
ESCALA = """- "legal" (Cierto): es verdad.
- "amarilla" (Con matices): es verdad pero con matices importantes, o es impreciso o exagerado.
- "fuera" (Engañoso): engañosa o fuera de contexto (dato cierto usado de forma que confunde, comparación tramposa…).
- "roja" (Falso): falsa.
- "sinfuente" (Sin fuente): ninguna fuente encontrada la confirma ni la desmiente. No es una calificación: se \
publica para decir que no hay fuente."""

DICTAMINAR = """A partir de esta comprobación, decide el veredicto con esta escala:
""" + ESCALA + """
Si las fuentes no permiten concluir, o es una anécdota, usa "sinfuente". explicacion: máximo dos frases, neutral, \
sin adjetivos, con la cifra y la fuente que lo sostienen («Según la EPA del INE, el paro fue del 11,2 % en el tercer \
trimestre»). Con "sinfuente", qué se ha buscado y que no hay fuente, sin insinuar si es verdad o no.

AFIRMACIÓN: "{cita}"
COMPROBACIÓN:
{comprobacion}"""

SEGUNDA_REVISION = """Eres la segunda revisión de una verificación hecha por otro modelo. Nadie más la revisará \
antes de publicarse: tu trabajo es que no salga nada que no se sostenga y que, si hay fuente, se encuentre.

AFIRMACIÓN de {candidato} ({fecha}): "{cita}"
Contexto en la entrevista: {contexto}

VEREDICTO PROPUESTO: {veredicto}
EXPLICACIÓN PROPUESTA: {explicacion}
FUENTES PROPUESTAS:
{fuentes}

Haz esto:
1. Abre cada fuente propuesta y comprueba si dice exactamente lo que afirma la explicación: el dato, el periodo y \
el organismo. Si una fuente no carga, no trata de eso o no contiene el dato, dilo.
2. Busca por tu cuenta la fuente primaria oficial para contrastar el dato de forma independiente. Si el veredicto \
propuesto es "sinfuente", busca de nuevo y a fondo: puede que la primera búsqueda no la encontrara.
3. Sigue estas reglas:
""" + REGLAS_FUENTES + """
4. Decide con esta escala si el veredicto se sostiene o cuál debería ser:
""" + ESCALA + """

Explica en tres o cuatro frases qué has comprobado, en qué fuentes y con qué cifras, y si confirmas o corriges."""

DECIDIR_REVISION = """A partir de esta segunda revisión, decide:
- decision: "confirmar" (el veredicto y la explicación se sostienen con las fuentes), "corregir" (las fuentes \
respaldan otro veredicto, no hay fuente y debe ser "sinfuente", o hay que precisar la explicación) o "descartar" \
(solo si la cita no es una afirmación sobre hechos: una opinión, una promesa o una pregunta).
- veredicto: el veredicto final (el propuesto si confirmas). Escala:
""" + ESCALA + """
- explicacion: la explicación final, máximo dos frases, neutral, con la cifra y su fuente.
- fuentes_ok: true si las fuentes propuestas dicen lo que afirma la explicación.
- nota: una frase sobre lo que has comprobado.

SEGUNDA REVISIÓN:
{revision}"""
