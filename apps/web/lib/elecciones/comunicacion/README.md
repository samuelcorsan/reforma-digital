# El análisis de comunicación

Cada JSON de esta carpeta es el análisis de comunicación de una entrevista publicada, con su mismo id
(`<ronda>-<candidato>.json`): cómo pregunta el entrevistador y cómo se le responde, la voz, las trabas, los
silencios y los movimientos de la cara. Se ve en `/elecciones/entrevistas/<entrevista>/comunicacion`.

Los escribe [`apps/ingestion/entrevistas/comunicacion.py`](../../../../ingestion/entrevistas/comunicacion.py) a
partir de la carpeta de medidas de cada entrevista, que no está en el repositorio (vídeo, audio y CSV). Después se
pasa Prettier y se da de alta el JSON en `../communication.ts`.

La web solo valida y pinta. El contrato está en `../communication.ts`: si un JSON no lo cumple, la web falla al
arrancar en lugar de publicar algo a medias.

## Qué se ve

- El texto del informe (`titular`, `entrada`, `claves`, `secciones`, `limites` y `referencias`), en bloques: párrafos,
  listas y tablas. Los minutos del vídeo que cita (`73:05`) se enlazan al reproductor de la entrevista.
- Las gráficas, con las medidas: la línea de la entrevista, el reparto de la palabra, cada pregunta con su respuesta,
  los minutos por tema, la sintonía, los movimientos de la cara y la comparación entre las entrevistas de la ronda.

## Los datos, para descargar

El mismo conversor escribe en `apps/web/public/datos/comunicacion/` un zip por entrevista y otro con la comparación
de la ronda. La página los enlaza en su anexo (`datos` en cada JSON, con su tamaño). Llevan solo lo publicable: ni
vídeo, audio o fotogramas, ni comentarios de YouTube, ni huellas de identidad de caras y voces, ni la salida de los
clasificadores de emoción. Salen iguales byte a byte si las medidas no cambian.

## Lo que no se hace

- Etiquetar emociones. La cara se mide solo con unidades de acción FACS y cada persona se compara consigo misma.
- Presentar una pausa, un gesto, la voz o una traba como señal de que alguien miente.
- Publicar fotogramas o recortes del vídeo: los minutos enlazan al original.
- Retocar un JSON a mano: se corrige en las medidas o en el informe y se vuelve a convertir.
