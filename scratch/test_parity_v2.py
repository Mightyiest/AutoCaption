import os
import sys
import subprocess
import imageio_ffmpeg

sys.path.insert(0, os.path.abspath("backend"))
from renderer import render_captioned_video

source_vid = os.path.abspath("backend/test_sub_in.mp4")

# Test 1: Zero Stroke with Shadow Underlay
out_vid_1 = os.path.abspath("scratch/test_zero_stroke.mp4")
out_png_1 = os.path.abspath("scratch/test_zero_stroke.png")

segments_1 = [
    {
        "id": "seg-1",
        "start": 0.0,
        "end": 3.0,
        "text": "CLEAN FROSTED PILL SHADOW TEST",
        "words": [
            {"word": "CLEAN", "start": 0.0, "end": 0.75},
            {"word": "FROSTED", "start": 0.75, "end": 1.5},
            {"word": "PILL", "start": 1.5, "end": 2.25},
            {"word": "TEST", "start": 2.25, "end": 3.0}
        ],
        "measured_word_boxes": [
            {"index": 0, "line": 0, "center_x": -100.0, "center_y": 0.0, "width": 55.0, "height": 38.0},
            {"index": 1, "line": 0, "center_x": -30.0, "center_y": 0.0, "width": 75.0, "height": 38.0},
            {"index": 2, "line": 0, "center_x": 40.0, "center_y": 0.0, "width": 45.0, "height": 38.0},
            {"index": 3, "line": 0, "center_x": 95.0, "center_y": 0.0, "width": 48.0, "height": 38.0}
        ]
    }
]

style_zero_stroke = {
    "fontFamily": "Montserrat",
    "fontSize": 34,
    "fontWeight": "900",
    "primaryColor": "#FFFFFF",
    "activeColor": "#38BDF8",
    "strokeColor": "#000000",
    "strokeWidth": 0,
    "shadowColor": "#000000",
    "shadowBlur": 12,
    "shadowOffsetY": 4,
    "positionX": 50,
    "positionY": 74,
    "textTransform": "uppercase",
    "animationType": "pop"
}

render_captioned_video(
    source_video_path=source_vid,
    output_video_path=out_vid_1,
    segments=segments_1,
    style=style_zero_stroke,
    video_width=1080,
    video_height=1920,
    preview_metrics={"container_width": 310, "container_height": 550}
)

# Test 2: Multiline 3-word segment with absolute word boxes (Hormozi style)
out_vid_2 = os.path.abspath("scratch/test_multiline_v2.mp4")
out_png_2 = os.path.abspath("scratch/test_multiline_v2.png")

segments_2 = [
    {
        "id": "seg-2",
        "start": 0.0,
        "end": 3.0,
        "text": "GENTLE EMERGENCY EVALUATIONS",
        "words": [
            {"word": "GENTLE", "start": 0.0, "end": 1.0},
            {"word": "EMERGENCY", "start": 1.0, "end": 2.0},
            {"word": "EVALUATIONS", "start": 2.0, "end": 3.0}
        ],
        "measured_word_boxes": [
            {"index": 0, "line": 0, "center_x": 0.0, "center_y": -42.0, "width": 110.0, "height": 39.0},
            {"index": 1, "line": 1, "center_x": 0.0, "center_y": 0.0, "width": 175.0, "height": 39.0},
            {"index": 2, "line": 2, "center_x": 0.0, "center_y": 42.0, "width": 185.0, "height": 39.0}
        ]
    }
]

style_hormozi = {
    "fontFamily": "Montserrat",
    "fontSize": 34,
    "fontWeight": "900",
    "primaryColor": "#FFFFFF",
    "activeColor": "#FFE600",
    "strokeColor": "#000000",
    "strokeWidth": 6,
    "shadowColor": "#000000",
    "shadowBlur": 8,
    "shadowOffsetY": 4,
    "positionX": 50,
    "positionY": 74,
    "textTransform": "uppercase",
    "animationType": "pop"
}

render_captioned_video(
    source_video_path=source_vid,
    output_video_path=out_vid_2,
    segments=segments_2,
    style=style_hormozi,
    video_width=1080,
    video_height=1920,
    preview_metrics={"container_width": 310, "container_height": 550}
)

# Test 3: Spacing, Leading & Typography Test (Custom Tracking, Word Gap, Leading, Italic)
out_vid_3 = os.path.abspath("scratch/test_typography_spacing.mp4")
out_png_3 = os.path.abspath("scratch/test_typography_spacing.png")

segments_3 = [
    {
        "id": "seg-3",
        "start": 0.0,
        "end": 3.0,
        "text": "EXPANDED WORD SPACING AND LEADING",
        "words": [
            {"word": "EXPANDED", "start": 0.0, "end": 0.75},
            {"word": "WORD", "start": 0.75, "end": 1.5},
            {"word": "SPACING", "start": 1.5, "end": 2.25},
            {"word": "LEADING", "start": 2.25, "end": 3.0}
        ],
        "measured_word_boxes": [
            {"index": 0, "line": 0, "center_x": -60.0, "center_y": -35.0, "width": 100.0, "height": 38.0},
            {"index": 1, "line": 0, "center_x": 60.0, "center_y": -35.0, "width": 60.0, "height": 38.0},
            {"index": 2, "line": 1, "center_x": -55.0, "center_y": 35.0, "width": 90.0, "height": 38.0},
            {"index": 3, "line": 1, "center_x": 55.0, "center_y": 35.0, "width": 90.0, "height": 38.0}
        ]
    }
]

style_typography = {
    "fontFamily": "Outfit",
    "fontSize": 32,
    "fontWeight": "800",
    "fontStyle": "italic",
    "wordSpacing": 16,
    "letterSpacing": 3.0,
    "lineHeight": 1.45,
    "primaryColor": "#FFFFFF",
    "activeColor": "#00FF66",
    "strokeColor": "#000000",
    "strokeWidth": 6,
    "shadowColor": "#000000",
    "shadowBlur": 10,
    "shadowOffsetX": 2,
    "shadowOffsetY": 5,
    "positionX": 50,
    "positionY": 70,
    "textTransform": "uppercase",
    "animationType": "pop"
}

render_captioned_video(
    source_video_path=source_vid,
    output_video_path=out_vid_3,
    segments=segments_3,
    style=style_typography,
    video_width=1080,
    video_height=1920,
    preview_metrics={"container_width": 310, "container_height": 550}
)

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
subprocess.run([ffmpeg_exe, "-y", "-ss", "1.5", "-i", out_vid_1, "-vframes", "1", out_png_1], check=True)
subprocess.run([ffmpeg_exe, "-y", "-ss", "1.5", "-i", out_vid_2, "-vframes", "1", out_png_2], check=True)
subprocess.run([ffmpeg_exe, "-y", "-ss", "1.5", "-i", out_vid_3, "-vframes", "1", out_png_3], check=True)
print("Saved verification frames:", out_png_1, out_png_2, out_png_3)
