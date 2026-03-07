"""
Dexter Guitar Coach — LiveKit Agent

Joins a LiveKit room, receives camera + audio from the student,
forwards to Gemini multimodal live API, and sends coaching feedback
back to the client via data channel.

Run:  python agent.py dev
"""

from __future__ import annotations

import json
import logging

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.agents.multimodal import MultimodalAgent
from livekit.plugins.google import beta as google_beta

load_dotenv()

logger = logging.getLogger("dexter-agent")
logger.setLevel(logging.INFO)

SYSTEM_PROMPT = """You are an expert guitar instructor named Dexter analyzing a student's
playing in real-time via their camera and microphone.

You will see video frames of their hands on the guitar and hear their playing.
The student will send you context about which bar, section, and chords they are practicing.

For EVERY observation, respond with a JSON object matching this schema:

{
  "pitchAccuracy": <number 0-1>,
  "timing": <number 0-1>,
  "fingerPosition": <number 0-1>,
  "detectedChord": "<string or null>",
  "expectedChord": "<string or null>",
  "feedback": "<brief coaching tip, 1-2 sentences>"
}

Scoring: 0.9-1.0 excellent, 0.7-0.89 good, 0.5-0.69 needs work, <0.5 significant problems.
Be specific: mention which finger, string, fret. Be encouraging but honest.
Also respond conversationally with voice to coach the student."""


async def entrypoint(ctx: JobContext):
    logger.info("Agent entrypoint — waiting for participant")
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)

    participant = await ctx.wait_for_participant()
    logger.info(f"Participant joined: {participant.identity}")

    model = google_beta.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-preview-12-2025",
        voice="Puck",
        system_instructions=SYSTEM_PROMPT,
        temperature=0.4,
    )

    agent = MultimodalAgent(model=model)
    session = await agent.start(ctx.room, participant)

    # Listen for data messages from the client (bar context updates)
    @ctx.room.on("data_received")
    def on_data(data: rtc.DataPacket):
        try:
            msg = json.loads(data.data.decode())
            if msg.get("type") == "barContext":
                bar_text = msg.get("data", "")
                logger.info(f"Bar context update: {bar_text[:100]}")
                session.conversation.item.create(
                    llm=model,
                    message=rtc.ChatMessage(
                        role="user",
                        content=f"[BAR UPDATE] {bar_text}",
                    ),
                )
                session.conversation.item.create(
                    llm=model,
                    message=rtc.ChatMessage(role="user", content="Please analyze what you see and hear now."),
                )
        except Exception as e:
            logger.warning(f"Data message parse error: {e}")

    # Forward Gemini text responses as structured data to the client
    @session.on("agent_speech_committed")
    def on_speech(text: str):
        feedback = try_parse_feedback(text)
        if feedback:
            payload = json.dumps({"type": "feedback", "data": feedback}).encode()
            try:
                ctx.room.local_participant.publish_data(payload, reliable=True)
                logger.info(f"Feedback sent: pitch={feedback.get('pitchAccuracy', '?')}")
            except Exception as e:
                logger.warning(f"Failed to publish feedback: {e}")


def try_parse_feedback(text: str) -> dict | None:
    """Try to extract a JSON feedback object from Gemini's response text."""
    import re

    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        obj = json.loads(match.group())
        required = ["pitchAccuracy", "timing", "fingerPosition"]
        if all(k in obj for k in required):
            return obj
    except json.JSONDecodeError:
        pass
    return None


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
