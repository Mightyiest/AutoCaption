import subprocess
import json
import urllib.request
import time
import base64
import os
import sys

CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"

# Launch Chrome with remote debugging
proc = subprocess.Popen([
    CHROME_PATH,
    "--headless=new",
    "--remote-debugging-port=9222",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--default-background-color=00000000",
    "--hide-scrollbars",
    "--window-size=1080,1920"
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

try:
    # Wait for DevTools port to open
    ws_url = None
    for _ in range(20):
        time.sleep(0.1)
        try:
            req = urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=1.0)
            data = json.loads(req.read().decode())
            if data:
                ws_url = data[0].get("webSocketDebuggerUrl")
                break
        except Exception:
            pass

    print("Chrome WebSocket URL:", ws_url)
finally:
    proc.terminate()
    try:
        proc.wait(timeout=1.0)
    except Exception:
        proc.kill()
