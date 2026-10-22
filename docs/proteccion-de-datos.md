# Protección de datos

El registro de actividades de tratamiento (art. 30 del RGPD) y la evaluación de impacto (art. 35) de Reforma Digital. El detalle técnico de la app de escritorio está en [su protocolo de seguridad](../apps/desktop/security-protocol.md); lo que se explica a las personas, en la [página de privacidad](../apps/web/app/%28search%29/privacy/page.tsx).

No es un dictamen jurídico: conviene que lo revise quien asesore al proyecto en protección de datos. Falta identificar al responsable del tratamiento, que el art. 30.1.a exige en el registro y el art. 13 en la información a las personas.

## Registro de actividades

### 1. Alojamiento de la web y de su servidor

- **Finalidad:** servir la web y la API de la app de escritorio, y mantenerlas seguras.
- **Base jurídica:** interés legítimo (art. 6.1.f).
- **Personas y datos:** visitantes y usuarios de la app. IP, navegador y la petición, en los registros técnicos.
- **Destinatarios:** Vercel, como encargado.
- **Transferencias:** EE. UU. Vercel está certificada en el Marco de Privacidad de Datos UE‑EE. UU. y su DPA incluye cláusulas contractuales tipo.
- **Plazo:** el de los registros de Vercel según el plan contratado.

### 2. Estadísticas de la web

- **Finalidad:** saber qué páginas se visitan.
- **Base jurídica:** interés legítimo (art. 6.1.f). Sin cookies ni almacenamiento en el dispositivo, así que no necesita consentimiento (art. 22.2 de la LSSI-CE).
- **Personas y datos:** visitantes. Página, país, navegador y referente, agregados. Vercel Web Analytics identifica la visita con un hash que se descarta a las 24 horas, sin guardar la IP.
- **Destinatarios:** Vercel, como encargado.
- **Transferencias:** como en la actividad 1.
- **Plazo:** el identificador de la visita, 24 horas; las cifras agregadas, sin datos personales.

### 3. Asistente de la app de escritorio

- **Finalidad:** responder a la persona e investigar y hacer sus trámites.
- **Base jurídica:** ejecución del servicio que pide (art. 6.1.b).
- **Personas y datos:** usuarios de la app y las personas de las que hablan (familiares). Les llega la conversación con los datos identificativos sustituidos por marcadores, el contexto mínimo de «Mis datos» (municipio, provincia, nacionalidad, sexo, estado civil, tipo de documento, edad) y lo que el detector no reconozca (ver los riesgos).
- **Destinatarios:**
  - El servidor de Reforma Digital (Vercel), que no la guarda.
  - NaN Builders (Helmcode), el modelo, como encargado. Según su web, procesa en la UE, no registra peticiones ni respuestas y no entrena con ellas.
  - Exa, el buscador, solo con las consultas del agente, limpias de identificadores.
  - El BOE, solo con las palabras del título de una ley.
  - Si la persona elige otro proveedor en Ajustes, ese proveedor, con la relación que ella tenga con él.
- **Transferencias:** las consultas a Exa van a EE. UU.
- **Plazo:** el servidor no las guarda. En el ordenador, cifradas, hasta que la persona las borre.

### 4. Límites de uso del servidor

- **Finalidad:** evitar abusos y acotar el gasto.
- **Base jurídica:** interés legítimo (art. 6.1.f).
- **Personas y datos:** usuarios de la app. HMAC‑SHA256 de la IP (las IPv6, por su /48) y del identificador aleatorio de la instalación, con lo gastado en el día. Son datos seudonimizados, no anónimos.
- **Destinatarios:** la base de datos del servidor, como encargado.
- **Plazo:** se borran con la primera petición del día siguiente (`apps/web/lib/escritorio.ts`).

### 5. Iconos de las fuentes en la app

- **Finalidad:** mostrar el icono de cada web consultada.
- **Base jurídica:** ejecución del servicio (art. 6.1.b).
- **Personas y datos:** el origen de la web (`https://sede.policia.gob.es`). Lo pide el servidor (`/api/escritorio/icono`), así que Google no recibe la IP de la persona.
- **Destinatarios:** Google, sin datos de la persona.
- **Plazo:** no se guarda; la CDN guarda el icono, no quién lo pidió.

### Fuera del registro

- **La extensión** no envía datos a Reforma Digital ni a terceros. Solo guarda en el navegador si está activada en cada web.
- **Lo que la app guarda en el ordenador** (perfil, trámites, sesiones de las webs, documentos descargados) queda cifrado y bajo el control de la persona. Reforma Digital no tiene acceso a ello.

## Evaluación de impacto

### Por qué se hace

La app de escritorio usa un agente de IA (tecnología nueva) que maneja identificadores (DNI, IBAN, NUSS) y actúa en sedes de la Administración. Además, en trámites de discapacidad, dependencia o sanidad, la persona puede contar datos de salud (art. 9). Son criterios de las listas de la AEPD y del CEPD para hacer una evaluación de impacto.

### Necesidad y proporcionalidad

- **Minimización:** el modelo recibe marcadores, no los datos, y solo el contexto necesario para elegir el trámite y el organismo. Las direcciones le llegan sin parámetros.
- **Conservación:** el servidor no guarda conversaciones ni búsquedas. Los contadores duran un día.
- **Control de la persona:** cifrado local, «Borrar todo» destruye la clave, cada envío, pago o firma se aprueba, y la persona puede usar un modelo en su propio ordenador.
- **Transparencia:** la bienvenida, los Ajustes y la página de privacidad explican qué sale del ordenador y a quién, y que la protección no es completa.

### Riesgos

| Riesgo                                                              | Medidas                                                                                                                                               | Riesgo residual                                                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Un identificador llega al modelo porque el detector no lo reconoce. | Marcadores para «Mis datos», reglas con validación, Rampart Edge, última capa sobre identificadores con control y fallo cerrado si el detector falla. | Medio. Rampart Edge encontró la mitad de los nombres completos aislados en OpenPII, y un nombre de pila suelto puede pasar. |
| Datos de salud u otras situaciones personales llegan al modelo.     | Aviso en la app y en la página de privacidad para escribir solo lo necesario. El modelo no conserva las peticiones, según su proveedor.               | Medio. El detector busca identificadores, no entiende de qué trata un texto.                                                |
| El proveedor del modelo conserva o reutiliza las peticiones.        | Proveedor que, según su web, no registra ni entrena y procesa en la UE.                                                                               | Bajo cuando esté firmado el contrato de encargado. Hasta entonces depende solo de lo que dice su web.                       |
| Transferencia de consultas a EE. UU. (Exa).                         | Las consultas van limpias de identificadores.                                                                                                         | Bajo, pero falta acreditar el mecanismo de transferencia de Exa.                                                            |
| El agente escribe datos reales en una web no oficial.               | Solo se escriben en webs oficiales o en las que la persona confía, comprobando la web justo antes de escribir y solo por https.                       | Bajo. Lo que haga una web con los datos que recibe queda fuera de la app.                                                   |
| Acceso al ordenador o robo.                                         | AES‑256‑GCM con la clave en el llavero del sistema, Touch ID para revelar «Mis datos» y sesiones que se pueden cerrar al salir.                       | Medio. Los documentos descargados no van cifrados, y con la sesión del sistema abierta los datos se pueden descifrar.       |
| Reidentificación por los contadores del servidor.                   | HMAC con un secreto del servidor y borrado al día siguiente.                                                                                          | Bajo.                                                                                                                       |
| Una acción no deseada en una sede (envío, pago, firma).             | Aprobación de cada acción, Touch ID opcional, y contraseñas, CAPTCHA, certificados y firmas siempre en manos de la persona.                           | Bajo.                                                                                                                       |

Con estas medidas ningún riesgo residual es alto, así que no haría falta la consulta previa a la AEPD (art. 36). Es una propuesta: lo decide el responsable cuando se identifique.

### Pendiente

1. Identificar al responsable del tratamiento y un canal para ejercer los derechos.
2. Firmar los contratos de encargado (art. 28) con Vercel, NaN Builders, Exa y el proveedor de la base de datos.
3. Acreditar el mecanismo de transferencia de Exa (Marco de Privacidad de Datos o cláusulas contractuales tipo).
4. Repetir la evaluación de privacidad con Rampart Edge (`pnpm eval:agent --suite ejecucion`), pendiente según el protocolo de seguridad.

Revisa este documento cuando cambie un destinatario, un dato que sale del ordenador o del servidor, el modelo del detector o la finalidad de un tratamiento.

Última revisión: 22 de octubre de 2026.
