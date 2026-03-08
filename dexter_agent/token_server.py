"""
Dev backend for the Dexter Expo app.

Provides:
  GET /token?room=ROOM&identity=IDENTITY  — LiveKit access token
  GET /api/songsterr/*                    — CORS proxy to Songsterr API
  GET /health                             — Health check

Run:  python token_server.py
"""

from __future__ import annotations

import os

import aiohttp as aiohttp_lib
from aiohttp import web
from dotenv import load_dotenv
from livekit.api import AccessToken, VideoGrants, LiveKitAPI, CreateAgentDispatchRequest

load_dotenv()

API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")
PORT = int(os.environ.get("TOKEN_SERVER_PORT", "8082"))
SONGSTERR_BASE = "https://www.songsterr.com/api"


# ── CORS middleware ──────────────────────────────────────

@web.middleware
async def cors_middleware(request: web.Request, handler):
    if request.method == "OPTIONS":
        resp = web.Response()
    else:
        resp = await handler(request)
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return resp


# ── Token endpoint ───────────────────────────────────────

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

    # Dispatch the agent to this room so it auto-joins
    try:
        lk_url = os.environ.get("LIVEKIT_URL", "")
        lk = LiveKitAPI(lk_url, API_KEY, API_SECRET)
        await lk.agent_dispatch.create_dispatch(
            CreateAgentDispatchRequest(room=room, agent_name="dexter-coach")
        )
        await lk.aclose()
    except Exception as e:
        print(f"Agent dispatch warning: {e}")

    return web.json_response({"token": jwt, "url": os.environ.get("LIVEKIT_URL", "")})


# ── Songsterr proxy ─────────────────────────────────────

async def handle_songsterr_proxy(request: web.Request) -> web.Response:
    """Proxies requests to Songsterr API to avoid CORS issues on web."""
    path = request.match_info.get("path", "")
    query_string = request.query_string
    url = f"{SONGSTERR_BASE}/{path}"
    if query_string:
        url += f"?{query_string}"

    async with aiohttp_lib.ClientSession() as session:
        try:
            async with session.get(url) as resp:
                body = await resp.read()
                return web.Response(
                    body=body,
                    status=resp.status,
                    content_type=resp.content_type,
                )
        except Exception as e:
            return web.json_response({"error": str(e)}, status=502)


# ── Health ───────────────────────────────────────────────

async def handle_health(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok"})


# ── App setup ────────────────────────────────────────────

app = web.Application(middlewares=[cors_middleware])
app.router.add_get("/token", handle_token)
app.router.add_get("/api/songsterr/{path:.*}", handle_songsterr_proxy)
app.router.add_get("/health", handle_health)

if __name__ == "__main__":
    print(f"Dexter dev server on http://localhost:{PORT}")
    print(f"  GET /token?room=ROOM&identity=IDENTITY")
    print(f"  GET /api/songsterr/songs?pattern=QUERY")
    print(f"  GET /health")
    web.run_app(app, port=PORT)
