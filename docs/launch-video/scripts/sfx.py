import re, sys
p = sys.argv[1]
A = {  # file, attack(s), length used(s)
 'click': ('sfx_007', 0.045, 0.37), 'pop': ('sfx_008', 0.04, 0.72), 'key': ('sfx_009', 0.073, 0.4),
 'typing': ('sfx_002', 0.437, 1.5), 'whoosh': ('sfx_010', 0.067, 0.57), 'cine': ('sfx_011', 0.53, 3.2),
 'impact': ('sfx_012', 0.037, 2.1), 'glitch': ('sfx_013', 0.0, 0.9), 'chime': ('sfx_006', 0.416, 2.5),
}
M = {'hook': 0, 'reveal': 15, 'tagline': 19.5, 'demo': 27.5, 'privacy': 49.0, 'close': 58.5}
RAW = [
 ('hook', 0.80, 'click', 0.45, 'hook: I-beam clicks the tiny composer'), ('hook', 1.10, 'whoosh', 0.3, 'zoom into the input'),
 ('hook', 1.50, 'typing', 0.42, 'giant typing'), ('hook', 2.66, 'key', 0.3, ''),
 ('hook', 2.82, 'pop', 0.2, 'assistant tiles'), ('hook', 2.96, 'pop', 0.2, ''), ('hook', 3.10, 'pop', 0.2, ''), ('hook', 3.24, 'pop', 0.2, ''),
 ('hook', 3.85, 'whoosh', 0.3, 'pull-back'),
 ('hook', 6.10, 'pop', 0.16, 'step chips pile up'), ('hook', 6.52, 'pop', 0.16, ''), ('hook', 6.88, 'pop', 0.16, ''), ('hook', 7.17, 'pop', 0.16, ''), ('hook', 7.42, 'pop', 0.16, ''),
 ('hook', 7.65, 'click', 0.3, 'chip 9 «Vuelve a intentarlo»'),
 ('hook', 9.65, 'pop', 0.26, 'user bubble'),
 ('hook', 12.27, 'click', 0.45, 'datos chip'),
 ('reveal', 0.20, 'whoosh', 0.15, 'dock rises'), ('reveal', 0.98, 'whoosh', 0.07, 'dock magnifies under the cursor'),
 ('reveal', 1.26, 'click', 0.4, 'cursor clicks app icon'), ('reveal', 1.32, 'pop', 0.14, 'launch bounce'), ('reveal', 1.77, 'pop', 0.08, 'bounce lands'),
 ('reveal', 1.75, 'cine', 0.14, 'sunset floods'), ('reveal', 1.90, 'impact', 0.1, 'wordmark lands'),
 ('tagline', 0.05, 'pop', 0.2, 'tagline logo'), ('tagline', 3.1, 'click', 0.28, 'web'), ('tagline', 4.94, 'click', 0.28, 'persona'), ('tagline', 6.1, 'click', 0.28, 'huella'),
 ('demo', 0.70, 'typing', 0.4, 'demo: typing the request'), ('demo', 1.90, 'key', 0.3, ''), ('demo', 2.15, 'key', 0.3, ''),
 ('demo', 2.62, 'click', 0.5, 'send'), ('demo', 4.95, 'click', 0.22, 'search results'),
 ('demo', 8.60, 'pop', 0.24, 'offer card'), ('demo', 10.00, 'click', 0.7, 'Pedir la cita por mí'), ('demo', 10.22, 'whoosh', 0.22, 'browser opens'),
 ('demo', 11.90, 'typing', 0.32, 'app types real values'), ('demo', 13.20, 'key', 0.25, ''), ('demo', 13.45, 'key', 0.25, ''),
 ('demo', 13.95, 'click', 0.25, 'office'), ('demo', 14.35, 'click', 0.25, 'slot'),
 ('demo', 14.85, 'pop', 0.24, 'permission card'), ('demo', 16.50, 'click', 0.7, 'Aprobar'), ('demo', 17.40, 'chime', 0.45, 'cita confirmada'),
 ('privacy', 0.44, 'pop', 0.2, 'privacy: lock'), ('privacy', 1.95, 'whoosh', 0.18, 'laptop rises'), ('privacy', 3.85, 'whoosh', 0.15, 'composer card'),
 ('privacy', 4.15, 'typing', 0.3, 'typing the data'), ('privacy', 5.25, 'key', 0.25, ''),
 ('privacy', 5.78, 'click', 0.35, 'lock 1'), ('privacy', 5.93, 'click', 0.35, 'lock 2'),
 ('privacy', 6.05, 'glitch', 0.12, 'scramble'), ('privacy', 7.00, 'click', 0.35, 'placeholders resolve'), ('privacy', 7.28, 'pop', 0.2, 'marcadores'),
 ('close', 0.05, 'pop', 0.2, 'close: logo'), ('close', 0.92, 'impact', 0.12, 'contigo'), ('close', 3.30, 'whoosh', 0.18, 'logo moves to centre'),
]
SFX_GAIN = 0.62  # ~-4 dB under the voiceover
CUES = [(round(M[sc] + lt, 3), k, round(v * SFX_GAIN, 3), n) for sc, lt, k, v, n in RAW]
tags = []
ends = {}
for i, (t, k, v, note) in enumerate(CUES):
    f, att, ln = A[k]
    start = round(max(0, t - att), 3)
    ln = min(ln, 65.3 - start)
    tr = next(k for k in range(3, 20) if ends.get(k, -1) <= start)
    ends[tr] = start + ln
    c = f'      <!-- {note} -->\n' if note else ''
    tags.append(f'{c}      <audio id="sfx-{i:02d}" src=".media/audio/sfx/{f}.mp3" data-start="{start}" data-duration="{ln}" data-track-index="{tr}" data-volume="{v}"></audio>')
block = '      <!-- SFX (generated from /tmp/rd-scripts/sfx.py) -->\n' + '\n'.join(tags) + '\n      <!-- /SFX -->\n'
s = open(p).read()
s = re.sub(r'      <!-- SFX \(generated.*?<!-- /SFX -->\n', '', s, flags=re.S)
s = s.replace('    </div>\n    <script>', block + '    </div>\n    <script>', 1)
open(p, 'w').write(s)
print(len(CUES), 'cues')
