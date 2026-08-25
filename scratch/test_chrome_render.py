import os
import subprocess

html_content = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
body {
  margin: 0;
  padding: 0;
  width: 1080px;
  height: 1920px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.caption-box {
  position: absolute;
  top: 74%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 972px; /* 90% of 1080 */
  text-align: center;
  font-family: 'Montserrat', sans-serif;
  font-size: 118px; /* 34px * 3.48387 */
  font-weight: 900;
  line-height: 1.02;
  text-transform: uppercase;
  letter-spacing: -1.74px;
}
.word {
  display: inline-block;
  margin: 0 14px; /* 4px * 3.48387 */
  color: #FFFFFF;
  -webkit-text-stroke: 10.4px #000000;
  paint-order: stroke fill;
  text-shadow: 0px 14px 28px rgba(0, 0, 0, 0.85);
}
.word.active {
  color: #FFE600;
  transform: scale(1.08);
}
</style>
</head>
<body>
  <div class="caption-box">
    <div>
      <span class="word active">WHITENING</span>
    </div>
    <div>
      <span class="word">STRIPS</span>
      <span class="word">ONLY</span>
    </div>
  </div>
</body>
</html>
"""

os.makedirs("scratch", exist_ok=True)
html_path = os.path.abspath("scratch/sample_caption.html")
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

out_png = os.path.abspath("scratch/sample_caption.png")
chrome_exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

cmd = [
    chrome_exe,
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1080,1920",
    "--default-background-color=00000000",
    f"--screenshot={out_png}",
    html_path
]

print("Running Chrome headless snapshot...")
res = subprocess.run(cmd, capture_output=True, text=True)
print("Chrome exit code:", res.returncode)
print("Generated PNG exists:", os.path.exists(out_png))
