---
workflow: general-video
flow: companion
storyboard: no
message: "Reforma Digital para Mac: un asistente que hace tus trámites en las webs oficiales, con tu permiso y sin que la IA vea tus datos."
destination: youtube
aspect: "16:9"
language: es
length: 60
audio: sfx-only
---

## Intent
Launch film for PR samuelcorsan/reforma-digital#156 (apps/desktop). Structure modeled closely on the
reference "Aside" launch film (88 s kinetic typography: dark problem act → product reveal → white UI demo
of the agent working → privacy act → URL end card), cut to ~60 s (user dropped the benchmark/comparison
and the capabilities roll). Built inside the video-use workflow; HyperFrames is the animation engine.

## Customizations
- Spanish copy taken from the app UI (inicio.tsx, tramite.tsx, preguntas.tsx, bienvenida.tsx).
- Design system: PR #156 tokens (Inter, ink #141414, canvas #f5f5f5, white surfaces, no shadows, red R logo,
  sunset gradient). No competitor logos.
- Audio: subtle UI SFX tied to visible events only; no music (user adds a bed later).

## Notes
- Claims must stay within what the PR states (placeholders like {{nombre}}, encrypted local history,
  permission before binding actions, user handles passwords/CAPTCHA/signatures).
- The portal shown in the demo browser is an invented mock, not a capture of a real site.
