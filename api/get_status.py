from http.server import BaseHTTPRequestHandler
import json
from vercel_kv import kv
from datetime import datetime


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        today = datetime.now().strftime('%Y-%m-%d')

        # Получаем статус блокировки
        lock_data = kv.get('system_lock')

        # Получаем дневное использование
        daily_used = kv.get(f'daily_limit_{today}')
        daily_used = int(daily_used) if daily_used else 0

        status = {
            'locked': bool(lock_data),
            'lockedBy': lock_data.decode() if lock_data else None,
            'dailyUsed': daily_used
        }

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        self.wfile.write(json.dumps(status).encode())