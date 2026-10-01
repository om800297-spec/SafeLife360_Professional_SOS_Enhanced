# SafeLife 360 — Professional Interactive Project

A real-world oriented safety platform combining five modules:
1. Safe Route
2. SOS Center
3. Anonymous Incident Reporting + Heatmap
4. Safe Commute Verification
5. Emergency Health Profile

## Run locally
Python 3.10+ recommended.

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000

## Real-data design
- Route search uses OpenStreetMap Nominatim for geocoding and OSRM for routing.
- Incident reports are stored in SQLite and displayed only after users submit them.
- The browser can provide the user's current location after permission.
- SOS, SMS, police dispatch and background shake/voice detection require native mobile permissions/services; this web build deliberately does not pretend that a browser has sent an emergency alert.
- For production, configure a real SMS/push provider and HTTPS.

## Deployment
Render can use:
Build: `pip install -r requirements.txt`
Start: `gunicorn app:app`

Do not publish secrets in source code.

## SOS Center
The SOS Center now supports browser/mobile workflows: current-location capture, one-tap call to India's 112 emergency number, call/SMS to the saved emergency contact, WhatsApp sharing, foreground voice-trigger support (where supported), and foreground device-motion/shake detection (where supported). These actions open the phone's native dialer/messaging apps; the web app does not silently contact emergency services.
