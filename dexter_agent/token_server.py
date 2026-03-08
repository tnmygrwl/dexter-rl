"""
Dev backend for the Dexter Expo app.

Provides:
  GET  /token?room=ROOM&identity=IDENTITY — LiveKit access token
  GET  /api/songsterr/*                   — CORS proxy to Songsterr API
  POST /rl/step                           — Log RL trajectory step
  POST /rl/end                            — End session, save trajectory
  GET  /health                            — Health check

Run:  python token_server.py
"""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path

import aiohttp as aiohttp_lib
from aiohttp import web
from dotenv import load_dotenv
from livekit.api import AccessToken, VideoGrants, LiveKitAPI, CreateAgentDispatchRequest

load_dotenv()

API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")
PORT = int(os.environ.get("TOKEN_SERVER_PORT", "8082"))
SONGSTERR_BASE = "https://www.songsterr.com/api"

logger = logging.getLogger("dexter-rl")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("%(message)s"))
logger.addHandler(handler)


# ── RL Trajectory Logger ─────────────────────────────────
WEIGHTS = {"pitchAccuracy": 0.4, "timing": 0.35, "fingerPosition": 0.25}

rl_session = {
    "steps": [],
    "scores": [],
    "start_time": 0.0,
    "song": "",
}


def rl_reset(song: str = ""):
    rl_session["steps"] = []
    rl_session["scores"] = []
    rl_session["start_time"] = time.time()
    rl_session["song"] = song


def rl_log_step(data: dict) -> dict:
    metrics = data.get("metrics", {})
    composite = sum(metrics.get(k, 0) * w for k, w in WEIGHTS.items()) * 10

    scores = rl_session["scores"]
    scores.append(composite)
    prev = scores[-2] if len(scores) > 1 else 0
    reward = (composite - prev) / 10.0

    step = {
        "step": len(rl_session["steps"]) + 1,
        "timestamp": time.time() - rl_session["start_time"],
        "bar_context": data.get("barContext", ""),
        "coaching_tip": data.get("coachingTip", ""),
        "metrics": metrics,
        "composite_score": round(composite, 2),
        "reward": round(reward, 3),
    }
    rl_session["steps"].append(step)

    # Terminal visualization
    bar = "#" * int(composite * 4) + "." * (40 - int(composite * 4))
    delta = f"+{reward:.2f}" if reward >= 0 else f"{reward:.2f}"
    logger.info(
        f"  RL | Step {step['step']:3d} [{bar}] "
        f"{composite:.1f}/10 (reward: {delta})  "
        f'tip: "{step["coaching_tip"][:60]}"'
    )
    return step


def rl_save():
    if not rl_session["steps"]:
        return
    scores = rl_session["scores"]
    trajectory = {
        "song": rl_session["song"],
        "steps": rl_session["steps"],
        "scores": scores,
        "total_reward": sum(s["reward"] for s in rl_session["steps"]),
        "final_score": scores[-1] if scores else 0,
        "num_steps": len(rl_session["steps"]),
        "duration_s": round(time.time() - rl_session["start_time"], 1),
    }
    path = Path("trajectories/latest.jsonl")
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a") as f:
        f.write(json.dumps(trajectory) + "\n")

    logger.info("")
    logger.info("=" * 60)
    logger.info("  SESSION COMPLETE — RL Trajectory Summary")
    logger.info(f"  Song:   {trajectory['song']}")
    logger.info(f"  Steps:  {trajectory['num_steps']}")
    if len(scores) > 0:
        logger.info(f"  Score:  {scores[0]:.1f} -> {scores[-1]:.1f}")
    logger.info(f"  Reward: {trajectory['total_reward']:.3f}")
    logger.info(f"  Duration: {trajectory['duration_s']}s")
    logger.info(f"  Saved to: {path}")
    logger.info("=" * 60)
    logger.info("")


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


# ── RL endpoints ─────────────────────────────────────────

async def handle_rl_step(request: web.Request) -> web.Response:
    """Log an RL trajectory step from the Expo app."""
    data = await request.json()

    # Auto-start session on first step
    if not rl_session["steps"]:
        song = data.get("song", "Unknown")
        rl_reset(song)
        logger.info("")
        logger.info("=" * 60)
        logger.info("  DEXTER RL — Live Trajectory Capture")
        logger.info(f"  Song: {song}")
        logger.info("=" * 60)
        logger.info("")

    step = rl_log_step(data)
    return web.json_response({"ok": True, "step": step["step"], "score": step["composite_score"]})


async def handle_rl_end(request: web.Request) -> web.Response:
    """End the RL session and save the trajectory."""
    rl_save()
    steps = len(rl_session["steps"])
    rl_reset()
    return web.json_response({"ok": True, "steps_saved": steps})


# ── Health ───────────────────────────────────────────────

async def handle_health(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok"})


# ── App setup ────────────────────────────────────────────

app = web.Application(middlewares=[cors_middleware])
app.router.add_get("/token", handle_token)
app.router.add_get("/api/songsterr/{path:.*}", handle_songsterr_proxy)
app.router.add_post("/rl/step", handle_rl_step)
app.router.add_post("/rl/end", handle_rl_end)
app.router.add_get("/health", handle_health)

if __name__ == "__main__":
    print(f"Dexter dev server on http://localhost:{PORT}")
    print(f"  GET  /token?room=ROOM&identity=IDENTITY")
    print(f"  POST /rl/step  — log coaching interaction as RL step")
    print(f"  POST /rl/end   — save trajectory")
    print(f"  GET  /health")
    web.run_app(app, port=PORT)
