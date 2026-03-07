import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_load_environment_returns_env():
    """load_environment should return a MusicCoachEnv instance."""
    with patch("dexter_rl.env.GeminiEvaluator"):
        from dexter_rl.env import load_environment

        env = load_environment()
        assert hasattr(env, "rollout")
        assert hasattr(env, "setup_state")


@pytest.mark.asyncio
async def test_env_setup_state_initializes():
    """setup_state should initialize scores, tabs, and bridge."""
    from dexter_rl.env import MusicCoachEnv
    from dexter_rl.rewards import improvement_reward
    import verifiers as vf

    with patch("dexter_rl.env.GeminiEvaluator"):
        env = MusicCoachEnv(
            dataset=None,
            eval_dataset=MagicMock(),  # Avoid "no dataset" error
            rubric=vf.Rubric(funcs=[improvement_reward], weights=[1.0]),
            max_turns=5,
        )

    state = {
        "prompt": [
            {"role": "system", "content": "placeholder"},
            {"role": "user", "content": "Begin coaching."},
        ],
        "task": "Wonderwall",
        "info": {"song": "Wonderwall", "artist": "Oasis", "instrument": "guitar"},
    }

    with patch.object(env, "tab_scraper") as mock_scraper, \
         patch.object(env, "bridge") as mock_bridge:
        mock_scraper.scrape = AsyncMock(return_value="Em G D A7sus4")
        mock_bridge.start = AsyncMock()
        mock_bridge.wait_for_client = AsyncMock()
        mock_bridge.send_tabs = AsyncMock()

        result = await env.setup_state(state)

    assert result["scores"] == []
    assert result["tabs"] == "Em G D A7sus4"
    assert result["song"] == "Wonderwall"
    assert result["artist"] == "Oasis"
    assert result["instrument"] == "guitar"


@pytest.mark.asyncio
async def test_env_env_response_evaluates_attempt():
    """env_response should get audio from bridge, evaluate, update scores."""
    from dexter_rl.env import MusicCoachEnv
    from dexter_rl.rewards import improvement_reward
    import verifiers as vf

    with patch("dexter_rl.env.GeminiEvaluator"):
        env = MusicCoachEnv(
            dataset=None,
            eval_dataset=MagicMock(),
            rubric=vf.Rubric(funcs=[improvement_reward], weights=[1.0]),
            max_turns=5,
        )

    state = {
        "scores": [3],
        "tabs": "Em G D A7sus4",
        "info": {"song": "Wonderwall", "instrument": "guitar"},
    }
    messages = [{"role": "assistant", "content": "Try slowing down on bar 2."}]

    with patch.object(env, "bridge") as mock_bridge, \
         patch.object(env, "evaluator") as mock_evaluator:
        mock_bridge.send_tip = AsyncMock()
        mock_bridge.wait_for_attempt = AsyncMock(return_value="dGVzdA==")
        mock_evaluator.evaluate = AsyncMock(
            return_value={"score": 6, "feedback": "Better timing."}
        )

        new_messages = await env.env_response(messages, state)

    assert state["scores"] == [3, 6]
    assert isinstance(new_messages, list)
    assert len(new_messages) == 1
    assert new_messages[0]["role"] == "user"
    assert "6" in new_messages[0]["content"]
    assert "+3" in new_messages[0]["content"]


@pytest.mark.asyncio
async def test_env_env_response_first_attempt():
    """env_response should handle first attempt (no previous score)."""
    from dexter_rl.env import MusicCoachEnv
    from dexter_rl.rewards import improvement_reward
    import verifiers as vf

    with patch("dexter_rl.env.GeminiEvaluator"):
        env = MusicCoachEnv(
            dataset=None,
            eval_dataset=MagicMock(),
            rubric=vf.Rubric(funcs=[improvement_reward], weights=[1.0]),
            max_turns=5,
        )

    state = {
        "scores": [],
        "tabs": "Em G D A7sus4",
        "info": {"song": "Wonderwall", "instrument": "guitar"},
    }
    messages = [{"role": "assistant", "content": "Start by placing your fingers on Em."}]

    with patch.object(env, "bridge") as mock_bridge, \
         patch.object(env, "evaluator") as mock_evaluator:
        mock_bridge.send_tip = AsyncMock()
        mock_bridge.wait_for_attempt = AsyncMock(return_value="dGVzdA==")
        mock_evaluator.evaluate = AsyncMock(
            return_value={"score": 4, "feedback": "Good start."}
        )

        new_messages = await env.env_response(messages, state)

    assert state["scores"] == [4]
    assert "first attempt" in new_messages[0]["content"]


@pytest.mark.asyncio
async def test_student_mastered_stop_condition():
    """student_mastered should return True when score >= 8."""
    from dexter_rl.env import MusicCoachEnv
    from dexter_rl.rewards import improvement_reward
    import verifiers as vf

    with patch("dexter_rl.env.GeminiEvaluator"):
        env = MusicCoachEnv(
            dataset=None,
            eval_dataset=MagicMock(),
            rubric=vf.Rubric(funcs=[improvement_reward], weights=[1.0]),
            max_turns=5,
        )

    # Score below threshold
    state_low = {"scores": [5]}
    assert await env.student_mastered(state_low) is False

    # Score at threshold
    state_high = {"scores": [8]}
    assert await env.student_mastered(state_high) is True

    # Empty scores
    state_empty = {"scores": []}
    assert await env.student_mastered(state_empty) is False


@pytest.mark.asyncio
async def test_env_system_prompt_updated_in_setup():
    """setup_state should update the system prompt with tabs and song info."""
    from dexter_rl.env import MusicCoachEnv
    from dexter_rl.rewards import improvement_reward
    import verifiers as vf

    with patch("dexter_rl.env.GeminiEvaluator"):
        env = MusicCoachEnv(
            dataset=None,
            eval_dataset=MagicMock(),
            rubric=vf.Rubric(funcs=[improvement_reward], weights=[1.0]),
            max_turns=5,
        )

    state = {
        "prompt": [
            {"role": "system", "content": "placeholder"},
            {"role": "user", "content": "Begin coaching."},
        ],
        "task": "Blackbird",
        "info": {"song": "Blackbird", "artist": "The Beatles", "instrument": "guitar"},
    }

    with patch.object(env, "tab_scraper") as mock_scraper, \
         patch.object(env, "bridge") as mock_bridge:
        mock_scraper.scrape = AsyncMock(return_value="G Am7 G/B G")
        mock_bridge.start = AsyncMock()
        mock_bridge.wait_for_client = AsyncMock()
        mock_bridge.send_tabs = AsyncMock()

        result = await env.setup_state(state)

    system_content = result["prompt"][0]["content"]
    assert "Blackbird" in system_content
    assert "The Beatles" in system_content
    assert "G Am7 G/B G" in system_content
