import imageio_ffmpeg
import subprocess
import os

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
fonts_dir = os.path.abspath("backend/storage/fonts").replace("\\", "/").replace(":", "\\\\:")

# Single-layer ASS with native BackColour shadow and Outline
ass_text = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: MainStyle,Montserrat,118,&H00FFFFFF&,&H0000E6FF&,&H00000000&,&H50000000&,-1,0,0,0,100,100,-2,0,1,10,14,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 1,0:00:00.00,0:00:05.00,MainStyle,,0,0,0,,{{\\an5\\pos(540,1400)\\fsp-2\\blur2.5}}{{\\c&H00FFFFFF&}}TO SUFFER
Dialogue: 1,0:00:00.00,0:00:05.00,MainStyle,,0,0,0,,{{\\an5\\pos(540,1520)\\fsp-2\\blur2.5}}{{\\c&H0000E6FF&\\fscx108\\fscy108}}THROUGH{{\\rMainStyle}}
"""

os.makedirs("scratch", exist_ok=True)
ass_p = os.path.abspath("scratch/test_single_layer.ass")
with open(ass_p, "w", encoding="utf-8") as f:
    f.write(ass_text)

escaped_ass_p = ass_p.replace("\\", "/").replace(":", "\\\\:")
out_png = os.path.abspath("scratch/test_single_layer.png")

cmd = [
    ffmpeg_exe,
    "-y",
    "-f", "lavfi",
    "-i", "color=c=black:s=1080x1920:d=1",
    "-vf", f"ass={escaped_ass_p}:fontsdir={fonts_dir}",
    "-vframes", "1",
    out_png
]

res = subprocess.run(cmd, capture_output=True, text=True)
print("Return code:", res.returncode)
print("Output png exists:", os.path.exists(out_png))
