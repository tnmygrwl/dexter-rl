"""
Dexter RL Demo — Smoke on the Water

Simulates a student practicing "Smoke on the Water" by Deep Purple.
Connects to LiveKit, dispatches the Dexter coaching agent, and sends
bar-by-bar context. The agent coaches in real-time and RL trajectories
are captured automatically.

This is the demo script for the YC x DeepMind hackathon.

Run:  python demo_smoke_on_water.py
"""

import asyncio
import json
import os
import time

from dotenv import load_dotenv
from livekit import api, rtc

load_dotenv()

LIVEKIT_URL = os.environ["LIVEKIT_URL"]
API_KEY = os.environ["LIVEKIT_API_KEY"]
API_SECRET = os.environ["LIVEKIT_API_SECRET"]
ROOM_NAME = f"dexter-demo-{int(time.time())}"
IDENTITY = "demo-student"

# Smoke on the Water — bar-by-bar practice plan
SONG = {
    "title": "Smoke on the Water",
    "artist": "Deep Purple",
    "tuning": "Standard E",
    "tempo": 112,
}

BAR_CONTEXTS = [
    {
        "bar": "1-4",
        "chords": "G5 - Bb5 - C5",
        "section": "Main Riff (Intro)",
        "focus": "The iconic riff: 0-3-5, 0-3-6-5, 0-3-5-3-0. Use downstrokes on power chords.",
        "delay": 12,
    },
    {
        "bar": "5-8",
        "chords": "G5 - Bb5 - C5 - Bb5",
        "section": "Main Riff (Repeat)",
        "focus": "Same riff, focus on consistent timing. Keep palm muting tight between notes.",
        "delay": 12,
    },
    {
        "bar": "9-12",
        "chords": "G5 - Bb5 - Db5 - C5",
        "section": "Verse Riff Variation",
        "focus": "Slight variation with Db5 power chord. Watch the stretch on fret 4 to fret 6.",
        "delay": 12,
    },
    {
        "bar": "13-16",
        "chords": "G5 - F5 - G5",
        "section": "Verse Progression",
        "focus": "Simpler progression. Focus on clean power chord transitions G5 to F5.",
        "delay": 12,
    },
    {
        "bar": "17-20",
        "chords": "G5 - F5 - Bb5 - C5",
        "section": "Pre-Chorus Build",
        "focus": "Building energy. Increase picking intensity, keep rhythm locked.",
        "delay": 12,
    },
    {
        "bar": "21-24",
        "chords": "C5 - Ab5 - Bb5",
        "section": "Chorus",
        "focus": "Full power chords, let them ring. Strong downstrokes on each beat.",
        "delay": 15,
    },
    {
        "bar": "25-28",
        "chords": "G5 - Bb5 - C5",
        "section": "Main Riff (Return)",
        "focus": "Back to the main riff. Apply corrections from earlier — cleaner transitions.",
        "delay": 12,
    },
    {
        "bar": "29-32",
        "chords": "G5 - Bb5 - Db5 - C5",
        "section": "Verse 2 Riff",
        "focus": "Second verse. Show improvement on the Db5 stretch. Steady tempo.",
        "delay": 12,
    },
]

feedback_count = 0
feedback_log = []


def print_banner():
    print()
    print("=" * 64)
    print("  DEXTER RL — Smoke on the Water Demo")
    print("  Deep Purple | Student practicing beginner guitar riff")
    print("  Agent coaches in real-time, RL trajectories captured")
    print("=" * 64)
    print()
    print(f"  Song:   {SONG['title']} by {SONG['artist']}")
    print(f"  Tempo:  {SONG['tempo']} BPM")
    print(f"  Tuning: {SONG['tuning']}")
    print(f"  Bars:   {len(BAR_CONTEXTS)} sections")
    print()


async def main():
    global feedback_count

    print_banner()

    # Generate token
    token = (
        api.AccessToken(API_KEY, API_SECRET)
        .with_identity(IDENTITY)
        .with_grants(api.VideoGrants(room_join=True, room=ROOM_NAME))
        .to_jwt()
    )

    room = rtc.Room()
    agent_joined = asyncio.Event()

    @room.on("data_received")
    def on_data(packet: rtc.DataPacket):
        global feedback_count
        try:
            msg = json.loads(packet.data.decode())
            if msg.get("type") == "feedback":
                feedback_count += 1
                fb = msg["data"]
                feedback_log.append(fb)

                pitch = fb.get("pitchAccuracy", 0)
                timing = fb.get("timing", 0)
                fingers = fb.get("fingerPosition", 0)
                tip = fb.get("feedback", "")[:80]

                avg = (pitch + timing + fingers) / 3
                bar_vis = "#" * int(avg * 40) + "." * (40 - int(avg * 40))

                print(f"\n  {'='*56}")
                print(f"  Feedback #{feedback_count}")
                print(f"  Pitch: {pitch:.2f}  Timing: {timing:.2f}  Fingers: {fingers:.2f}")
                print(f"  [{bar_vis}] {avg:.0%}")
                print(f"  Tip: \"{tip}\"")
                print(f"  {'='*56}")
        except Exception as e:
            print(f"\n  [raw data: {packet.data[:100]}]")

    @room.on("participant_connected")
    def on_participant(p: rtc.RemoteParticipant):
        print(f"  Agent joined: {p.identity}")
        agent_joined.set()

    @room.on("track_subscribed")
    def on_track(track, publication, participant):
        print(f"  Track: {track.kind} from {participant.identity}")

    # Connect
    print(f"  Connecting to LiveKit...")
    await room.connect(LIVEKIT_URL, token)
    print(f"  Connected to room: {room.name}")

    # Dispatch agent
    print("  Dispatching Dexter coaching agent...")
    lk = api.LiveKitAPI(LIVEKIT_URL, API_KEY, API_SECRET)
    await lk.agent_dispatch.create_dispatch(
        api.CreateAgentDispatchRequest(
            room=ROOM_NAME,
            agent_name="dexter-coach",
        )
    )
    await lk.aclose()

    try:
        await asyncio.wait_for(agent_joined.wait(), timeout=15)
    except asyncio.TimeoutError:
        print("  Agent didn't join after 15s. Is the agent running?")
        print("  Start it with: cd dexter_agent && .venv/bin/python agent.py dev")
        await room.disconnect()
        return

    # Wait for agent greeting
    print("\n  Waiting for Dexter to greet the student...")
    await asyncio.sleep(5)

    # Practice session
    start = time.time()
    print("\n" + "-" * 64)
    print("  PRACTICE SESSION START")
    print("-" * 64)

    for i, bar in enumerate(BAR_CONTEXTS):
        ctx_text = (
            f"Bar {bar['bar']}: {bar['chords']} | "
            f"{SONG['title']} by {SONG['artist']} | "
            f"{bar['section']} | {bar['focus']}"
        )
        msg = json.dumps({"type": "barContext", "data": ctx_text}).encode()
        await room.local_participant.publish_data(msg, reliable=True)

        print(f"\n  >>> Section {i+1}/{len(BAR_CONTEXTS)}: {bar['section']}")
        print(f"      Bars {bar['bar']} | {bar['chords']}")
        print(f"      Focus: {bar['focus'][:70]}")
        print(f"      Waiting {bar['delay']}s for coaching...")

        await asyncio.sleep(bar["delay"])

    # Wait for final responses
    print("\n  Waiting for final coaching feedback...")
    await asyncio.sleep(8)

    duration = time.time() - start

    # Summary
    print("\n" + "=" * 64)
    print("  SESSION COMPLETE")
    print("=" * 64)
    print(f"  Duration:         {duration:.0f}s")
    print(f"  Bars practiced:   {len(BAR_CONTEXTS)} sections")
    print(f"  Feedback received: {feedback_count} coaching tips")

    if feedback_log:
        avg_pitch = sum(f.get("pitchAccuracy", 0) for f in feedback_log) / len(feedback_log)
        avg_timing = sum(f.get("timing", 0) for f in feedback_log) / len(feedback_log)
        avg_fingers = sum(f.get("fingerPosition", 0) for f in feedback_log) / len(feedback_log)

        first_avg = sum(feedback_log[0].get(k, 0) for k in ["pitchAccuracy", "timing", "fingerPosition"]) / 3
        last_avg = sum(feedback_log[-1].get(k, 0) for k in ["pitchAccuracy", "timing", "fingerPosition"]) / 3

        print(f"\n  Average Scores:")
        print(f"    Pitch Accuracy:  {avg_pitch:.2f}")
        print(f"    Timing:          {avg_timing:.2f}")
        print(f"    Finger Position: {avg_fingers:.2f}")
        print(f"\n  Progress: {first_avg:.0%} -> {last_avg:.0%}")

    print(f"\n  RL trajectory saved to: trajectories/latest.jsonl")
    print("=" * 64)
    print()

    await room.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
