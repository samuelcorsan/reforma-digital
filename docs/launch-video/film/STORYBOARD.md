# Reforma Digital para Mac — launch film (60 s, 1920×1080, 30 fps)

Reference: an 88 s kinetic-typography launch film (Aside). Its grammar, which every scene follows:

- **Minimal, centered kinetic type.** Inter 500, 80–96 px, letter-spacing −0.03em, line-height 1.1. Words
  arrive one at a time (opacity 0→1, blur 8px→0, y 14→0, 0.32–0.4 s, `power3.out`), ~0.12–0.18 s apart.
  When a new word is added to a centered line, the already visible words shift smoothly to stay centered
  (author each state as its own absolutely positioned line, or animate x offsets — never tween width).
- **One accent word per line** (dark scenes: `--brand-yellow` #ffbe0b; light scenes: `--brand` #df1717).
- **UI fragments float on a flat field.** No device chrome except where noted, no shadows (DESIGN.md §9),
  surfaces are flat fills with radius 20–28 px.
- **Exits** are quick: blur 0→8px + opacity → 0 + y 0→−16, 0.25–0.3 s, `power2.in`.
- **Hard cuts between scenes.** Each scene starts on its own empty background and ends clean.
- Lots of empty space (≥ 40 %). Nothing smaller than 24 px except deliberate UI-native text inside the app
  window of the demo scene.

Design truth: `assets/tokens.css` (colors, gradients, fonts). Icons: `assets/icons/<name>.svg` (Nucleo UI
Essential outline 18, stroke `currentColor`; inline the SVG markup and scale it with width/height).
Logo: `assets/logo.svg` (the red R with a folded corner: `#df1717` + corner `#a50e0e`). App icon (white
square with the red R): `assets/app-icon.png`, shown with `border-radius: 22.5%`.

## Frame 1 — hook
- status: outline
- src: compositions/hook.html
- start: 0 · duration: 12.5 · background: `--ink` #141414
- rules: discrete-text-sequence (typing), kinetic word reveal, waterfall-entry (chips), depth-of-field-blur
- Beats:
  1. 0.0–0.6 dark composer pill fades/scales in (0.96→1) at center: 1100×104, fill `--ink-2`, 2px border
     `--ink-3`, radius 52. Placeholder «Pregúntale a un asistente» in `--on-dark-muted` 34px. Round send
     button on the right (64px, fill #f5f5f5, ink up-arrow: path `M9 15V3.5M4 8.25 9 3.25l5 5`, 18-grid).
  2. 0.6–2.4 types «Los asistentes de IA» char by char (52 px, `--on-dark`), caret blinking.
  3. 2.4–3.0 pill border/fill fade out; the text grows to the 88 px headline and settles at center (y≈470).
  4. 3.0–4.4 second line, word by word: «prometían hacer tus **trámites**.» (accent on «trámites»).
  5. 4.4–4.7 both lines exit.
  6. 4.7–7.8 «**En cambio,** te dan una lista de pasos.» at y≈300; under it, 9 step chips spawn one after
     another with deterministic jittered offsets/rotations (±4°) and partial blur, piling up like a mess
     (reference: duplicated «Connect App +» buttons). Chip: fill `--ink-2`, 2px `--ink-3` border, radius
     999, 30px text, number badge (36px circle `--ink-3`). Texts: «1 Busca la sede correcta», «2 Consigue
     Cl@ve», «3 Pide cita previa», «4 Rellena el formulario», «5 Adjunta el PDF», «6 Firma con certificado»,
     «7 Paga la tasa», «8 Guarda el justificante», «9 Vuelve a intentarlo». Exit all at 7.5–7.8.
  7. 7.8–10.8 «Y se paran **cuando toca de verdad**.» at y≈250 (accent on «cuando toca de verdad»). Below,
     a dark chat card (900 wide, fill `--ink-2`, radius 28): a user bubble right-aligned (fill `--ink-3`,
     radius 24, 30px) «¿Por qué te paras?», then assistant replies left-aligned as plain gray text lines
     (30px, `--on-dark-muted`), one every 0.4 s: «No puedo entrar en la sede electrónica.», «No puedo pedir
     la cita por ti.», «Tendrás que rellenar el formulario tú.»
  8. 10.8–12.5 everything exits; final line «Y tu **DNI** se va con la conversación.» where «DNI» sits in a
     yellow-tinted chip (bg rgba(255,190,11,.16), text `--brand-yellow`, radius 14). Exit 12.2–12.45.

## Frame 2 — reveal
- status: outline
- src: compositions/reveal.html
- start: 12.5 · duration: 4.5 · background: `--ink` then `--brand-gradient`
- rules: cursor-click-ripple, center-outward-expansion (circle wipe), kinetic tracking reveal, ambient-glow-bloom
- Beats:
  1. 0.0–0.5 «Presentamos» (80 px, `--on-dark`) at y≈400.
  2. 0.2–0.7 a dock rises below (y≈640): bar fill `--ink-2`, 2px `--ink-3`, radius 36, padding 18, five
     104 px squircle tiles (radius 24) fill `--ink-3` with white Nucleo glyphs (web, documento, ajustes,
     reloj) and, in the middle, `assets/app-icon.png`.
  3. 0.6–1.3 a macOS arrow cursor (white fill, 2px black stroke, 44px) glides in from bottom-right to the
     app icon (`power2.inOut`), presses at 1.3 (icon + cursor scale 0.9 → 1, ripple ring).
  4. 1.35–2.0 the sunset (`--brand-gradient`) floods the frame from the icon's center via a growing
     circular clip-path (`power3.inOut`); dark elements are gone underneath.
  5. 1.9–3.2 wordmark «Reforma Digital» (Inter 600, 190 px, white) reveals: letter-spacing 0.35em→−0.04em,
     blur 16px→0, opacity 0→1, `expo.out`; a white R logo (logo.svg recolored: main paths #ffffff, corner
     rgba(0,0,0,.22)) 120 px tall sits above it, scaling 0.8→1.
  6. 3.0–3.5 «para Mac» (52 px, white 85 %) below.
  7. Throughout 1.9–4.5 the sun glow slowly rises/breathes (scale 1→1.06 on an inner layer). Hold to end.

## Frame 3 — tagline
- status: outline
- src: compositions/tagline.html
- start: 17 · duration: 4.5 · background: `--canvas` #f5f5f5, ink text
- rules: kinetic word reveal, waterfall-entry (list), svg icons
- Beats:
  1. 0.0–1.5 left block (x≈260): R logo 72 px, then «Un asistente que hace tus trámites» in two lines
     (96 px, Inter 500), word by word; accent `--brand` on «trámites».
  2. 1.6–2.0 block slides left/up to make room; the word «en» appears at x≈260, y≈640.
  3. 2.0–3.4 a right-hand stack (x≈620) appears line by line, 0.4 s apart, each with a 64 px ink icon:
     [web] «las webs oficiales», [persona] «con Mis datos», [huella] «y con tu permiso».
  4. 3.4–4.5 hold; exit 4.2–4.45.

## Frame 4 — demo
- status: outline
- src: compositions/demo.html
- start: 21.5 · duration: 21.5
- The real app window (PR #156 UI) doing a DNI appointment end-to-end. Built by the lead.

## Frame 5 — privacy
- status: outline
- src: compositions/privacy.html
- start: 43 · duration: 11 · background: `--surface` #ffffff (beats 1–3) → `--canvas` (beat 4)
- rules: kinetic word reveal, hacker-flip-3d / glyph scramble (deterministic), waterfall-entry, svg-path-draw
- Beats:
  1. 0.0–1.6 «Todo es [candado icon] **privado**.» (88 px, ink; accent `--brand`). Exit 1.4–1.65.
  2. 1.65–3.6 «Tus datos, cifrados en tu Mac.» at y≈330, then a minimal laptop line drawing (2px ink
     strokes, screen 760×470 radius 18 + base, no logo) draws/rises from below; inside the screen, a tiny
     abstract app window (gray sidebar block, canvas, white rounded rects). Exit 3.4–3.65.
  3. 3.65–6.6 «La IA solo ve» (88 px) then, to its right/below, a white field pill (2px `--border`,
     radius 24, padding 18×28) holding «12345678Z» in mono 60 px. At 4.6 the value turns
     brand-tinted (bg rgba(223,23,23,.10), text `--brand`), then 4.9–5.8 scrambles into
     «{{documento_numero}}»: 16 steps; at step k the first floor(len(target)·k/16) chars are fixed from the
     target and the rest are pseudo-random glyphs from «ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+=?»
     (seeded/indexed, never Math.random); length interpolates source→target. When done the chip turns
     bg rgba(255,190,11,.25), text ink. 5.9–6.4 the word «marcadores.» completes the sentence.
     Exit 6.3–6.6.
  4. 6.6–11.0 background cross-fades to `--canvas`; the Bienvenida summary card (white, radius 40,
     padding 56, width 1000) rises (y 40→0, 0.7 s): headline row «0» (Inter 600, 84 px, `--brand`,
     tabular-nums) + «datos tuyos han llegado a la IA» (36 px, 500). Then a vertical timeline of 5 items,
     0.45 s apart (fade + x −16→0): 48 px icon circles alternating red (bg rgba(223,23,23,.08), icon
     `--brand`) / yellow (bg rgba(255,190,11,.15), icon `--brand-yellow`), a 2px `--border` connector line
     between circles, title 30 px 500 and description 26 px `--fg-secondary`:
       - [persona] «Escribiste tu nombre, tu DNI y tu IBAN» — «En tu ordenador, donde se guardan cifrados.»
       - [escudo] «Se ocultaron antes de salir de tu ordenador» — «Un modelo de privacidad, sin conexión, los cambió por marcadores.»
       - [buscar] «La IA preparó el trámite solo con marcadores» — «Sabe que hay un dato, no cuál es.»
       - [huella] «Tú lo aprobaste» — «Sin tu permiso no se envía, ni se paga, nada.»
       - [web] «Tus datos reales, solo en la web oficial» — «La app los escribió allí desde tu ordenador.»
     Hold to 11.0.

## Frame 6 — close
- status: outline
- src: compositions/close.html
- start: 54 · duration: 6 · background: `--ink`
- rules: kinetic word reveal, scale-swap-transition
- Beats:
  1. 0.0–0.8 R logo (red, 64 px) + «Reforma Digital» (56 px, 500, `--on-dark`) in a row at y≈330.
  2. 0.6–2.2 «Tus trámites, hechos contigo.» (96 px) word by word at center; accent `--brand-yellow` on
     «contigo».
  3. 3.0–3.3 the headline exits; 3.3–3.9 «github.com/samuelcorsan/reforma-digital» (60 px, `--on-dark`)
     reveals, with «Código abierto · Para Mac» (32 px, `--on-dark-muted`) under it.
  4. 5.4–6.0 everything fades to #000.
