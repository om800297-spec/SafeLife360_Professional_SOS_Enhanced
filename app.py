from flask import Flask, render_template, request, jsonify
import sqlite3, os, math, requests
from datetime import datetime, timezone

app = Flask(__name__)
DB = os.path.join(os.path.dirname(__file__), "safelife.db")

def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    con = db()
    con.execute("""CREATE TABLE IF NOT EXISTS incidents(
        id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL,
        description TEXT NOT NULL, lat REAL, lon REAL, created_at TEXT NOT NULL)""")
    con.execute("""CREATE TABLE IF NOT EXISTS commutes(
        id INTEGER PRIMARY KEY AUTOINCREMENT, start TEXT, destination TEXT,
        vehicle TEXT, contact TEXT, status TEXT, created_at TEXT NOT NULL)""")
    con.execute("""CREATE TABLE IF NOT EXISTS health(
        id INTEGER PRIMARY KEY CHECK(id=1), name TEXT, blood_group TEXT,
        allergies TEXT, conditions TEXT, emergency_contact TEXT)""")
    con.commit(); con.close()

init_db()

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/api/incidents")
def incidents():
    con=db()
    rows=con.execute("SELECT * FROM incidents ORDER BY id DESC").fetchall()
    con.close()
    return jsonify([dict(r) for r in rows])

@app.post("/api/incidents")
def add_incident():
    data=request.get_json(force=True)
    if not data.get("category") or not data.get("description"):
        return jsonify(error="Category and description are required"),400
    con=db()
    con.execute("INSERT INTO incidents(category,description,lat,lon,created_at) VALUES(?,?,?,?,?)",
                (data["category"],data["description"],data.get("lat"),data.get("lon"),
                 datetime.now(timezone.utc).isoformat()))
    con.commit(); con.close()
    return jsonify(ok=True)

@app.post("/api/route")
def route():
    data=request.get_json(force=True)
    start,dest=data.get("start","").strip(),data.get("destination","").strip()
    if not start or not dest: return jsonify(error="Enter both places"),400
    try:
        headers={"User-Agent":"SafeLife360/1.1 (route lookup)"}
        def geo(q):
            # Normalize common user input such as "Hanumantal,jabalpur".
            cleaned = " ".join(part.strip() for part in q.split(",") if part.strip())
            candidates = [q.strip(), cleaned]
            # For short/local Indian place names, add city/state/country context.
            if "jabalpur" in cleaned.lower():
                candidates += [
                    f"{cleaned}, Madhya Pradesh, India",
                    f"{cleaned}, India",
                ]
            elif "india" not in cleaned.lower():
                candidates += [f"{cleaned}, India"]

            seen = set()
            last_error = None
            for query in candidates:
                if not query or query.lower() in seen:
                    continue
                seen.add(query.lower())
                try:
                    r=requests.get(
                        "https://nominatim.openstreetmap.org/search",
                        params={"q":query,"format":"jsonv2","limit":3,"countrycodes":"in"},
                        headers=headers,timeout=12
                    )
                    r.raise_for_status()
                    results=r.json()
                    if results:
                        # Prefer the first match; retain its full display name for transparency.
                        item=results[0]
                        return float(item["lon"]),float(item["lat"]),item.get("display_name",query)
                except Exception as exc:
                    last_error=exc

            # OpenStreetMap-based Photon fallback can find some localities Nominatim misses.
            try:
                r=requests.get(
                    "https://photon.komoot.io/api/",
                    params={"q":cleaned,"limit":5,"lang":"en"},
                    headers=headers,timeout=12
                )
                r.raise_for_status()
                features=r.json().get("features",[])
                for item in features:
                    props=item.get("properties",{})
                    context=" ".join(str(props.get(k,"")) for k in ("city","state","country")).lower()
                    if not context or "india" in context or "madhya pradesh" in context:
                        coords=item.get("geometry",{}).get("coordinates",[])
                        if len(coords)>=2:
                            label=", ".join(str(props.get(k,"")) for k in ("name","city","state","country") if props.get(k))
                            return float(coords[0]),float(coords[1]),label or cleaned
            except Exception as exc:
                last_error=exc

            detail = f"Place not found: {q}. Try adding the city/state (for example, 'Hanumantal, Jabalpur, Madhya Pradesh, India')."
            if last_error:
                detail += " The location service may also be temporarily unavailable."
            raise ValueError(detail)
        s=geo(start); d=geo(dest)
        rr=requests.get(f"https://router.project-osrm.org/route/v1/driving/{s[0]},{s[1]};{d[0]},{d[1]}",
                        params={"overview":"false"},timeout=12)
        rr.raise_for_status(); route=rr.json()["routes"][0]
        return jsonify(start=s[2],destination=d[2],distance_km=round(route["distance"]/1000,2),
                       duration_min=round(route["duration"]/60),coordinates=[s[:2],d[:2]],
                       source="OpenStreetMap Nominatim + OSRM")
    except Exception as e:
        return jsonify(error=str(e)),502

@app.post("/api/commute")
def commute():
    data=request.get_json(force=True)
    if not data.get("start") or not data.get("destination"):
        return jsonify(error="Start and destination are required"),400
    con=db()
    cur=con.execute("""INSERT INTO commutes(start,destination,vehicle,contact,status,created_at)
                       VALUES(?,?,?,?,?,?)""",
                    (data["start"],data["destination"],data.get("vehicle",""),
                     data.get("contact",""),"MONITORING",datetime.now(timezone.utc).isoformat()))
    con.commit(); cid=cur.lastrowid; con.close()
    return jsonify(id=cid,status="MONITORING")

@app.get("/api/commutes")
def get_commutes():
    con=db(); rows=con.execute("SELECT * FROM commutes ORDER BY id DESC LIMIT 10").fetchall(); con.close()
    return jsonify([dict(r) for r in rows])

@app.get("/api/health")
def get_health():
    con=db(); r=con.execute("SELECT * FROM health WHERE id=1").fetchone(); con.close()
    return jsonify(dict(r) if r else {})

@app.post("/api/health")
def save_health():
    d=request.get_json(force=True)
    con=db()
    con.execute("""INSERT INTO health(id,name,blood_group,allergies,conditions,emergency_contact)
                   VALUES(1,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET name=excluded.name,blood_group=excluded.blood_group,
                   allergies=excluded.allergies,conditions=excluded.conditions,
                   emergency_contact=excluded.emergency_contact""",
                (d.get("name",""),d.get("blood_group",""),d.get("allergies",""),
                 d.get("conditions",""),d.get("emergency_contact","")))
    con.commit(); con.close()
    return jsonify(ok=True)

@app.get("/api/stats")
def stats():
    con=db()
    n=con.execute("SELECT COUNT(*) c FROM incidents").fetchone()["c"]
    c=con.execute("SELECT COUNT(*) c FROM commutes").fetchone()["c"]
    con.close()
    return jsonify(incidents=n,commutes=c)

if __name__=="__main__":
    app.run(host="0.0.0.0",port=int(os.environ.get("PORT",5000)),debug=True)
