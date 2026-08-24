import os
import urllib.request
import re
import struct

FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "fonts")
os.makedirs(FONTS_DIR, exist_ok=True)

FONT_QUERIES = {
    "Montserrat-Black.ttf": "https://fonts.googleapis.com/css2?family=Montserrat:wght@900",
    "Montserrat-ExtraBold.ttf": "https://fonts.googleapis.com/css2?family=Montserrat:wght@800",
    "RussoOne-Regular.ttf": "https://fonts.googleapis.com/css2?family=Russo+One",
    "Outfit-Bold.ttf": "https://fonts.googleapis.com/css2?family=Outfit:wght@800",
    "BebasNeue-Regular.ttf": "https://fonts.googleapis.com/css2?family=Bebas+Neue",
    "Bangers-Regular.ttf": "https://fonts.googleapis.com/css2?family=Bangers",
    "PlusJakartaSans-Bold.ttf": "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@800"
}

def get_ttf_names(path):
    try:
        with open(path, "rb") as f:
            data = f.read()
        num_tables = struct.unpack(">H", data[4:6])[0]
        name_offset = None
        for i in range(num_tables):
            tag = data[12+i*16:16+i*16].decode("latin1")
            if tag == "name":
                name_offset = struct.unpack(">I", data[20+i*16:24+i*16])[0]
                break
        if not name_offset:
            return []
        count, string_offset = struct.unpack(">HH", data[name_offset+2:name_offset+6])
        names = []
        storage = name_offset + string_offset
        for i in range(count):
            plat, enc, lang, name_id, length, offset = struct.unpack(">HHHHHH", data[name_offset+6+i*12:name_offset+18+i*12])
            raw_str = data[storage+offset:storage+offset+length]
            if plat == 3:
                try:
                    s = raw_str.decode("utf-16be")
                except Exception:
                    s = str(raw_str)
            else:
                try:
                    s = raw_str.decode("utf-8")
                except Exception:
                    s = raw_str.decode("latin1")
            if name_id in (1, 4):
                if s not in names:
                    names.append(f"id{name_id}:{s}")
        return names
    except Exception as e:
        return [f"err:{e}"]

def download_all_fonts():
    print("Downloading static TrueType TTF bold/black fonts for AutoCaption Studio...")
    headers = {"User-Agent": "Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1"}
    
    for filename, css_url in FONT_QUERIES.items():
        dest = os.path.join(FONTS_DIR, filename)
        print(f"Resolving {filename}...")
        try:
            req = urllib.request.Request(css_url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                css = resp.read().decode("utf-8")
            m = re.search(r"src:\s*url\((https://fonts\.gstatic\.com/[^)]+\.ttf)\)", css)
            if not m:
                print(f"[FAIL] Could not find TTF url in CSS for {filename}")
                continue
            ttf_url = m.group(1)
            
            ttf_req = urllib.request.Request(ttf_url, headers=headers)
            with urllib.request.urlopen(ttf_req, timeout=15) as resp, open(dest, "wb") as out_file:
                out_file.write(resp.read())
                
            names = get_ttf_names(dest)
            print(f"[OK] {filename} saved ({os.path.getsize(dest)} bytes). Names: {names}")
        except Exception as e:
            print(f"[FAIL] Error downloading {filename}: {e}")

if __name__ == "__main__":
    download_all_fonts()
