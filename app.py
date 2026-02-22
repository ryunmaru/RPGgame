import json
import os
import sqlite3
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "rpg.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    DATA_DIR.mkdir(exist_ok=True)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS monsters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            max_hp INTEGER NOT NULL,
            attack INTEGER NOT NULL,
            defense INTEGER NOT NULL,
            speed INTEGER NOT NULL,
            sprite TEXT NOT NULL,
            is_enemy_default INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS moves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            power INTEGER NOT NULL,
            accuracy INTEGER NOT NULL,
            description TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS monster_moves (
            monster_id INTEGER NOT NULL,
            move_id INTEGER NOT NULL,
            PRIMARY KEY (monster_id, move_id),
            FOREIGN KEY(monster_id) REFERENCES monsters(id),
            FOREIGN KEY(move_id) REFERENCES moves(id)
        )
        """
    )
    cur.execute("SELECT COUNT(*) FROM monsters")
    if cur.fetchone()[0] == 0:
        seed_db(conn)
    conn.commit()
    conn.close()


def seed_db(conn):
    moves = [
        ("たいあたり", 24, 95, "勢いよくぶつかる"),
        ("ほのおのいき", 30, 85, "熱い息で焼きつくす"),
        ("いやしのひかり", -20, 100, "光で体力を回復する"),
        ("でんげき", 28, 90, "電撃で相手をしびれさせる"),
    ]
    monsters = [
        ("ミドリネコ", 110, 26, 16, 20, "🐱", 0),
        ("マグマガメ", 130, 30, 22, 11, "🐢", 1),
        ("カゼギツネ", 100, 32, 13, 24, "🦊", 1),
    ]
    conn.executemany(
        "INSERT INTO moves (name, power, accuracy, description) VALUES (?, ?, ?, ?)", moves
    )
    conn.executemany(
        """
        INSERT INTO monsters (name, max_hp, attack, defense, speed, sprite, is_enemy_default)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        monsters,
    )

    move_ids = {r["name"]: r["id"] for r in conn.execute("SELECT id,name FROM moves")}
    monster_ids = {r["name"]: r["id"] for r in conn.execute("SELECT id,name FROM monsters")}
    relations = [
        (monster_ids["ミドリネコ"], move_ids["たいあたり"]),
        (monster_ids["ミドリネコ"], move_ids["いやしのひかり"]),
        (monster_ids["マグマガメ"], move_ids["ほのおのいき"]),
        (monster_ids["マグマガメ"], move_ids["たいあたり"]),
        (monster_ids["カゼギツネ"], move_ids["でんげき"]),
        (monster_ids["カゼギツネ"], move_ids["たいあたり"]),
    ]
    conn.executemany(
        "INSERT INTO monster_moves (monster_id, move_id) VALUES (?, ?)", relations
    )


def get_config():
    conn = get_conn()
    monsters = [dict(row) for row in conn.execute("SELECT * FROM monsters ORDER BY id")]
    moves = {row["id"]: dict(row) for row in conn.execute("SELECT * FROM moves ORDER BY id")}
    relations = [dict(r) for r in conn.execute("SELECT * FROM monster_moves")]
    conn.close()

    for monster in monsters:
        monster["moves"] = [
            moves[r["move_id"]] for r in relations if r["monster_id"] == monster["id"] and r["move_id"] in moves
        ]
    return {"monsters": monsters}


class Handler(BaseHTTPRequestHandler):
    def _json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/config":
            return self._json(get_config())
        return self._serve_static(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(length) or b"{}")

        if parsed.path == "/api/moves":
            return self._create_move(payload)
        if parsed.path == "/api/monsters":
            return self._create_monster(payload)
        return self._json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)

    def _create_move(self, payload):
        required = ["name", "power", "accuracy", "description"]
        if any(k not in payload or payload[k] in (None, "") for k in required):
            return self._json({"error": "入力値が不正です。"}, status=HTTPStatus.BAD_REQUEST)
        try:
            conn = get_conn()
            cur = conn.execute(
                "INSERT INTO moves (name, power, accuracy, description) VALUES (?, ?, ?, ?)",
                (payload["name"], int(payload["power"]), int(payload["accuracy"]), payload["description"]),
            )
            conn.commit()
            new_id = cur.lastrowid
            conn.close()
            return self._json({"id": new_id}, status=HTTPStatus.CREATED)
        except Exception as exc:
            return self._json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def _create_monster(self, payload):
        required = ["name", "max_hp", "attack", "defense", "speed", "sprite", "move_ids"]
        if any(k not in payload or payload[k] in (None, "") for k in required) or not payload["move_ids"]:
            return self._json({"error": "モンスター情報が不足しています。"}, status=HTTPStatus.BAD_REQUEST)
        try:
            conn = get_conn()
            cur = conn.execute(
                """
                INSERT INTO monsters (name, max_hp, attack, defense, speed, sprite, is_enemy_default)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["name"],
                    int(payload["max_hp"]),
                    int(payload["attack"]),
                    int(payload["defense"]),
                    int(payload["speed"]),
                    payload["sprite"],
                    1 if payload.get("is_enemy_default") else 0,
                ),
            )
            monster_id = cur.lastrowid
            for move_id in payload["move_ids"]:
                conn.execute(
                    "INSERT INTO monster_moves (monster_id, move_id) VALUES (?, ?)",
                    (monster_id, int(move_id)),
                )
            conn.commit()
            conn.close()
            return self._json({"id": monster_id}, status=HTTPStatus.CREATED)
        except Exception as exc:
            return self._json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def _serve_static(self, req_path):
        if req_path in ("/", ""):
            req_path = "/index.html"
        file_path = (PUBLIC_DIR / req_path.lstrip("/")).resolve()
        if not str(file_path).startswith(str(PUBLIC_DIR)) or not file_path.exists() or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        mime = "text/plain"
        if file_path.suffix == ".html":
            mime = "text/html; charset=utf-8"
        elif file_path.suffix == ".css":
            mime = "text/css; charset=utf-8"
        elif file_path.suffix == ".js":
            mime = "application/javascript; charset=utf-8"

        data = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def run_server(port=3000):
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", int(port)), Handler)
    print(f"Server running on http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run_server(port=int(os.environ.get("PORT", "3000")))
