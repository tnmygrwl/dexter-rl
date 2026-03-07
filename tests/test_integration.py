"""Integration test: simulates a full 2-turn coaching episode with all external
services mocked (Gemini evaluator, Browserbase tab scraper, WebSocket bridge).
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

import verifiers as vf

from dexter_rl.env import MusicCoachEnv
from dexter_rl.rewards import improvement_reward


def _make_env():
    """Create a MusicCoachEnv with the GeminiEvaluator constructor mocked out."""
    with patch("dexter_rl.env.GeminiEvaluator"):
        env = MusicCoachEnv(
            dataset=None,
            eval_dataset=MagicMock(),
            rubric=vf.Rubric(funcs=[improvement_reward], weights=[1.0]),
            max_turns=5,
        )
    return env


@pytest.mark.asyncio
async def test_full_two_turn_episode():
    """Simulate a complete 2-turn episode and verify score tracking + delta."""

    env = _make_env()

    # -- State that would come from the dataset row -------------------------
    state = {
        "prompt": [
            {"role": "system", "content": "placeholder"},
            {"role": "user", "content": "Begin coaching."},
        ],
        "task": "Wonderwall",
        "info": {"song": "Wonderwall", "artist": "Oasis", "instrument": "guitar"},
    }

    # -- Step 1: setup_state ------------------------------------------------
    with (
        patch.object(env, "tab_scraper") as mock_scraper,
        patch.object(env, "bridge") as mock_bridge,
    ):
        mock_scraper.scrape = AsyncMock(return_value="Em G D A7sus4")
        mock_bridge.start = AsyncMock()
        mock_bridge.wait_for_client = AsyncMock()
        mock_bridge.send_tabs = AsyncMock()

        state = await env.setup_state(state)

    # Verify setup populated state correctly
    assert state["scores"] == []
    assert state["tabs"] == "Em G D A7sus4"
    assert state["song"] == "Wonderwall"
    assert state["artist"] == "Oasis"
    assert state["instrument"] == "guitar"
    assert "Wonderwall" in state["prompt"][0]["content"]
    assert "Em G D A7sus4" in state["prompt"][0]["content"]

    # -- Turn 1: agent gives tip, student plays, gets score 3 ---------------
    turn1_messages = [
        {"role": "assistant", "content": "Focus on the Em to G transition. Keep your index finger anchored."},
    ]

    with (
        patch.object(env, "bridge") as mock_bridge,
        patch.object(env, "evaluator") as mock_evaluator,
    ):
        mock_bridge.send_tip = AsyncMock()
        mock_bridge.wait_for_attempt = AsyncMock(return_value="dGVzdF9hdWRpb18x")
        mock_evaluator.evaluate = AsyncMock(
            return_value={"score": 3, "feedback": "Rough transitions between Em and G. Timing is off."}
        )

        turn1_env_response = await env.env_response(turn1_messages, state)

    # Verify Turn 1 results
    assert state["scores"] == [3]
    assert len(turn1_env_response) == 1
    assert turn1_env_response[0]["role"] == "user"
    assert "3" in turn1_env_response[0]["content"]
    assert "first attempt" in turn1_env_response[0]["content"]

    # -- Turn 2: another tip, student improves, gets score 6 ----------------
    turn2_messages = [
        *turn1_messages,
        turn1_env_response[0],
        {"role": "assistant", "content": "Good start! Now slow down on bar 2. Let each chord ring out before moving."},
    ]

    with (
        patch.object(env, "bridge") as mock_bridge,
        patch.object(env, "evaluator") as mock_evaluator,
    ):
        mock_bridge.send_tip = AsyncMock()
        mock_bridge.wait_for_attempt = AsyncMock(return_value="dGVzdF9hdWRpb18y")
        mock_evaluator.evaluate = AsyncMock(
            return_value={"score": 6, "feedback": "Better timing. Chord transitions smoother."}
        )

        turn2_env_response = await env.env_response(turn2_messages, state)

    # -- Final assertions: scores and improvement delta ---------------------
    assert state["scores"] == [3, 6], f"Expected [3, 6] but got {state['scores']}"

    turn2_content = turn2_env_response[0]["content"]
    assert "6" in turn2_content
    assert "+3" in turn2_content, "Improvement delta (+3) should appear in env message"
    assert "3 -> 6" in turn2_content, "Score history should show '3 -> 6'"

    # Verify stop condition: score 6 < 8, so student has NOT mastered yet
    assert await env.student_mastered(state) is False


@pytest.mark.asyncio
async def test_episode_stops_when_mastered():
    """student_mastered should return True once a score >= 8 is reached."""

    env = _make_env()

    state = {"scores": [3, 6, 8]}
    assert await env.student_mastered(state) is True


@pytest.mark.asyncio
async def test_full_episode_score_history_format():
    """Verify the score history string is formatted correctly across turns."""

    env = _make_env()

    state = {
        "scores": [3, 6],
        "tabs": "Em G D A7sus4",
        "info": {"song": "Wonderwall", "instrument": "guitar"},
    }
    messages = [
        {"role": "assistant", "content": "Try adding vibrato on the sustained notes."},
    ]

    with (
        patch.object(env, "bridge") as mock_bridge,
        patch.object(env, "evaluator") as mock_evaluator,
    ):
        mock_bridge.send_tip = AsyncMock()
        mock_bridge.wait_for_attempt = AsyncMock(return_value="dGVzdA==")
        mock_evaluator.evaluate = AsyncMock(
            return_value={"score": 8, "feedback": "Excellent progress!"}
        )

        env_response = await env.env_response(messages, state)

    assert state["scores"] == [3, 6, 8]
    content = env_response[0]["content"]
    assert "3 -> 6 -> 8" in content, "Full score history should appear"
    assert "+2" in content, "Delta from 6 to 8 should be +2"
