"""
CampusConnect Backend
----------------------
Flask + SQLite backend serving three modules:
  1. Lost & Found
  2. Notice Board
  3. Skill Exchange

Run:
    pip install -r requirements.txt
    python app.py

Server starts on http://localhost:5000
"""

import sqlite3
import os
from datetime import datetime
from flask import Flask, request, jsonify, g

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "campusconnect.db")

app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    """Frontend (index.html, veglya port/file varun) API call karu shakel mhanun CORS enable."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
    return response


@app.route("/api/<path:_any>", methods=["OPTIONS"])
def cors_preflight(_any):
    return "", 204

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS lost_found (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,                 -- 'lost' or 'found'
            item_name TEXT NOT NULL,
            description TEXT,
            location TEXT,
            contact TEXT NOT NULL,
            posted_by TEXT,
            status TEXT DEFAULT 'open',          -- 'open' or 'resolved'
            created_at TEXT NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS notices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT DEFAULT 'general',     -- general/event/exam/urgent
            posted_by TEXT,
            created_at TEXT NOT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS skills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            skill_offered TEXT NOT NULL,
            skill_wanted TEXT,
            description TEXT,
            contact TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def row_to_dict(row):
    return dict(row)


# ---------------------------------------------------------------------------
# Root / health check
# ---------------------------------------------------------------------------

@app.route("/")
def home():
    return jsonify({
        "message": "CampusConnect API chalu aahe",
        "endpoints": [
            "/api/lostfound  [GET, POST]",
            "/api/lostfound/<id>  [PATCH, DELETE]",
            "/api/notices    [GET, POST]",
            "/api/notices/<id>  [DELETE]",
            "/api/skills     [GET, POST]",
            "/api/skills/<id>  [DELETE]",
            "/api/stats      [GET]",
        ]
    })


# ---------------------------------------------------------------------------
# LOST & FOUND
# ---------------------------------------------------------------------------

@app.route("/api/lostfound", methods=["GET"])
def get_lostfound():
    db = get_db()
    q = request.args.get("q", "").strip()
    type_filter = request.args.get("type", "").strip()   # lost / found / ""
    status_filter = request.args.get("status", "").strip()

    sql = "SELECT * FROM lost_found WHERE 1=1"
    params = []

    if q:
        sql += " AND (item_name LIKE ? OR description LIKE ? OR location LIKE ?)"
        like = f"%{q}%"
        params += [like, like, like]

    if type_filter in ("lost", "found"):
        sql += " AND type = ?"
        params.append(type_filter)

    if status_filter in ("open", "resolved"):
        sql += " AND status = ?"
        params.append(status_filter)

    sql += " ORDER BY created_at DESC"

    rows = db.execute(sql, params).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/lostfound", methods=["POST"])
def add_lostfound():
    data = request.get_json(force=True)

    required = ["type", "item_name", "contact"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"'{field}' ha field required aahe"}), 400

    if data["type"] not in ("lost", "found"):
        return jsonify({"error": "type 'lost' किंवा 'found' असावा"}), 400

    db = get_db()
    cur = db.execute(
        """INSERT INTO lost_found
           (type, item_name, description, location, contact, posted_by, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'open', ?)""",
        (
            data["type"],
            data["item_name"],
            data.get("description", ""),
            data.get("location", ""),
            data["contact"],
            data.get("posted_by", "Anonymous"),
            now_str(),
        ),
    )
    db.commit()
    new_row = db.execute("SELECT * FROM lost_found WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(row_to_dict(new_row)), 201


@app.route("/api/lostfound/<int:item_id>", methods=["PATCH"])
def update_lostfound(item_id):
    """Status 'resolved' karnyasathi (item milala tar)."""
    data = request.get_json(force=True)
    status = data.get("status")
    if status not in ("open", "resolved"):
        return jsonify({"error": "status 'open' किंवा 'resolved' असावा"}), 400

    db = get_db()
    db.execute("UPDATE lost_found SET status = ? WHERE id = ?", (status, item_id))
    db.commit()
    row = db.execute("SELECT * FROM lost_found WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Item sapadla nahi"}), 404
    return jsonify(row_to_dict(row))


@app.route("/api/lostfound/<int:item_id>", methods=["DELETE"])
def delete_lostfound(item_id):
    db = get_db()
    db.execute("DELETE FROM lost_found WHERE id = ?", (item_id,))
    db.commit()
    return jsonify({"message": "Delete zala"})


# ---------------------------------------------------------------------------
# NOTICE BOARD
# ---------------------------------------------------------------------------

@app.route("/api/notices", methods=["GET"])
def get_notices():
    db = get_db()
    category = request.args.get("category", "").strip()

    sql = "SELECT * FROM notices WHERE 1=1"
    params = []
    if category and category != "all":
        sql += " AND category = ?"
        params.append(category)
    sql += " ORDER BY created_at DESC"

    rows = db.execute(sql, params).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/notices", methods=["POST"])
def add_notice():
    data = request.get_json(force=True)
    if not data.get("title"):
        return jsonify({"error": "'title' required aahe"}), 400

    db = get_db()
    cur = db.execute(
        """INSERT INTO notices (title, description, category, posted_by, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (
            data["title"],
            data.get("description", ""),
            data.get("category", "general"),
            data.get("posted_by", "Anonymous"),
            now_str(),
        ),
    )
    db.commit()
    new_row = db.execute("SELECT * FROM notices WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(row_to_dict(new_row)), 201


@app.route("/api/notices/<int:notice_id>", methods=["DELETE"])
def delete_notice(notice_id):
    db = get_db()
    db.execute("DELETE FROM notices WHERE id = ?", (notice_id,))
    db.commit()
    return jsonify({"message": "Delete zala"})


# ---------------------------------------------------------------------------
# SKILL EXCHANGE
# ---------------------------------------------------------------------------

@app.route("/api/skills", methods=["GET"])
def get_skills():
    db = get_db()
    q = request.args.get("q", "").strip()

    sql = "SELECT * FROM skills WHERE 1=1"
    params = []
    if q:
        sql += " AND (skill_offered LIKE ? OR skill_wanted LIKE ? OR name LIKE ?)"
        like = f"%{q}%"
        params += [like, like, like]
    sql += " ORDER BY created_at DESC"

    rows = db.execute(sql, params).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/skills", methods=["POST"])
def add_skill():
    data = request.get_json(force=True)
    required = ["name", "skill_offered", "contact"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"'{field}' ha field required aahe"}), 400

    db = get_db()
    cur = db.execute(
        """INSERT INTO skills (name, skill_offered, skill_wanted, description, contact, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            data["name"],
            data["skill_offered"],
            data.get("skill_wanted", ""),
            data.get("description", ""),
            data["contact"],
            now_str(),
        ),
    )
    db.commit()
    new_row = db.execute("SELECT * FROM skills WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(row_to_dict(new_row)), 201


@app.route("/api/skills/<int:skill_id>", methods=["DELETE"])
def delete_skill(skill_id):
    db = get_db()
    db.execute("DELETE FROM skills WHERE id = ?", (skill_id,))
    db.commit()
    return jsonify({"message": "Delete zala"})


# ---------------------------------------------------------------------------
# Stats (dashboard sathi)
# ---------------------------------------------------------------------------

@app.route("/api/stats", methods=["GET"])
def stats():
    db = get_db()
    lf_open = db.execute("SELECT COUNT(*) c FROM lost_found WHERE status='open'").fetchone()["c"]
    notices_count = db.execute("SELECT COUNT(*) c FROM notices").fetchone()["c"]
    skills_count = db.execute("SELECT COUNT(*) c FROM skills").fetchone()["c"]
    return jsonify({
        "open_lost_found": lf_open,
        "notices": notices_count,
        "skills": skills_count,
    })


if __name__ == "__main__":
    init_db()
    print("CampusConnect backend http://localhost:5000 var chalu aahe...")
    app.run(debug=True, port=5000)
