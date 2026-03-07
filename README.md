# dexter-rl

An RL environment for training AI music coaches. Gemini Live teaches you guitar — every coaching decision and student improvement is captured as an RL trajectory. Built on [Prime Intellect verifiers](https://github.com/PrimeIntellect-ai/verifiers), drop-in compatible with [prime-rl](https://github.com/PrimeIntellect-ai/prime-rl).

**"Can your model teach guitar better than Gemini? Here's the environment to find out."**

## How It Works

```
Gemini Live <-------> Human (Expo app)
     |                    |
coaching tip          plays guitar
     |                    |
     v                    v
+------------------------------------+
|     RL Environment (observer)      |
|                                    |
|  state  = tabs + score history     |
|  action = coaching tip             |
|  reward = score improvement        |
+------------------------------------+
```

1. **Browserbase** scrapes guitar tabs for any song
2. **Gemini Live** coaches the student in real-time (via the Expo app)
3. **Gemini multimodal** evaluates each attempt (pitch, timing, rhythm → score 1-10)
4. **The RL env** captures every `{coaching_tip, student_improvement}` pair as a training trajectory

## Quick Start

```bash
# Install
uv sync

# Set env vars
export GOOGLE_API_KEY="your-key"
export BROWSERBASE_API_KEY="your-key"
export BROWSERBASE_PROJECT_ID="your-project-id"

# Run demo
uv run python scripts/demo.py

# Run tests
uv run pytest tests/ -v
```

## As a Verifiers Environment

```python
from dexter_rl import load_environment

env = load_environment(max_turns=10)
```

Or with prime-rl:

```toml
[[env]]
id = "dexter/music-coach"
args = { max_turns = 10 }
```

## Architecture

| Module | Purpose |
|--------|---------|
| `dexter_rl/env.py` | `MusicCoachEnv` — the verifiers environment |
| `dexter_rl/evaluator.py` | Gemini multimodal scoring (reward signal) |
| `dexter_rl/tabs.py` | Browserbase tab scraping |
| `dexter_rl/bridge.py` | WebSocket bridge to Expo app |
| `dexter_rl/rewards.py` | Improvement reward + metrics |

## Episode Flow

Each episode is turn-based:

1. Agent sees: tabs + Gemini's evaluation of the student's last attempt
2. Agent gives ONE coaching tip
3. Student plays again
4. Gemini evaluates the new attempt
5. Reward = score improvement (normalized to [-1, 1])
6. Repeat until score >= 8/10 or max turns

Built for YC x DeepMind Hackathon 2026.
