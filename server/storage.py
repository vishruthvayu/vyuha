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
        for name, definition in [("last_seen", "TEXT"), ("control_state", "TEXT"), ("execution_tick", "INTEGER")]:
            if name not in columns:
                db.execute(f"ALTER TABLE sessions ADD COLUMN {name} {definition}")


def dumps(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True)
