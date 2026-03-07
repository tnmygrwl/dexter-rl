"""
Minimal HTTP server for generating LiveKit access tokens.

Run:  python token_server.py
Endpoint:  GET http://localhost:8081/token?room=ROOM&identity=IDENTITY

The Expo app calls this to get a token before connecting to a room.
"""

from __future__ import annotations

import os

from aiohttp import web
from dotenv import load_dotenv
from livekit.api import AccessToken, VideoGrants

load_dotenv()

API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")
PORT = int(os.environ.get("TOKEN_SERVER_PORT", "8081"))


async def handle_token(request: web.Request) -> web.Response:
    room = request.query.get("room", "dexter-practice")
    identity = request.query.get("identity", "student")

    if not API_KEY or not API_SECRET:
        return web.json_response(
            {"error": "LIVEKIT_API_KEY / LIVEKIT_API_SECRET not set"},
            status=500,
        )

    token = (
        AccessToken(API_KEY, API_SECRET)
        .with_identity(identity)
        .with_grants(VideoGrants(room_join=True, room=room))
    )

    jwt = token.to_jwt()
    return web.json_response({"token": jwt, "url": os.environ.get("LIVEKIT_URL", "")})


async def handle_health(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok"})


app = web.Application()
app.router.add_get("/token", handle_token)
app.router.add_get("/health", handle_health)

if __name__ == "__main__":
    print(f"Token server starting on http://localhost:{PORT}")
    print(f"  GET /token?room=ROOM&identity=IDENTITY")
    web.run_app(app, port=PORT)
