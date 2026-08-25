import subprocess
import json
import urllib.request
import time
import base64
import os
import asyncio
import websockets
from PIL import Image

CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"

async def test_pipeline():
    os.makedirs("scratch/dom_frames", exist_ok=True)
    
    # 1. Start Chrome headless
    proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        "--remote-debugging-port=9222",
        "--remote-allow-origins=*",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--default-background-color=00000000",
        "--hide-scrollbars",
        "--window-size=1080,1920"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    try:
        ws_url = None
        for _ in range(30):
            await asyncio.sleep(0.1)
            try:
                req = urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=1.0)
                data = json.loads(req.read().decode())
                if data:
                    ws_url = data[0].get("webSocketDebuggerUrl")
                    break
            except Exception:
                pass
                
        print("Connected to Chrome CDP at:", ws_url)
        
        async with websockets.connect(ws_url, max_size=100_000_000) as ws:
            msg_id = 0
            
            async def send_cmd(method, params=None):
                nonlocal msg_id
                msg_id += 1
                payload = {"id": msg_id, "method": method, "params": params or {}}
                await ws.send(json.dumps(payload))
                while True:
                    resp_str = await ws.recv()
                    resp = json.loads(resp_str)
                    if resp.get("id") == msg_id:
                        return resp.get("result", {})
                        
            # Enable Page and Emulation
            await send_cmd("Page.enable")
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1080,
                "height": 1920,
                "deviceScaleFactor": 1,
                "mobile": False
            })
            await send_cmd("Emulation.setDefaultBackgroundColorOverride", {
                "color": {"r": 0, "g": 0, "b": 0, "a": 0}
            })
            
            # HTML content matching browser preview EXACTLY
            html = """<!DOCTYPE html>
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
.caption-container {
  position: absolute;
  top: 74%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 972px; /* 90% */
  text-align: center;
  font-family: 'Montserrat', sans-serif;
  font-size: 118.45px;
  font-weight: 900;
  line-height: 1.02;
  text-transform: uppercase;
  letter-spacing: -1.74px;
}
.word {
  display: inline-block;
  margin: 0 13.93px;
  color: #FFFFFF;
  -webkit-text-stroke: 10.45px #000000;
  paint-order: stroke fill;
  text-shadow: 0px 13.93px 27.87px rgba(0, 0, 0, 0.85);
  transition: transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.word.active {
  color: #FFE600;
  transform: scale(1.08);
}
</style>
</head>
<body>
  <div id="caption-root" class="caption-container"></div>
</body>
</html>"""
            
            # Navigate to data URL
            data_url = "data:text/html;charset=utf-8," + urllib.parse.quote(html)
            await send_cmd("Page.navigate", {"url": data_url})
            
            # Wait for fonts to load
            await send_cmd("Runtime.evaluate", {
                "expression": "document.fonts.ready.then(() => true)",
                "awaitPromise": True
            })
            
            test_states = [
                {"id": "s1", "lines": [["WHITENING"], ["STRIPS", "ONLY"]], "active": "WHITENING"},
                {"id": "s2", "lines": [["WHITENING"], ["STRIPS", "ONLY"]], "active": "STRIPS"},
                {"id": "s3", "lines": [["WHITENING"], ["STRIPS", "ONLY"]], "active": "ONLY"},
                {"id": "s4", "lines": [["PAYING", "TO"], ["GET"]], "active": "PAYING"},
                {"id": "s5", "lines": [["PAYING", "TO"], ["GET"]], "active": "TO"},
                {"id": "s6", "lines": [["PAYING", "TO"], ["GET"]], "active": "GET"}
            ]
            
            t0 = time.time()
            for st in test_states:
                # Update DOM in page
                js_code = f"""
                (() => {{
                    const root = document.getElementById('caption-root');
                    root.innerHTML = '';
                    const lines = {json.dumps(st['lines'])};
                    const activeWord = {json.dumps(st['active'])};
                    lines.forEach(lWords => {{
                        const lineDiv = document.createElement('div');
                        lWords.forEach(w => {{
                            const span = document.createElement('span');
                            span.className = 'word' + (w === activeWord ? ' active' : '');
                            span.textContent = w;
                            lineDiv.appendChild(span);
                        }});
                        root.appendChild(lineDiv);
                    }});
                }})()
                """
                await send_cmd("Runtime.evaluate", {"expression": js_code})
                
                # Capture transparent PNG
                shot_res = await send_cmd("Page.captureScreenshot", {
                    "format": "png",
                    "fromSurface": True,
                    "omitBackground": True
                })
                
                png_bytes = base64.b64decode(shot_res.get("data", ""))
                out_path = f"scratch/dom_frames/{st['id']}.png"
                with open(out_path, "wb") as f:
                    f.write(png_bytes)
                    
            elapsed = time.time() - t0
            print(f"Rendered {len(test_states)} 1080x1920 transparent frames in {elapsed:.3f}s ({elapsed/len(test_states)*1000:.1f}ms/frame)")
            
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=1.0)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    asyncio.run(test_pipeline())
