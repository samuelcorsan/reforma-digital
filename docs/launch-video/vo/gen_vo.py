"""ElevenLabs voiceover for the Reforma Digital launch film. The key is read from $ELEVENLABS_API_KEY
and is never printed. Usage: python3 gen_vo.py voices | python3 gen_vo.py <voice_id> [ids...]"""
import base64, json, os, pathlib, sys, urllib.request

def key():
    if os.environ.get("ELEVENLABS_API_KEY"): return os.environ["ELEVENLABS_API_KEY"].strip()
    sys.exit("No ELEVENLABS_API_KEY found")

def call(path, body=None):
    req = urllib.request.Request("https://api.elevenlabs.io" + path, data=json.dumps(body).encode() if body else None,
                                 headers={"xi-api-key": key(), "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r: return json.load(r)
    except urllib.error.HTTPError as e: sys.exit(f"{e.code} {e.read()[:300]!r}")

if sys.argv[1] == "voices":
    for v in call("/v1/voices")["voices"]:
        print(v["voice_id"], "|", v["name"], "|", v.get("labels", {}))
    sys.exit()

MODEL = os.environ.get("MODEL", "eleven_v4")
voice, only = sys.argv[1], set(sys.argv[2:])
lines = json.load(open("script.json"))
for i, L in enumerate(lines):
    if only and L["id"] not in only: continue
    window = L["until"] - L["at"]
    speed = L.get("speed", 1.0)
    for attempt in range(3):
        d = call(f"/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128", {
            "text": L["text"], "model_id": MODEL, "language_code": "es",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "speed": speed},
            # Phrase by phrase, with the neighbouring lines as context (user's choice).
            "previous_text": lines[i - 1]["text"] if i > 0 else None,
            "next_text": lines[i + 1]["text"] if i + 1 < len(lines) else None})
        a = d["alignment"]; last = max(i for i, c in enumerate(a["characters"]) if c.isalnum())
        dur = a["character_end_times_seconds"][last]  # speech end, not the trailing punctuation
        if dur <= window or speed >= 1.15: break
        speed = min(1.15, round(speed * dur / window + 0.02, 2))
    pathlib.Path(f"line_{L['id']}.mp3").write_bytes(base64.b64decode(d["audio_base64"]))
    json.dump(d["alignment"], open(f"line_{L['id']}.align.json", "w"))
    print(L["id"], f"{dur:.2f}s / window {window:.2f}s", f"speed {speed}", "OVER" if dur > window else "")
