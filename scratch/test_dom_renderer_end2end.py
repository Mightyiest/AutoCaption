import os
import sys
import json
import time

sys.path.insert(0, os.path.abspath("backend"))
from dom_renderer import render_captioned_video_dom

# Load real payload snapshot
with open("backend/storage/debug/render_22c7d691daaa_payload.json", "r", encoding="utf-8") as f:
    payload = json.load(f)

# Take first 3 segments (approx 3 seconds) for quick test
segments = payload["segments"][:3]
style = payload["style"]
source_video = "scratch/test_multiline_v2.mp4"
output_video = "scratch/test_dom_end2end.mp4"

print("Starting DOM-based 1:1 render test...")
t0 = time.time()
render_captioned_video_dom(
    source_video_path=source_video,
    output_video_path=output_video,
    segments=segments,
    style=style,
    video_width=1080,
    video_height=1920,
    video_duration=5.0,
    encoder_mode="cpu",
    progress_callback=lambda p: print(f"Progress: {p}%")
)
elapsed = time.time() - t0
print(f"Render completed in {elapsed:.2f}s! Output file exists: {os.path.exists(output_video)}")
