from http.server import BaseHTTPRequestHandler
import json
from telethon import TelegramClient
from telethon.tl.functions.contacts import ImportContactsRequest, DeleteContactsRequest
from telethon.tl.types import InputPhoneContact
from telethon.errors import FloodWaitError, PhoneNumberInvalidError
import asyncio
import os


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))

        phone = data.get('phone')
        api_id = data.get('api_id')
        api_hash = data.get('api_hash')

        result = asyncio.run(check_phone(phone, api_id, api_hash))

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        self.wfile.write(json.dumps(result).encode())


async def check_phone(phone, api_id, api_hash):
    try:
        client = TelegramClient('session', int(api_id), api_hash)
        await client.start()

        contact = InputPhoneContact(
            client_id=0,
            phone=phone,
            first_name="Check",
            last_name=""
        )

        result = await client(ImportContactsRequest([contact]))

        if result.users:
            user = result.users[0]
            user_data = {
                'phone': phone,
                'username': user.username if user.username else 'Не указан',
                'first_name': user.first_name if user.first_name else '',
                'last_name': user.last_name if user.last_name else '',
                'user_id': user.id,
                'found': True
            }

            await client(DeleteContactsRequest(id=[user.id]))
            await client.disconnect()
            return user_data
        else:
            await client.disconnect()
            return {'phone': phone, 'found': False}

    except Exception as e:
        return {'phone': phone, 'found': False, 'error': str(e)}