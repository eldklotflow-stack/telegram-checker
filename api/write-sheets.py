from http.server import BaseHTTPRequestHandler
import json
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime
import os

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))

        result = write_to_sheets(
            data.get('sheet_id'),
            data.get('sheet_name'),
            data.get('results', [])
        )

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        self.wfile.write(json.dumps(result).encode())

def write_to_sheets(sheet_id, sheet_name, results):
    try:
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]

        creds_json = os.environ.get('GOOGLE_CREDENTIALS')
        creds_dict = json.loads(creds_json)
        creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        client = gspread.authorize(creds)

        spreadsheet = client.open_by_key(sheet_id)

        try:
            worksheet = spreadsheet.worksheet(sheet_name)
        except:
            worksheet = spreadsheet.add_worksheet(title=sheet_name, rows=1000, cols=7)
            worksheet.append_row([
                'Номер', 'Username', 'Имя', 'Фамилия', 'ID',
                'Дата проверки', 'Проверил'
            ])

        for result in results:
            worksheet.append_row([
                result.get('phone', ''),
                result.get('username', ''),
                result.get('first_name', ''),
                result.get('last_name', ''),
                str(result.get('user_id', '')),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                result.get('checked_by', '')
            ])

        return {'success': True}

    except Exception as e:
        return {'success': False, 'error': str(e)}