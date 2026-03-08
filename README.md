# Dexter RL

An RL environment for training AI music coaches. Gemini watches you play guitar — analyzing your hands via camera and your audio via microphone — then coaches you in real-time. Every coaching decision and student improvement is captured as an RL trajectory for training better coaches.

Built on [Prime Intellect verifiers](https://github.com/PrimeIntellect-ai/verifiers), drop-in compatible with [prime-rl](https://github.com/PrimeIntellect-ai/prime-rl).

**Built at YC x DeepMind Hackathon 2026.**

## The Problem

Teaching music is deeply interactive — a great coach adapts to what they see and hear in real time. But there's no RL environment that captures the coaching loop: observe the student, give a tip, see if they improve, repeat. Dexter RL builds that loop end-to-end.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Expo App (Student)                       │
│                                                             │
│   📷 Camera ──┐    🎸 Tab Notation    ┌── 💬 AI Coach Feed │
│   🎤 Mic ─────┤                       │                    │
│               ▼                       │                    │
│        ┌──────────────┐     ┌─────────┴──────┐             │
│        │ Audio        │     │ Coaching Feed   │             │
│        │ Analysis     │     │ (text tips)     │             │
│        └──────┬───────┘     └────────▲───────┘             │
│               │                      │                      │
└───────────────┼──────────────────────┼──────────────────────┘
                │                      │
                ▼                      │
        ┌───────────────┐    ┌─────────┴──────────┐
        │ Gemini 2.5    │    │                     │
        │ Multimodal    │───▶│  Coaching Response  │
        │ (image+text)  │    │  (2-3 sentences)    │
        └───────────────┘    └─────────┬───────────┘
                                       │
                              ┌────────▼────────┐
                              │   RL Trajectory  │
                              │   Server         │
                              │                  │
                              │ ┌──────────────┐ │
                              │ │ Composite    │ │
                              │ │ Score (0-10) │ │
                              │ ├──────────────┤ │
                              │ │ Reward =     │ │
                              │ │ Δ score      │ │
                              │ ├──────────────┤ │
                              │ │ Trajectory   │ │
                              │ │ JSONL        │ │
                              │ └──────────────┘ │
                              └──────────────────┘
```

### Three-Layer Design

**1. Expo App** — The student-facing interface. Searches for any song via Songsterr, displays tab notation bar-by-bar, captures camera frames of the student's hands, and runs real-time audio analysis (pitch detection, timing, amplitude). Camera and microphone work simultaneously.

**2. Gemini Multimodal Coaching** — Every ~5 seconds, the app captures a JPEG frame from the camera and sends it alongside audio metrics and bar context (song, section, expected chords) to Gemini 2.5 Flash. Gemini sees the student's hands and hears their playing data, returning specific coaching tips ("arch your ring finger more on D to clear the high E string").

**3. RL Trajectory Server** — Each coaching interaction is logged as a trajectory step. The server computes a composite score from three weighted metrics (pitch accuracy 40%, timing 35%, finger position 25%) and calculates the reward as the score improvement from the previous step. Trajectories are saved as JSONL for training.

## Live Trajectory Capture

When a student practices, the terminal shows RL trajectories building in real-time:

```
============================================================
  DEXTER RL — Live Trajectory Capture
  Song: Smoke on the Water by Deep Purple
============================================================

  RL | Step   1 [###########################.............] 6.8/10 (reward: +0.68)
                 tip: "Smooth out the transition to the Bb5 chord"
  RL | Step   2 [#################################.......] 8.3/10 (reward: +0.14)
                 tip: "Keep the palm muting tight with your picking hand"
  RL | Step   3 [################################........] 8.1/10 (reward: -0.01)
                 tip: "Focus on the stretch for the Db5 power chord"
  RL | Step   4 [################################........] 8.1/10 (reward: +0.03)
                 tip: "Ensure your index finger creates a clean bar on fret 1"

============================================================
  SESSION COMPLETE — RL Trajectory Summary
  Steps:  4
  Score:  6.8 → 8.1
  Reward: 0.84
  Saved to: trajectories/latest.jsonl
============================================================
```

## Trajectory Data Format

Each session produces a trajectory in JSONL:

```json
{
  "song": "Smoke on the Water by Deep Purple",
  "steps": [
    {
      "step": 1,
      "timestamp": 6.6,
      "bar_context": "Bar 1-4: G5 - Bb5 - C5 | Main Riff",
      "coaching_tip": "Smooth out the transition to the Bb5 chord and relax your fretting hand",
      "metrics": {
        "pitchAccuracy": 0.71,
        "timing": 0.67,
        "fingerPosition": 0.66
      },
      "composite_score": 6.83,
      "reward": 0.683
    }
  ],
  "total_reward": 0.806,
  "final_score": 8.07,
  "num_steps": 6,
  "duration_s": 112.5
}
```

## As a Verifiers Environment

Dexter RL implements `verifiers.MultiTurnEnv` for direct use with prime-rl:

```python
from dexter_rl import load_environment

env = load_environment(max_turns=10)
```

Or in a prime-rl config:

```toml
[[env]]
id = "dexter/music-coach"
args = { max_turns = 10 }
```

**Episode structure:**

| Component | Description |
|-----------|-------------|
| **State** | Guitar tabs + score history from Gemini evaluations |
| **Action** | A single coaching tip (LLM text output) |
| **Observation** | Gemini's multimodal evaluation of the student's attempt |
| **Reward** | Score improvement normalized to [-1, 1] |
| **Termination** | Score >= 8/10 or max turns reached |

The environment scrapes tabs from Ultimate Guitar via Browserbase, sends coaching tips to the student through a WebSocket bridge, and uses Gemini's multimodal API to evaluate each attempt (audio → pitch accuracy, timing, rhythm → score 1-10).

## Module Reference

| Module | Purpose |
|--------|---------|
| `dexter_rl/env.py` | `MusicCoachEnv` — verifiers multi-turn environment |
| `dexter_rl/evaluator.py` | Gemini multimodal scoring (audio → 1-10 score) |
| `dexter_rl/tabs.py` | Browserbase + Playwright tab scraping |
| `dexter_rl/bridge.py` | WebSocket bridge to Expo app |
| `dexter_rl/rewards.py` | Improvement reward (Δ score) + absolute score |
| `dexter_agent/token_server.py` | Dev server with RL trajectory endpoints |
| `dexter_agent/agent.py` | LiveKit agent for real-time Gemini coaching |
| `dexter_app/` | Expo React Native app (student interface) |

## Quick Start

```bash
# Install RL environment
uv sync

# Install agent dependencies
cd dexter_agent && uv venv && uv pip install -r requirements.txt

# Install app dependencies
cd dexter_app && npm install

# Set environment variables
export GOOGLE_API_KEY="your-key"
export BROWSERBASE_API_KEY="your-key"
export BROWSERBASE_PROJECT_ID="your-project-id"

# Start the trajectory server
cd dexter_agent && .venv/bin/python token_server.py

# Start the app (separate terminal)
cd dexter_app && npx expo start --web

# Run the full RL environment
uv run python scripts/demo.py
```

## Tech Stack

- **RL Framework**: [Prime Intellect verifiers](https://github.com/PrimeIntellect-ai/verifiers) — multi-turn environment with rubric-based rewards
- **AI Coaching**: Google Gemini 2.5 Flash — multimodal (camera frames + audio data + text context)
- **Student App**: Expo / React Native — real-time audio analysis, camera capture, tab notation
- **Tab Scraping**: Browserbase + Playwright — headless browser scraping from Ultimate Guitar
- **Audio Analysis**: Web Audio API — pitch detection (autocorrelation), amplitude, spectral clarity
- **Data Format**: JSONL trajectories compatible with HuggingFace datasets
