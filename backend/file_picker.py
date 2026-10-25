import sys
import os
import json
import tempfile
import subprocess
import ctypes
from ctypes import wintypes

class OPENFILENAMEW(ctypes.Structure):
    _fields_ = [
        ("lStructSize", wintypes.DWORD),
        ("hwndOwner", wintypes.HWND),
        ("hInstance", wintypes.HINSTANCE),
        ("lpstrFilter", wintypes.LPCWSTR),
        ("lpstrCustomFilter", wintypes.LPWSTR),
        ("nMaxCustFilter", wintypes.DWORD),
        ("nFilterIndex", wintypes.DWORD),
        ("lpstrFile", wintypes.LPWSTR),
        ("nMaxFile", wintypes.DWORD),
        ("lpstrFileTitle", wintypes.LPWSTR),
        ("nMaxFileTitle", wintypes.DWORD),
        ("lpstrInitialDir", wintypes.LPCWSTR),
        ("lpstrTitle", wintypes.LPCWSTR),
        ("Flags", wintypes.DWORD),
        ("nFileOffset", wintypes.WORD),
        ("nFileExtension", wintypes.WORD),
        ("lpstrDefExt", wintypes.LPCWSTR),
        ("lCustData", wintypes.LPARAM),
        ("lpfnHook", ctypes.c_void_p),
        ("lpTemplateName", wintypes.LPCWSTR),
        ("pvReserved", ctypes.c_void_p),
        ("dwReserved", wintypes.DWORD),
        ("FlagsEx", wintypes.DWORD),
    ]

OFN_EXPLORER = 0x00080000
OFN_FILEMUSTEXIST = 0x00001000
OFN_PATHMUSTEXIST = 0x00000800
OFN_NOCHANGEDIR = 0x00000008
OFN_DONTADDTORECENT = 0x02000000

def pick_file_win32() -> tuple:
    """Uses native Win32 comdlg32.GetOpenFileNameW for instant, foreground file picker with 0 startup delay."""
    if sys.platform != "win32":
        raise NotImplementedError("Win32 picker is only available on Windows")

    # Double-null terminated filter pairs
    filter_str = (
        "Video & Audio Files\0*.mp4;*.mov;*.mkv;*.webm;*.avi;*.m4v;*.mp3;*.wav;*.m4a;*.aac;*.flac\0"
        "Video Files (*.mp4;*.mov;*.mkv;*.webm;*.avi;*.m4v)\0*.mp4;*.mov;*.mkv;*.webm;*.avi;*.m4v\0"
        "Audio Files (*.mp3;*.wav;*.m4a;*.aac;*.flac)\0*.mp3;*.wav;*.m4a;*.aac;*.flac\0"
        "All Files (*.*)\0*.*\0\0"
    )

    buffer = ctypes.create_unicode_buffer(4096)
    hwnd = ctypes.windll.user32.GetForegroundWindow()

    ofn = OPENFILENAMEW()
    ofn.lStructSize = ctypes.sizeof(OPENFILENAMEW)
    ofn.hwndOwner = hwnd
    ofn.lpstrFilter = filter_str
    ofn.nFilterIndex = 1
    ofn.lpstrFile = ctypes.cast(buffer, wintypes.LPWSTR)
    ofn.nMaxFile = 4096
    ofn.lpstrTitle = "Select Video to Link (AutoCaption Zero-Copy)"
    ofn.Flags = OFN_EXPLORER | OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR | OFN_DONTADDTORECENT

    ok = ctypes.windll.comdlg32.GetOpenFileNameW(ctypes.byref(ofn))
    if ok:
        selected = buffer.value
        if selected and os.path.isfile(selected):
            return (False, os.path.normpath(selected))
        return (True, "")
    else:
        err = ctypes.windll.comdlg32.CommDlgExtendedError()
        if err != 0:
            raise RuntimeError(f"GetOpenFileNameW error: {err}")
        return (True, "")  # User cancelled cleanly

def pick_file_tkinter() -> tuple:
    """Fallback to Tkinter file picker dialog."""
    import tkinter as tk
    from tkinter import filedialog
    root = tk.Tk()
    root.withdraw()
    try:
        root.attributes('-topmost', True)
    except Exception:
        pass
    root.update()
    file_path = filedialog.askopenfilename(
        parent=root,
        title="Select Video to Link (AutoCaption Zero-Copy)",
        filetypes=[
            ("Video & Audio Files", "*.mp4 *.mov *.mkv *.webm *.avi *.m4v *.mp3 *.wav *.m4a *.aac *.flac"),
            ("Video Files", "*.mp4 *.mov *.mkv *.webm *.avi *.m4v"),
            ("Audio Files", "*.mp3 *.wav *.m4a *.aac *.flac"),
            ("All Files", "*.*")
        ]
    )
    try:
        root.destroy()
    except Exception:
        pass
    if not file_path:
        return (True, "")  # User cancelled cleanly
    norm = os.path.normpath(file_path)
    return (False, norm) if os.path.isfile(norm) else (True, "")

def pick_file_powershell() -> tuple:
    """Fallback to PowerShell OpenFileDialog."""
    ps_code = """
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.OpenFileDialog
$f.Filter = "Video & Audio Files (*.mp4;*.mov;*.mkv;*.webm;*.avi;*.mp3;*.wav)|*.mp4;*.mov;*.mkv;*.webm;*.avi;*.mp3;*.wav|All Files (*.*)|*.*"
$f.Title = "Select Video to Link (AutoCaption Zero-Copy)"
$f.RestoreDirectory = $true
$f.Multiselect = $false
$res = $f.ShowDialog()
if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::WriteLine($f.FileName)
} else {
    [Console]::WriteLine("__CANCELLED__")
}
"""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".ps1", delete=False, encoding="utf-8") as tmp:
            tmp.write(ps_code)
            tmp_path = tmp.name

        run_res = subprocess.run(
            ["powershell", "-STA", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmp_path],
            capture_output=True,
            text=True,
            timeout=180
        )
        selected = run_res.stdout.strip()
        if not selected or selected == "__CANCELLED__":
            return (True, "")  # User cancelled cleanly
        norm = os.path.normpath(selected)
        return (False, norm) if os.path.isfile(norm) else (True, "")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass

def pick_file() -> dict:
    # 1. Try Win32 ctypes first (instant, standard on Windows, foreground focus)
    try:
        cancelled, path = pick_file_win32()
        if cancelled:
            return {"cancelled": True}
        if path:
            return {"cancelled": False, "file_path": path}
    except Exception as e:
        sys.stderr.write(f"Win32 picker error: {e}\n")

    # 2. Try Tkinter (fallback)
    try:
        cancelled, path = pick_file_tkinter()
        if cancelled:
            return {"cancelled": True}
        if path:
            return {"cancelled": False, "file_path": path}
    except Exception as e:
        sys.stderr.write(f"Tkinter picker error: {e}\n")

    # 3. Fallback to PowerShell script
    try:
        cancelled, path = pick_file_powershell()
        if cancelled:
            return {"cancelled": True}
        if path:
            return {"cancelled": False, "file_path": path}
    except Exception as e:
        sys.stderr.write(f"PowerShell picker error: {e}\n")

    return {"cancelled": True}

if __name__ == "__main__":
    result = pick_file()
    sys.stdout.write(json.dumps(result))
    sys.stdout.flush()

