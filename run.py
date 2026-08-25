import os
import sys
import uvicorn
import webbrowser
import threading
import time

# Ensure backend directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

try:
    if sys.stdout:
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def open_browser():
    time.sleep(1.5)
    url = "http://127.0.0.1:8000"
    print(f"\n[ExamPulse] Launching Live Current Affairs Web App in browser: {url}")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Browser launch note: {e}")

if __name__ == "__main__":
    print("=" * 70)
    print("[*] ExamPulse - Live Current Affairs for SSC, Railway & Bank Preparation")
    print("Primary Sources: GKToday, Drishti IAS, The Hindu, Economic Times, TOI")
    print("=" * 70)
    
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Run FastAPI server
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False, app_dir=BACKEND_DIR)

