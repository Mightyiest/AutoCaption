import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"

os.makedirs("scratch/batch_html", exist_ok=True)
os.makedirs("scratch/batch_png", exist_ok=True)

def render_one(idx):
    html_p = os.path.abspath(f"scratch/batch_html/state_{idx}.html")
    png_p = os.path.abspath(f"scratch/batch_png/state_{idx}.png")
    
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
body {{
  margin: 0; padding: 0; width: 1080px; height: 1920px;
  background: transparent; display: flex; align-items: center; justify-content: center; overflow: hidden;
}}
.caption-container {{
  position: absolute; top: 74%; left: 50%; transform: translate(-50%, -50%);
  width: 972px; text-align: center; font-family: 'Montserrat', sans-serif;
  font-size: 118.45px; font-weight: 900; line-height: 1.02; text-transform: uppercase; letter-spacing: -1.74px;
}}
.word {{
  display: inline-block; margin: 0 13.93px; color: #FFFFFF;
  -webkit-text-stroke: 10.45px #000000; paint-order: stroke fill;
  text-shadow: 0px 13.93px 27.87px rgba(0, 0, 0, 0.85);
}}
.active {{ color: #FFE600; transform: scale(1.08); }}
</style>
</head>
<body>
  <div class="caption-container">
    <div><span class="word {'active' if idx%3==0 else ''}">WHITENING</span></div>
    <div>
      <span class="word {'active' if idx%3==1 else ''}">STRIPS</span>
      <span class="word {'active' if idx%3==2 else ''}">ONLY</span>
    </div>
  </div>
</body>
</html>"""
    with open(html_p, "w", encoding="utf-8") as f:
        f.write(html)
        
    cmd = [
        CHROME_PATH,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=1080,1920",
        "--default-background-color=00000000",
        f"--screenshot={png_p}",
        html_p
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return png_p

t0 = time.time()
with ThreadPoolExecutor(max_workers=6) as executor:
    results = list(executor.map(render_one, range(12)))
elapsed = time.time() - t0

print(f"Generated {len(results)} high-res 1080x1920 transparent frames in {elapsed:.2f}s (parallel Chrome instances)")
