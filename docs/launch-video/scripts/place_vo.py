"""Writes the <audio> clips for vo/script.json into film/index.html (between the VO markers)."""
import json, re, subprocess
S = json.load(open('vo/script.json')); tags = []
for i, l in enumerate(S):
    f = f"film/assets/vo/line_{l['id']}.mp3"
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))
    tags.append(f'      <audio id="vo-{l["id"]}" src="assets/vo/line_{l["id"]}.mp3" data-start="{l["at"]}" data-duration="{round(dur, 3)}" data-track-index="{10 + i % 2}" data-volume="1"></audio>')
block = '      <!-- VO (ElevenLabs, edit/vo/gen_vo.py + script.json) -->\n' + '\n'.join(tags) + '\n      <!-- /VO -->\n'
p = 'film/index.html'; s = open(p).read()
s = re.sub(r'      <!-- VO \(ElevenLabs.*?<!-- /VO -->\n', block, s, flags=re.S)
open(p, 'w').write(s); print(len(tags), 'VO clips')
