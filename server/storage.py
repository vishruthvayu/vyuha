import json
import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("VYUHA_DB", Path(__file__).resolve().parent.parent / "data" / "vyuha.db"))


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=15)
    connection.row_factory = sqlite3.Row
    return connection


def init():
    with connect() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
            CREATE TABLE IF NOT EXISTS unit_preferences (unit_id TEXT PRIMARY KEY,pack_id TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS scenario_library (id TEXT PRIMARY KEY,created_at TEXT NOT NULL,body TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS rapid_sessions (id TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,trainee TEXT NOT NULL,
                body TEXT NOT NULL,rounds TEXT NOT NULL,created_at TEXT NOT NULL,result TEXT);
            CREATE TABLE IF NOT EXISTS rapid_answers (session_id TEXT NOT NULL,round_index INTEGER NOT NULL,body TEXT NOT NULL,result TEXT NOT NULL,
                PRIMARY KEY(session_id,round_index));
            CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY,name TEXT NOT NULL);
            INSERT OR IGNORE INTO units VALUES ('local','WhiteList Training Unit');
            CREATE TABLE IF NOT EXISTS trainees (id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,callsign TEXT NOT NULL,
                created_at TEXT NOT NULL,UNIQUE(unit_id,callsign COLLATE NOCASE));
            CREATE TABLE IF NOT EXISTS join_requests (id TEXT PRIMARY KEY,body TEXT NOT NULL,trainee TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS connected_clients (id TEXT PRIMARY KEY,trainee TEXT NOT NULL,last_seen TEXT NOT NULL,session_id TEXT);
            CREATE TABLE IF NOT EXISTS session_unit_stats (session_id TEXT PRIMARY KEY,failures TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS exercise_groups (id TEXT PRIMARY KEY,unit_id TEXT NOT NULL,request_id TEXT UNIQUE NOT NULL,
                body TEXT NOT NULL,scenario_id TEXT NOT NULL,created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS exercise_assignments (session_id TEXT PRIMARY KEY,group_id TEXT NOT NULL,trainee TEXT NOT NULL,
                accepted_at TEXT,UNIQUE(group_id,trainee));
            CREATE TABLE IF NOT EXISTS scenarios (id TEXT PRIMARY KEY, spec TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, trainee TEXT NOT NULL, scenario_id TEXT NOT NULL,
                created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', scorecard TEXT, end_tick INTEGER);
            CREATE TABLE IF NOT EXISTS skill_profiles (trainee TEXT NOT NULL, skill TEXT NOT NULL,
                alpha REAL NOT NULL, beta REAL NOT NULL, updated_at TEXT, last_session_id TEXT,
                PRIMARY KEY (trainee,skill));
            CREATE TABLE IF NOT EXISTS skill_outcomes (session_id TEXT PRIMARY KEY, trainee TEXT NOT NULL,
                outcomes TEXT NOT NULL, processed_at TEXT NOT NULL, version TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS director_history (session_id TEXT PRIMARY KEY, trainee TEXT NOT NULL,
                decision TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS chunks (session_id TEXT NOT NULL, seq INTEGER NOT NULL, payload TEXT NOT NULL,
                PRIMARY KEY (session_id, seq));
            CREATE TABLE IF NOT EXISTS instructor_commands (session_id TEXT NOT NULL, seq INTEGER NOT NULL,
                command_id TEXT NOT NULL, issued_at TEXT NOT NULL, body TEXT NOT NULL, tick INTEGER, timeline_order INTEGER,
                PRIMARY KEY (session_id, seq), UNIQUE (session_id, command_id));
        """)
        columns = {r["name"] for r in db.execute("PRAGMA table_info(sessions)")}
        for name, definition in [("unit_id", "TEXT NOT NULL DEFAULT 'local'"), ("exercise_group_id", "TEXT"), ("last_seen", "TEXT"), ("control_state", "TEXT"), ("execution_tick", "INTEGER"), ("completed_at", "TEXT")]:
            if name not in columns:
                db.execute(f"ALTER TABLE sessions ADD COLUMN {name} {definition}")

        db.execute("INSERT OR IGNORE INTO trainees(id,unit_id,callsign,created_at) SELECT DISTINCT trainee,'local',trainee,MIN(created_at) FROM sessions GROUP BY trainee")
        db.execute("CREATE INDEX IF NOT EXISTS sessions_unit_status ON sessions(unit_id,status)")
        db.execute("CREATE INDEX IF NOT EXISTS sessions_trainee ON sessions(trainee,created_at)")
        db.execute("CREATE INDEX IF NOT EXISTS presence_seen ON connected_clients(last_seen)")


def dumps(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True)
