"""Instrumental music bed for the launch film via ElevenLabs Music (key from $ELEVENLABS_API_KEY, never printed)."""
import json, os, pathlib, sys, urllib.request
k = os.environ.get("ELEVENLABS_API_KEY") or sys.exit("No ELEVENLABS_API_KEY found")
plan = {
  "positive_global_styles": ["modern minimal electronic", "tech product launch", "instrumental", "clean warm synths", "92 bpm", "cinematic but understated"],
  "negative_global_styles": ["vocals", "lyrics", "rap", "aggressive drops", "heavy distortion", "busy drums"],
  "sections": [
    {"section_name": "Hook", "duration_ms": 15000, "lines": [],
     "positive_local_styles": ["dark and tense", "low sustained pad", "soft ticking pulse", "sparse muted plucks", "slowly building"], "negative_local_styles": ["kick drum", "bright chords"]},
    {"section_name": "Reveal", "duration_ms": 4500, "lines": [],
     "positive_local_styles": ["uplifting lift", "warm bright major chords open up", "soft kick enters", "sunrise feeling", "short riser into it"], "negative_local_styles": ["big EDM drop"]},
    {"section_name": "Demo", "duration_ms": 29500, "lines": [],
     "positive_local_styles": ["light optimistic groove", "steady soft kick and shaker", "airy synth arpeggio", "leaves space for voiceover", "consistent energy"], "negative_local_styles": ["lead melody", "loud snares"]},
    {"section_name": "Privacy", "duration_ms": 9500, "lines": [],
     "positive_local_styles": ["intimate and calm", "filtered, drums drop out", "gentle pad and soft piano notes", "trustworthy"], "negative_local_styles": ["drums"]},
    {"section_name": "Close", "duration_ms": 6800, "lines": [],
     "positive_local_styles": ["warm resolving final chord", "brief swell then clean ending", "confident"], "negative_local_styles": ["abrupt cut", "fade into silence too early"]}
  ]
}
body = {"composition_plan": plan, "model_id": "music_v1"}
req = urllib.request.Request("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", data=json.dumps(body).encode(),
                             headers={"xi-api-key": k, "content-type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=600) as r: data = r.read(); ctype = r.headers.get("content-type")
except urllib.error.HTTPError as e: sys.exit(f"{e.code} {e.read()[:400]!r}")
out = sys.argv[1] if len(sys.argv) > 1 else "bed.mp3"
pathlib.Path(out).write_bytes(data); print("ok", out, ctype, len(data))
