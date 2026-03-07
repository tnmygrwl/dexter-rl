# Dexter RL Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Prime Intellect verifiers-compatible RL environment that wraps Gemini multimodal music coaching into trainable trajectories.

**Architecture:** A `StatefulToolEnv` subclass where each rollout: scrapes tabs via Browserbase, bridges to an Expo app via WebSocket for human audio capture, evaluates attempts via Gemini multimodal, and produces reward signals from score improvement. The env observes Gemini Live coaching sessions and logs them as RL training data.

**Tech Stack:** Python 3.11+, verifiers (Prime Intellect), google-genai, browserbase SDK, websockets, datasets (HuggingFace), pytest

---

### Task 1: Project Scaffolding

**Files:**
- Create: `pyproject.toml`
- Create: `dexter_rl/__init__.py`
- Create: `datasets/songs.jsonl`

**Step 1: Create pyproject.toml**

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "dexter-rl"
version = "0.1.0"
description = "RL environment for training AI music coaches"
requires-python = ">=3.11"
dependencies = [
    "verifiers>=0.1.9",
    "google-genai>=1.0.0",
    "browserbase>=1.0.0",
    "playwright>=1.40.0",
    "websockets>=13.0",
    "datasets>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
]
```

**Step 2: Create dexter_rl/__init__.py**

```python
from dexter_rl.env import load_environment

__all__ = ["load_environment"]
```

**Step 3: Create datasets/songs.jsonl**

```jsonl
{"task": "Wonderwall", "song": "Wonderwall", "artist": "Oasis", "instrument": "guitar"}
{"task": "Blackbird", "song": "Blackbird", "artist": "The Beatles", "instrument": "guitar"}
{"task": "Smoke on the Water", "song": "Smoke on the Water", "artist": "Deep Purple", "instrument": "guitar"}
{"task": "Wish You Were Here", "song": "Wish You Were Here", "artist": "Pink Floyd", "instrument": "guitar"}
{"task": "Hotel California", "song": "Hotel California", "artist": "Eagles", "instrument": "guitar"}
```

**Step 4: Install dependencies**

Run: `cd /Users/christina/dexter-rl && uv init --no-readme && uv add verifiers google-genai browserbase playwright websockets datasets && uv add --dev pytest pytest-asyncio`
Then: `uv run playwright install chromium`

**Step 5: Commit**

```bash
git add pyproject.toml dexter_rl/__init__.py datasets/songs.jsonl
git commit -m "feat: scaffold project with dependencies and song dataset"
```

---

### Task 2: Gemini Multimodal Evaluator

The reward signal. Sends audio + tabs to Gemini and gets back a structured score.

**Files:**
- Create: `dexter_rl/evaluator.py`
- Create: `tests/test_evaluator.py`

**Step 1: Write the failing test**

```python
# tests/test_evaluator.py
import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_evaluate_returns_score_and_feedback():
    """Evaluator should return a dict with score (1-10) and feedback string."""
    from dexter_rl.evaluator import GeminiEvaluator

    mock_response = MagicMock()
    mock_response.text = json.dumps({"score": 6, "feedback": "Good timing but sloppy transitions."})

    mock_model = AsyncMock()
    mock_model.generate_content_async = AsyncMock(return_value=mock_response)

    with patch("dexter_rl.evaluator.genai") as mock_genai:
        mock_client = MagicMock()
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
        mock_genai.Client.return_value = mock_client

        evaluator = GeminiEvaluator()
        result = await evaluator.evaluate(
            audio_base64="dGVzdGF1ZGlv",
            tabs="Em G D A7sus4",
        )

    assert "score" in result
    assert "feedback" in result
    assert 1 <= result["score"] <= 10
    assert isinstance(result["feedback"], str)


@pytest.mark.asyncio
async def test_evaluate_handles_malformed_json():
    """Evaluator should return score 0 if Gemini returns non-JSON."""
    from dexter_rl.evaluator import GeminiEvaluator

    mock_response = MagicMock()
    mock_response.text = "I can't evaluate this audio properly."

    with patch("dexter_rl.evaluator.genai") as mock_genai:
        mock_client = MagicMock()
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
        mock_genai.Client.return_value = mock_client

        evaluator = GeminiEvaluator()
        result = await evaluator.evaluate(
            audio_base64="dGVzdGF1ZGlv",
            tabs="Em G D A7sus4",
        )

    assert result["score"] == 0
    assert "feedback" in result
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/christina/dexter-rl && uv run pytest tests/test_evaluator.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'dexter_rl.evaluator'`

**Step 3: Write the implementation**

```python
# dexter_rl/evaluator.py
import json
import base64
from google import genai
from google.genai import types

EVAL_PROMPT = """You are evaluating a guitar student's attempt at playing a passage.

Tabs for this passage:
{tabs}

Listen to the audio and evaluate:
1. Pitch accuracy (are they playing the right notes?)
2. Timing (are transitions between chords smooth?)
3. Rhythm (is the strumming pattern correct?)

Return ONLY valid JSON: {{"score": <1-10>, "feedback": "<2 sentence evaluation>"}}"""

MODEL = "gemini-2.5-flash"


class GeminiEvaluator:
    def __init__(self, model: str = MODEL):
        self.client = genai.Client()
        self.model = model

    async def evaluate(self, audio_base64: str, tabs: str) -> dict:
        audio_bytes = base64.b64decode(audio_base64)
        prompt = EVAL_PROMPT.format(tabs=tabs)

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=[
                types.Content(
                    parts=[
                        types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav"),
                        types.Part.from_text(text=prompt),
                    ]
                )
            ],
        )

        try:
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            result = json.loads(text)
            result["score"] = max(1, min(10, int(result["score"])))
            return result
        except (json.JSONDecodeError, KeyError, ValueError):
            return {"score": 0, "feedback": response.text}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/christina/dexter-rl && uv run pytest tests/test_evaluator.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add dexter_rl/evaluator.py tests/test_evaluator.py
git commit -m "feat: add Gemini multimodal evaluator for scoring guitar attempts"
```

---

### Task 3: Browserbase Tab Scraper

Scrapes guitar tabs from Ultimate Guitar using Browserbase.

**Files:**
- Create: `dexter_rl/tabs.py`
- Create: `tests/test_tabs.py`

**Step 1: Write the failing test**

```python
# tests/test_tabs.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_scrape_tabs_returns_string():
    """Tab scraper should return a non-empty string of tab content."""
    from dexter_rl.tabs import TabScraper

    mock_page = MagicMock()
    mock_page.goto = AsyncMock()
    mock_page.wait_for_selector = AsyncMock()
    mock_page.query_selector = AsyncMock(return_value=MagicMock())
    mock_page.query_selector.return_value.inner_text = AsyncMock(
        return_value="Em G D A7sus4\ne|---0---3---2---0---\nB|---0---0---3---3---"
    )
    mock_page.close = AsyncMock()

    mock_context = MagicMock()
    mock_context.new_page = AsyncMock(return_value=mock_page)
    mock_context.close = AsyncMock()

    mock_browser = MagicMock()
    mock_browser.close = AsyncMock()

    mock_pw = MagicMock()
    mock_pw.chromium.connect_over_cdp = AsyncMock(return_value=mock_browser)
    mock_browser.contexts = [mock_context]

    with patch("dexter_rl.tabs.Browserbase") as mock_bb_cls, \
         patch("dexter_rl.tabs.async_playwright") as mock_pw_ctx:
        mock_bb = MagicMock()
        mock_bb.sessions.create.return_value = MagicMock(
            id="sess_123",
            connect_url="wss://connect.browserbase.com/sess_123"
        )
        mock_bb_cls.return_value = mock_bb
        mock_pw_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_pw)
        mock_pw_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        scraper = TabScraper()
        tabs = await scraper.scrape("Wonderwall", "guitar")

    assert isinstance(tabs, str)
    assert len(tabs) > 0


def test_cache_returns_same_result():
    """Scraper should cache results for the same song."""
    from dexter_rl.tabs import TabScraper

    scraper = TabScraper()
    scraper._cache[("wonderwall", "guitar")] = "cached tabs"
    import asyncio
    result = asyncio.run(scraper.scrape("Wonderwall", "guitar"))
    assert result == "cached tabs"
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/christina/dexter-rl && uv run pytest tests/test_tabs.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Write the implementation**

```python
# dexter_rl/tabs.py
import os
from browserbase import Browserbase
from playwright.async_api import async_playwright

ULTIMATE_GUITAR_SEARCH = "https://www.ultimate-guitar.com/search.php?search_type=title&value={query}"


class TabScraper:
    def __init__(self):
        self._cache: dict[tuple[str, str], str] = {}

    async def scrape(self, song: str, instrument: str) -> str:
        key = (song.lower(), instrument.lower())
        if key in self._cache:
            return self._cache[key]

        tabs = await self._scrape_browserbase(song, instrument)
        self._cache[key] = tabs
        return tabs

    async def _scrape_browserbase(self, song: str, instrument: str) -> str:
        bb = Browserbase()
        session = bb.sessions.create(project_id=os.environ.get("BROWSERBASE_PROJECT_ID", ""))

        async with async_playwright() as pw:
            browser = await pw.chromium.connect_over_cdp(session.connect_url)
            context = browser.contexts[0]
            page = await context.new_page()

            query = f"{song} {instrument} tabs"
            await page.goto(ULTIMATE_GUITAR_SEARCH.format(query=query))
            await page.wait_for_selector("article a", timeout=10000)

            first_link = await page.query_selector("article a")
            if first_link:
                await first_link.click()
                await page.wait_for_selector("[class*='Tablature'], pre, .js-tab-content", timeout=10000)

                tab_el = await page.query_selector("[class*='Tablature'], pre, .js-tab-content")
                if tab_el:
                    tabs = await tab_el.inner_text()
                    await page.close()
                    await browser.close()
                    return tabs

            await page.close()
            await browser.close()
            return f"[Tabs not found for {song}. Use standard {instrument} chords.]"
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/christina/dexter-rl && uv run pytest tests/test_tabs.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add dexter_rl/tabs.py tests/test_tabs.py
git commit -m "feat: add Browserbase tab scraper with caching"
```

---

### Task 4: WebSocket Bridge

Connects the RL env to the Expo app. Sends coaching tips, receives audio recordings.

**Files:**
- Create: `dexter_rl/bridge.py`
- Create: `tests/test_bridge.py`

**Step 1: Write the failing test**

```python
# tests/test_bridge.py
import pytest
import json
import asyncio
from unittest.mock import AsyncMock, MagicMock


@pytest.mark.asyncio
async def test_bridge_send_tip():
    """Bridge should send coaching tips as JSON to the connected client."""
    from dexter_rl.bridge import ExpoBridge

    bridge = ExpoBridge(port=0)
    mock_ws = AsyncMock()
    bridge._client = mock_ws

    await bridge.send_tip("Focus on bar 2 transition")

    mock_ws.send.assert_called_once_with(
        json.dumps({"type": "show_tip", "tip": "Focus on bar 2 transition"})
    )


@pytest.mark.asyncio
async def test_bridge_wait_for_attempt():
    """Bridge should wait for and return audio from the app."""
    from dexter_rl.bridge import ExpoBridge

    bridge = ExpoBridge(port=0)
    mock_ws = AsyncMock()
    mock_ws.recv = AsyncMock(
        return_value=json.dumps({"type": "attempt_complete", "audio_base64": "dGVzdA=="})
    )
    bridge._client = mock_ws

    result = await bridge.wait_for_attempt()

    assert result == "dGVzdA=="


@pytest.mark.asyncio
async def test_bridge_send_tabs():
    """Bridge should send tabs to the app."""
    from dexter_rl.bridge import ExpoBridge

    bridge = ExpoBridge(port=0)
    mock_ws = AsyncMock()
    bridge._client = mock_ws

    await bridge.send_tabs("Em G D A7sus4")

    mock_ws.send.assert_called_once_with(
        json.dumps({"type": "show_tabs", "tabs": "Em G D A7sus4"})
    )
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/christina/dexter-rl && uv run pytest tests/test_bridge.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Write the implementation**

```python
# dexter_rl/bridge.py
import json
import asyncio
import websockets


class ExpoBridge:
    def __init__(self, host: str = "0.0.0.0", port: int = 8765):
        self.host = host
        self.port = port
        self._client = None
        self._server = None
        self._client_connected = asyncio.Event()

    async def start(self):
        self._server = await websockets.serve(self._handler, self.host, self.port)

    async def _handler(self, websocket):
        self._client = websocket
        self._client_connected.set()
        try:
            await websocket.wait_closed()
        finally:
            self._client = None
            self._client_connected.clear()

    async def wait_for_client(self, timeout: float = 300.0):
        await asyncio.wait_for(self._client_connected.wait(), timeout=timeout)

    async def send_tip(self, tip: str):
        if self._client:
            await self._client.send(json.dumps({"type": "show_tip", "tip": tip}))

    async def send_tabs(self, tabs: str):
        if self._client:
            await self._client.send(json.dumps({"type": "show_tabs", "tabs": tabs}))

    async def wait_for_attempt(self, timeout: float = 120.0) -> str:
        while self._client:
            raw = await asyncio.wait_for(self._client.recv(), timeout=timeout)
            msg = json.loads(raw)
            if msg["type"] == "attempt_complete":
                return msg["audio_base64"]

    async def stop(self):
        if self._server:
            self._server.close()
            await self._server.wait_closed()
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/christina/dexter-rl && uv run pytest tests/test_bridge.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add dexter_rl/bridge.py tests/test_bridge.py
git commit -m "feat: add WebSocket bridge for Expo app communication"
```

---

### Task 5: Reward Rubric

Verifiers rubric that computes improvement reward from score deltas.

**Files:**
- Create: `dexter_rl/rewards.py`
- Create: `tests/test_rewards.py`

**Step 1: Write the failing test**

```python
# tests/test_rewards.py
import pytest


@pytest.mark.asyncio
async def test_improvement_reward_positive():
    """Reward should be positive when score improves."""
    from dexter_rl.rewards import improvement_reward

    state = {"scores": [3, 6]}
    result = await improvement_reward(completion=[], answer="", state=state)
    assert result == pytest.approx(0.3)


@pytest.mark.asyncio
async def test_improvement_reward_negative():
    """Reward should be negative when score decreases."""
    from dexter_rl.rewards import improvement_reward

    state = {"scores": [7, 4]}
    result = await improvement_reward(completion=[], answer="", state=state)
    assert result == pytest.approx(-0.3)


@pytest.mark.asyncio
async def test_improvement_reward_first_attempt():
    """First attempt reward is the raw score normalized."""
    from dexter_rl.rewards import improvement_reward

    state = {"scores": [5]}
    result = await improvement_reward(completion=[], answer="", state=state)
    assert result == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_absolute_score_metric():
    """Absolute score metric returns the last score normalized."""
    from dexter_rl.rewards import absolute_score

    state = {"scores": [3, 7]}
    result = await absolute_score(completion=[], answer="", state=state)
    assert result == pytest.approx(0.7)
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/christina/dexter-rl && uv run pytest tests/test_rewards.py -v`
Expected: FAIL

**Step 3: Write the implementation**

```python
# dexter_rl/rewards.py


async def improvement_reward(completion, answer, state, **kwargs) -> float:
    scores = state.get("scores", [0])
    current = scores[-1]
    prev = scores[-2] if len(scores) > 1 else 0
    return (current - prev) / 10.0


async def absolute_score(completion, answer, state, **kwargs) -> float:
    scores = state.get("scores", [0])
    return scores[-1] / 10.0
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/christina/dexter-rl && uv run pytest tests/test_rewards.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add dexter_rl/rewards.py tests/test_rewards.py
git commit -m "feat: add improvement reward rubric and score metrics"
```

---

### Task 6: MusicCoachEnv — The Core Environment

The verifiers-compatible environment that ties everything together.

**Files:**
- Create: `dexter_rl/env.py`
- Create: `tests/test_env.py`

**Step 1: Write the failing test**

```python
# tests/test_env.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_load_environment_returns_env():
    """load_environment should return a MusicCoachEnv instance."""
    from dexter_rl.env import load_environment

    env = load_environment()
    assert hasattr(env, "rollout")
    assert hasattr(env, "setup_state")


@pytest.mark.asyncio
async def test_env_setup_state_initializes():
    """setup_state should initialize scores, tabs, and bridge."""
    from dexter_rl.env import MusicCoachEnv
    from dexter_rl.rewards import improvement_reward, absolute_score
    import verifiers as vf

    env = MusicCoachEnv(
        dataset=None,
        rubric=vf.Rubric(funcs=[improvement_reward], weights=[1.0]),
        max_turns=5,
    )

    state = {
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


@pytest.mark.asyncio
async def test_env_env_response_evaluates_attempt():
    """env_response should get audio from bridge, evaluate, update scores."""
    from dexter_rl.env import MusicCoachEnv
    from dexter_rl.rewards import improvement_reward
    import verifiers as vf

    env = MusicCoachEnv(
        dataset=None,
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

        new_messages, new_state = await env.env_response(messages, state)

    assert new_state["scores"] == [3, 6]
    assert any("6" in str(m) for m in new_messages)
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/christina/dexter-rl && uv run pytest tests/test_env.py -v`
Expected: FAIL

**Step 3: Write the implementation**

```python
# dexter_rl/env.py
from typing import Tuple
from datasets import Dataset
import verifiers as vf
from verifiers.types import Messages, State
from dexter_rl.evaluator import GeminiEvaluator
from dexter_rl.tabs import TabScraper
from dexter_rl.bridge import ExpoBridge
from dexter_rl.rewards import improvement_reward, absolute_score

SYSTEM_PROMPT = """You are an expert music coach. You are teaching a student to play {song} by {artist} on {instrument}.

Here are the tabs:
{tabs}

Each turn, you will see the student's evaluation from their latest attempt. Give ONE specific, actionable coaching tip to help them improve. Be encouraging but precise. Reference specific bars, chords, or techniques.

The student's progress is measured on a 1-10 scale. Your goal is to maximize their improvement."""

EVAL_MESSAGE = """Student attempt #{attempt} evaluation:
Score: {score}/10 ({delta})
Feedback: {feedback}

Previous scores: {history}

Give your next coaching tip."""


class MusicCoachEnv(vf.MultiTurnEnv):
    def __init__(self, dataset, rubric, max_turns: int = 10, bridge_port: int = 8765, **kwargs):
        super().__init__(dataset=dataset, rubric=rubric, max_turns=max_turns, **kwargs)
        self.evaluator = GeminiEvaluator()
        self.tab_scraper = TabScraper()
        self.bridge = ExpoBridge(port=bridge_port)

    async def setup_state(self, state: State, **kwargs) -> State:
        state = await super().setup_state(state, **kwargs)
        info = state.get("info", {})
        song = info.get("song", state.get("task", "Unknown"))
        instrument = info.get("instrument", "guitar")
        artist = info.get("artist", "Unknown")

        tabs = await self.tab_scraper.scrape(song, instrument)
        state["tabs"] = tabs
        state["scores"] = []
        state["song"] = song
        state["artist"] = artist
        state["instrument"] = instrument

        await self.bridge.start()
        await self.bridge.wait_for_client(timeout=300)
        await self.bridge.send_tabs(tabs)

        return state

    def get_system_prompt(self, state: State, **kwargs) -> str:
        return SYSTEM_PROMPT.format(
            song=state["song"],
            artist=state["artist"],
            instrument=state["instrument"],
            tabs=state["tabs"],
        )

    async def is_completed(self, messages: Messages, state: State, **kwargs) -> bool:
        if await super().is_completed(messages, state, **kwargs):
            return True
        scores = state.get("scores", [])
        if scores and scores[-1] >= 8:
            return True
        return False

    async def env_response(self, messages: Messages, state: State, **kwargs) -> Tuple[Messages, State]:
        last_assistant = None
        for m in reversed(messages):
            if isinstance(m, dict) and m.get("role") == "assistant":
                last_assistant = m.get("content", "")
                break
            elif hasattr(m, "role") and m.role == "assistant":
                last_assistant = m.content
                break

        if last_assistant:
            await self.bridge.send_tip(last_assistant)

        audio_b64 = await self.bridge.wait_for_attempt(timeout=120)
        result = await self.evaluator.evaluate(audio_b64, state["tabs"])

        score = result["score"]
        feedback = result["feedback"]
        state["scores"].append(score)

        scores = state["scores"]
        if len(scores) > 1:
            delta = f"+{scores[-1] - scores[-2]}" if scores[-1] >= scores[-2] else str(scores[-1] - scores[-2])
        else:
            delta = "first attempt"

        history = " -> ".join(str(s) for s in scores)

        env_msg = {
            "role": "user",
            "content": EVAL_MESSAGE.format(
                attempt=len(scores),
                score=score,
                delta=delta,
                feedback=feedback,
                history=history,
            ),
        }
        return [env_msg], state


def load_environment(**kwargs) -> MusicCoachEnv:
    dataset = Dataset.from_json("datasets/songs.jsonl")

    rubric = vf.Rubric(
        funcs=[improvement_reward, absolute_score],
        weights=[1.0, 0.0],
    )

    return MusicCoachEnv(
        dataset=dataset,
        rubric=rubric,
        max_turns=kwargs.pop("max_turns", 10),
        system_prompt="",  # Overridden by get_system_prompt
        **kwargs,
    )
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/christina/dexter-rl && uv run pytest tests/test_env.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add dexter_rl/env.py tests/test_env.py
git commit -m "feat: add MusicCoachEnv verifiers environment with full pipeline"
```

---

### Task 7: Integration Test & Demo Script

A runnable script that shows the full pipeline working end-to-end.

**Files:**
- Create: `scripts/demo.py`
- Create: `tests/test_integration.py`

**Step 1: Write integration test (mocked external services)**

```python
# tests/test_integration.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_full_episode_flow():
    """Full episode: load env, setup, simulate 2 coaching turns."""
    from dexter_rl.env import MusicCoachEnv
    from dexter_rl.rewards import improvement_reward, absolute_score
    import verifiers as vf

    rubric = vf.Rubric(
        funcs=[improvement_reward, absolute_score],
        weights=[1.0, 0.0],
    )
    env = MusicCoachEnv(dataset=None, rubric=rubric, max_turns=5)

    # Mock all external services
    env.tab_scraper.scrape = AsyncMock(return_value="Em G D A7sus4")
    env.bridge.start = AsyncMock()
    env.bridge.wait_for_client = AsyncMock()
    env.bridge.send_tabs = AsyncMock()
    env.bridge.send_tip = AsyncMock()
    env.bridge.wait_for_attempt = AsyncMock(return_value="dGVzdA==")
    env.evaluator.evaluate = AsyncMock(
        side_effect=[
            {"score": 3, "feedback": "Timing off on transitions."},
            {"score": 6, "feedback": "Much better timing."},
        ]
    )

    # Setup
    state = {
        "task": "Wonderwall",
        "info": {"song": "Wonderwall", "artist": "Oasis", "instrument": "guitar"},
    }
    state = await env.setup_state(state)
    assert state["tabs"] == "Em G D A7sus4"
    assert state["scores"] == []

    # Turn 1: agent gives tip, human plays, gets scored
    messages = [{"role": "assistant", "content": "Slow down between bars 1-2."}]
    new_msgs, state = await env.env_response(messages, state)
    assert state["scores"] == [3]
    assert "3" in new_msgs[0]["content"]

    # Turn 2: another tip, human improves
    messages = [{"role": "assistant", "content": "Focus on strumming pattern."}]
    new_msgs, state = await env.env_response(messages, state)
    assert state["scores"] == [3, 6]
    assert "+3" in new_msgs[0]["content"]
```

**Step 2: Run integration test**

Run: `cd /Users/christina/dexter-rl && uv run pytest tests/test_integration.py -v`
Expected: PASS

**Step 3: Write the demo script**

```python
# scripts/demo.py
"""
Demo script for Dexter RL.

Usage:
    1. Start this script: python scripts/demo.py
    2. Connect the Expo app to ws://localhost:8765
    3. Pick up your guitar and play!

Environment variables:
    GOOGLE_API_KEY       - Gemini API key
    BROWSERBASE_API_KEY  - Browserbase API key
    BROWSERBASE_PROJECT_ID - Browserbase project ID
"""
import asyncio
from dexter_rl.env import load_environment
from dexter_rl.bridge import ExpoBridge


async def main():
    print("=== Dexter RL Demo ===")
    print("Loading environment...")

    env = load_environment()

    print(f"Environment loaded. Waiting for Expo app to connect on ws://0.0.0.0:8765...")
    print("Connect your Expo app, then start playing!")
    print()

    # For demo purposes, simulate what prime-rl would do:
    # The "agent" here is just Gemini generating coaching tips.
    # In real training, this would be the model being trained.
    from google import genai

    client = genai.Client()

    state = {
        "task": "Wonderwall",
        "info": {"song": "Wonderwall", "artist": "Oasis", "instrument": "guitar"},
    }
    state = await env.setup_state(state)

    system_prompt = env.get_system_prompt(state)
    messages = [{"role": "system", "content": system_prompt}]

    # Initial evaluation (human plays first attempt without coaching)
    print("Waiting for first attempt...")
    audio_b64 = await env.bridge.wait_for_attempt()
    result = await env.evaluator.evaluate(audio_b64, state["tabs"])
    state["scores"].append(result["score"])

    print(f"  Attempt 1: Score {result['score']}/10 - {result['feedback']}")

    eval_msg = f"Student attempt #1 evaluation:\nScore: {result['score']}/10 (first attempt)\nFeedback: {result['feedback']}\n\nGive your next coaching tip."
    messages.append({"role": "user", "content": eval_msg})

    for turn in range(2, 11):
        # Agent generates coaching tip
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=[{"role": m["role"], "parts": [{"text": m["content"]}]} for m in messages],
        )
        tip = response.text
        print(f"\n  Coach tip: {tip}")
        messages.append({"role": "assistant", "content": tip})

        # Send tip and wait for next attempt
        coach_msgs = [{"role": "assistant", "content": tip}]
        env_msgs, state = await env.env_response(coach_msgs, state)

        score = state["scores"][-1]
        print(f"  Attempt {turn}: Score {score}/10")
        print(f"  Scores: {' -> '.join(str(s) for s in state['scores'])}")

        messages.append(env_msgs[0])

        if score >= 8:
            print(f"\n  Student mastered the passage! Final score: {score}/10")
            break

    print("\n=== Episode Complete ===")
    print(f"Trajectory: {len(state['scores'])} attempts")
    print(f"Score progression: {' -> '.join(str(s) for s in state['scores'])}")
    print(f"Total improvement: +{state['scores'][-1] - state['scores'][0]}")
    print("\nThis trajectory is now training data for any RL agent.")

    await env.bridge.stop()


if __name__ == "__main__":
    asyncio.run(main())
```

**Step 4: Commit**

```bash
git add scripts/demo.py tests/test_integration.py
git commit -m "feat: add demo script and integration test for full pipeline"
```

---

### Task 8: Run All Tests & Final Verification

**Step 1: Run full test suite**

Run: `cd /Users/christina/dexter-rl && uv run pytest tests/ -v`
Expected: All tests PASS

**Step 2: Verify package imports cleanly**

Run: `cd /Users/christina/dexter-rl && uv run python -c "from dexter_rl import load_environment; print('OK')"`
Expected: `OK`

**Step 3: Final commit with updated README**

Update `README.md` to reflect the actual implementation, then:

```bash
git add README.md
git commit -m "docs: update README with usage instructions"
```
