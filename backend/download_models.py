import os
import sys
from faster_whisper import WhisperModel

MODELS = ["tiny", "base"]

def preload_models():
    print("===================================================")
    print("  Pre-downloading Whisper Models for Offline Use   ")
    print("===================================================")
    
    for m in MODELS:
        print(f"\n[+] Downloading / Caching '{m}' model (CPU int8)...")
        try:
            model = WhisperModel(m, device="cpu", compute_type="int8")
            print(f"    [OK] Successfully cached '{m}' model for offline use!")
        except Exception as e:
            print(f"    [ERROR] Error caching '{m}': {e}")
            
    print("\n[DONE] All offline models ready!")

if __name__ == "__main__":
    preload_models()
