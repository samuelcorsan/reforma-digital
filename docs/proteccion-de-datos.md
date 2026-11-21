# Protección de datos

El registro de actividades de tratamiento (art. 30 del RGPD) de Reforma Digital. Lo que se explica a las personas está en la [página de privacidad](../apps/web/app/%28search%29/privacy/page.tsx).

No es un dictamen jurídico: conviene que lo revise quien asesore al proyecto en protección de datos. Falta identificar al responsable del tratamiento, que el art. 30.1.a exige en el registro y el art. 13 en la información a las personas.

## Registro de actividades

### 1. Alojamiento de la web y de su servidor

- **Finalidad:** servir la web y mantenerla segura.
- **Base jurídica:** interés legítimo (art. 6.1.f).
- **Personas y datos:** visitantes. IP, navegador y la petición, en los registros técnicos.
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

### 3. Estadísticas de uso

- **Finalidad:** saber qué páginas de la web se visitan.
- **Base jurídica:** interés legítimo (art. 6.1.f). Sin cookies ni almacenamiento en el dispositivo: el identificador vive en la memoria de la pestaña, así que no necesita consentimiento (art. 22.2 de la LSSI-CE).
- **Personas y datos:** visitantes. Cada página vista, con su ruta sin query, y un identificador aleatorio de la pestaña. Sin IP: la petición a PostHog la hace el servidor (`apps/web/app/api/eventos`), y sin GeoIP ni perfiles de persona.
- **Destinatarios:** PostHog, como encargado, en su región de la UE.
- **Plazo:** el de PostHog según el plan contratado.

### Fuera del registro

- **La extensión** no envía datos a Reforma Digital ni a terceros. Solo guarda en el navegador si está activada en cada web.

## Evaluación de impacto

La evaluación de impacto (art. 35) se hizo por el asistente de la app de escritorio, que ya no existe. Los tratamientos que quedan no manejan identificadores ni datos de salud ni usan tecnología nueva, así que no parecen cumplir los criterios de las listas de la AEPD y del CEPD. Lo confirma quien asesore al proyecto.

## Pendiente

1. Identificar al responsable del tratamiento y un canal para ejercer los derechos.
2. Firmar los contratos de encargado (art. 28) con Vercel y PostHog.

Revisa este documento cuando cambie un destinatario, un dato que sale del servidor o la finalidad de un tratamiento.

Última revisión: 21 de noviembre de 2026.
