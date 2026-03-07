"""
Dexter Guitar Coach — LiveKit Agent

Joins a LiveKit room, receives camera + audio from the student,
forwards to Gemini multimodal live API, and sends coaching feedback
back to the client via data channel.

Also captures every {coaching_tip, metrics} pair as an RL trajectory
step, computing rewards via dexter_rl. This is the unified pipeline:
Gemini coaches, the agent observes, RL env logs training data.

Run:  python agent.py dev
"""

from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path

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

# Add project root to path so we can import dexter_rl
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logger = logging.getLogger("dexter-agent")
logger.setLevel(logging.INFO)


# ---------------------------------------------------------------------------
# RL Trajectory Logger — captures coaching interactions as training data
# ---------------------------------------------------------------------------

class TrajectoryLogger:
    """Accumulates RL trajectory steps from live coaching sessions.

    Each step records:
      - bar_context: what the student was practicing
      - coaching_tip: what Gemini said
      - metrics: {pitchAccuracy, timing, fingerPosition}
      - composite_score: weighted average (0-10 scale)
      - reward: score improvement from previous step
    """

    WEIGHTS = {"pitchAccuracy": 0.4, "timing": 0.35, "fingerPosition": 0.25}

    def __init__(self):
        self.steps: list[dict] = []
        self.scores: list[float] = []
        self.current_bar: str = ""
        self.session_start = time.time()

    def set_bar_context(self, context: str):
        self.current_bar = context

    def log_feedback(self, feedback: dict):
        """Log a coaching feedback as a trajectory step."""
        composite = sum(
            feedback.get(k, 0) * w for k, w in self.WEIGHTS.items()
        ) * 10  # scale to 0-10

        self.scores.append(composite)
        prev = self.scores[-2] if len(self.scores) > 1 else 0
        reward = (composite - prev) / 10.0

        step = {
            "step": len(self.steps) + 1,
            "timestamp": time.time() - self.session_start,
            "bar_context": self.current_bar,
            "coaching_tip": feedback.get("feedback", ""),
            "metrics": {
                "pitchAccuracy": feedback.get("pitchAccuracy", 0),
                "timing": feedback.get("timing", 0),
                "fingerPosition": feedback.get("fingerPosition", 0),
            },
            "detected_chord": feedback.get("detectedChord"),
            "expected_chord": feedback.get("expectedChord"),
            "composite_score": round(composite, 2),
            "reward": round(reward, 3),
        }
        self.steps.append(step)

        # Live terminal output for the demo
        bar = "#" * int(composite * 4) + "." * (40 - int(composite * 4))
        delta = f"+{reward:.2f}" if reward >= 0 else f"{reward:.2f}"
        logger.info(
            f"  RL | Step {step['step']:3d} [{bar}] "
            f"{composite:.1f}/10 (reward: {delta})  "
            f'tip: "{step["coaching_tip"][:60]}"'
        )
        return step

    def get_trajectory(self) -> dict:
        """Return the full trajectory for this session."""
        return {
            "steps": self.steps,
            "scores": self.scores,
            "total_reward": sum(s["reward"] for s in self.steps),
            "final_score": self.scores[-1] if self.scores else 0,
            "num_steps": len(self.steps),
            "duration_s": round(time.time() - self.session_start, 1),
        }

    def save(self, path: str = "trajectories/latest.jsonl"):
        """Append trajectory to a JSONL file."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "a") as f:
            f.write(json.dumps(self.get_trajectory()) + "\n")
        logger.info(f"  RL | Trajectory saved to {path} ({len(self.steps)} steps)")

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

    # RL trajectory logger
    trajectory = TrajectoryLogger()

    logger.info("")
    logger.info("=" * 60)
    logger.info("  DEXTER RL — Live Trajectory Capture")
    logger.info("  Coaching interactions → RL training data")
    logger.info("=" * 60)
    logger.info("")

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
                trajectory.set_bar_context(bar_text)
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
    # AND log to RL trajectory
    @session.on("agent_speech_committed")
    def on_speech(text: str):
        feedback = try_parse_feedback(text)
        if feedback:
            # Send to Expo app
            payload = json.dumps({"type": "feedback", "data": feedback}).encode()
            try:
                ctx.room.local_participant.publish_data(payload, reliable=True)
            except Exception as e:
                logger.warning(f"Failed to publish feedback: {e}")

            # Log to RL trajectory
            trajectory.log_feedback(feedback)

    # Save trajectory when participant leaves
    @ctx.room.on("participant_disconnected")
    def on_disconnect(p: rtc.RemoteParticipant):
        if trajectory.steps:
            traj = trajectory.get_trajectory()
            logger.info("")
            logger.info("=" * 60)
            logger.info("  SESSION COMPLETE — RL Trajectory Summary")
            logger.info(f"  Steps: {traj['num_steps']}")
            logger.info(f"  Score: {traj['scores'][0]:.1f} → {traj['final_score']:.1f}")
            logger.info(f"  Total reward: {traj['total_reward']:.3f}")
            logger.info(f"  Duration: {traj['duration_s']}s")
            logger.info("=" * 60)
            logger.info("")
            trajectory.save()


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
