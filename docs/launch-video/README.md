# Vídeo de lanzamiento de Reforma Digital

Vídeo de 65 s (1920×1080, 30 fps, en español) que presenta la app de escritorio para Mac.

- `reforma-digital-launch.mp4`: el máster actual (−14 LUFS, pico −0,9 dBFS).
- `film/`: el proyecto [HyperFrames](https://hyperframes.heygen.com) con el que se renderiza. Cada escena
  es un HTML con animaciones GSAP en `film/compositions/` (`hook`, `reveal`, `tagline`, `demo`,
  `privacy`, `close`); `film/index.html` las coloca en el tiempo junto con la voz, la música y los
  efectos.
- `vo/script.json`: el guion de la voz, con el momento en que entra cada frase.
- `project.md`: decisiones y cambios de cada sesión.

## Editar y renderizar

Desde `film/`:

```sh
npm run dev      # previsualización en el navegador (HyperFrames Studio)
npm run check    # lint, maquetación, movimiento y contraste
npm run render   # exporta el MP4
```

Los titulares usan Georgia del sistema (viene con macOS; su licencia no permite incluir el archivo). La
tipografía de la interfaz es Geist, incluida en `film/assets/fonts/`.

## Voz y música

La voz es Arconte (`QtPMrakdgePQIUwOX7Ut`, modelo `eleven_v4`) y la música es una pieza instrumental
original de ElevenLabs Music. Los MP3 ya generados están en `film/assets/`. Para regenerarlos hace falta
`ELEVENLABS_API_KEY` en el entorno:

```sh
cd vo && ELEVENLABS_API_KEY=… python3 gen_vo.py QtPMrakdgePQIUwOX7Ut 04 05   # frases concretas
cd music && ELEVENLABS_API_KEY=… python3 gen_music.py
```

Después, desde `docs/launch-video/`, copia `music/bed.mp3` a `film/assets/music/` y `vo/line_*.mp3` a
`film/assets/vo/`, y ejecuta `python3 scripts/place_vo.py` para actualizar los clips de voz en
`film/index.html`. Los efectos de sonido se regeneran con `python3 scripts/sfx.py film/index.html`.

Los datos que aparecen en la demo (Lucía Martín Gómez, 12345678Z, 600 123 456) y el portal del navegador
son inventados.
