import os
import sys
import time
import signal
import threading
import subprocess

# Enable ANSI escape sequences on Windows console
if sys.platform == "win32":
    os.system("")

# Color Constants
CYAN = "96"
MAGENTA = "95"
GREEN = "92"
YELLOW = "93"
RED = "91"
BOLD = "1"
RESET = "0"

def colorize(text: str, color_code: str) -> str:
    return f"\033[{color_code}m{text}\033[{RESET}m"

def stream_logs(pipe, prefix: str, color_code: str):
    """Stream subprocess stdout/stderr line-by-line with colored prefix."""
    try:
        for line in iter(pipe.readline, ''):
            if not line:
                break
            line_str = line.rstrip('\r\n')
            if line_str:
                print(f"{colorize(f'[{prefix}]', color_code)} {line_str}", flush=True)
    except Exception:
        pass
    finally:
        try:
            pipe.close()
        except Exception:
            pass

def kill_process_tree(proc: subprocess.Popen):
    """Cleanly terminate a process and all of its spawned child processes."""
    if proc is None or proc.poll() is not None:
        return
    try:
        import psutil
        parent = psutil.Process(proc.pid)
        children = parent.children(recursive=True)
        for child in children:
            try:
                child.kill()
            except Exception:
                pass
        parent.kill()
    except Exception:
        if sys.platform == "win32":
            try:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            except Exception:
                pass
        else:
            try:
                proc.terminate()
            except Exception:
                pass

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print(colorize("===================================================", CYAN))
    print(colorize("    AutoCaption Studio - Unified Dev Launcher      ", CYAN))
    print(colorize("===================================================", CYAN))
    print()
    print(f" {colorize('•', GREEN)} {colorize('Frontend:', BOLD)} http://localhost:5173")
    print(f" {colorize('•', GREEN)} {colorize('Backend:', BOLD)}  http://127.0.0.1:8000")
    print(f" {colorize('•', YELLOW)} Press {colorize('Ctrl+C', BOLD)} in this terminal to stop both servers.")
    print()

    # Prepare execution environment
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env["FORCE_COLOR"] = "1"

    # Start FastAPI Backend
    backend_cmd = [sys.executable, "-u", "app.py"]
    try:
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=backend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env
        )
    except Exception as e:
        print(f"{colorize('[ERROR]', RED)} Failed to start backend: {e}")
        sys.exit(1)

    # Start Vite Frontend
    npm_executable = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_cmd = [npm_executable, "run", "dev"]
    try:
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env
        )
    except Exception as e:
        print(f"{colorize('[ERROR]', RED)} Failed to start frontend: {e}")
        kill_process_tree(backend_proc)
        sys.exit(1)

    # Start Log Streaming Threads
    t_backend = threading.Thread(
        target=stream_logs,
        args=(backend_proc.stdout, "BACKEND", CYAN),
        daemon=True
    )
    t_frontend = threading.Thread(
        target=stream_logs,
        args=(frontend_proc.stdout, "FRONTEND", MAGENTA),
        daemon=True
    )
    t_backend.start()
    t_frontend.start()

    # Wait for interruption or process exit
    try:
        while True:
            b_code = backend_proc.poll()
            f_code = frontend_proc.poll()

            if b_code is not None:
                print(f"\n{colorize('[BACKEND]', CYAN)} Process exited with code {b_code}.")
                break
            if f_code is not None:
                print(f"\n{colorize('[FRONTEND]', MAGENTA)} Process exited with code {f_code}.")
                break

            time.sleep(0.3)
    except KeyboardInterrupt:
        print(f"\n{colorize('[SHUTDOWN]', YELLOW)} Stopping backend and frontend...")
    finally:
        kill_process_tree(backend_proc)
        kill_process_tree(frontend_proc)
        print(f"{colorize('[OK]', GREEN)} All services stopped.")

if __name__ == "__main__":
    main()
