"""
Mock student client — joins the LiveKit room, dispatches the agent,
sends bar context, and prints any feedback received.

Run: python test_client.py
"""

import asyncio
import json
import os

from dotenv import load_dotenv
from livekit import api, rtc

load_dotenv()

LIVEKIT_URL = os.environ["LIVEKIT_URL"]
API_KEY = os.environ["LIVEKIT_API_KEY"]
API_SECRET = os.environ["LIVEKIT_API_SECRET"]
ROOM_NAME = "dexter-test"
IDENTITY = "mock-student"


async def main():
    # Generate a token
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
        try:
            msg = json.loads(packet.data.decode())
            print(f"\n>>> Agent feedback: {json.dumps(msg, indent=2)}")
        except Exception:
            print(f"\n>>> Raw data: {packet.data[:200]}")

    @room.on("participant_connected")
    def on_participant(p: rtc.RemoteParticipant):
        print(f"Agent joined: {p.identity}")
        agent_joined.set()

    @room.on("track_subscribed")
    def on_track(track, publication, participant):
        print(f"Track subscribed: {track.kind} from {participant.identity}")

    print(f"Connecting to {LIVEKIT_URL} as '{IDENTITY}' in room '{ROOM_NAME}'...")
    await room.connect(LIVEKIT_URL, token)
    print(f"Connected! Room: {room.name}")

    # Dispatch the agent to this room
    print("Requesting agent dispatch...")
    lk = api.LiveKitAPI(LIVEKIT_URL, API_KEY, API_SECRET)
    await lk.agent_dispatch.create_dispatch(
        api.CreateAgentDispatchRequest(
            room=ROOM_NAME,
            agent_name="dexter-coach",
        )
    )
    await lk.aclose()
    print("Dispatch requested. Waiting for agent to join...")

    try:
        await asyncio.wait_for(agent_joined.wait(), timeout=15)
    except asyncio.TimeoutError:
        print("Agent didn't join after 15s. Check agent logs.")
        await room.disconnect()
        return

    # Give agent a moment to initialize
    await asyncio.sleep(3)

    # Send bar context updates to trigger coaching
    bar_contexts = [
        "Bar 1-4: Em - G - D - A | Wonderwall by Oasis | Strumming pattern: DDUUDU",
        "Bar 5-8: Em - G - D - A | Second verse | Focus on chord transitions",
        "Bar 9-12: C - D - Em | Chorus section | Increase tempo slightly",
    ]

    for i, ctx in enumerate(bar_contexts):
        msg = json.dumps({"type": "barContext", "data": ctx}).encode()
        await room.local_participant.publish_data(msg, reliable=True)
        print(f"\nSent bar context {i+1}: {ctx[:60]}...")
        await asyncio.sleep(10)  # Give agent time to respond

    print("\nWaiting for remaining responses...")
    await asyncio.sleep(10)

    print("\nDone! Disconnecting.")
    await room.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
