import os
import subprocess
import time
import imageio_ffmpeg

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

# Let's test overlaying 2 transparent PNG states over a 5-second 1080x1920 video
source_video = "scratch/test_multiline_v2.mp4"
output_video = "scratch/test_overlay_dom.mp4"

# Use sample_caption.png
png_1 = os.path.abspath("scratch/sample_caption.png")

filter_str = f"[0:v][1:v]overlay=0:0:enable='between(t,0,2.5)'[v1];[v1][1:v]overlay=0:0:enable='between(t,2.5,5.0)'[outv]"

cmd = [
    ffmpeg_exe,
    "-y",
    "-i", source_video,
    "-i", png_1,
    "-filter_complex", filter_str,
    "-map", "[outv]",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "18",
    "-c:a", "copy",
    output_video
]

t0 = time.time()
res = subprocess.run(cmd, capture_output=True, text=True)
elapsed = time.time() - t0

print("FFmpeg overlay exit code:", res.returncode)
print(f"FFmpeg composite time: {elapsed:.2f}s")
print("Output exists:", os.path.exists(output_video))
