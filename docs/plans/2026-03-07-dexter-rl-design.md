# Dexter RL: Design Document

## One-Liner

An RL environment for training AI music coaches, where the reward signal comes from real human improvement measured by Gemini multimodal.

## Pitch

Gemini Live teaches you guitar. Every interaction — every coaching decision, every human attempt, every improvement — is captured as an RL trajectory. We publish this as an environment to Prime Intellect's Environments Hub so any lab can train their model to become a better music teacher than Gemini, using Gemini's own evaluation as the reward signal.

"Can your model teach guitar better than Gemini? Here's the environment to find out."

## Architecture

### Unified Pipeline

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
|                                    |
|  Logged as training trajectories   |
+------------------------------------+
```

One pipeline, two uses:
- **Demo**: Gemini Live coaches, RL env captures trajectories in real-time. Audience sees reward signal updating as the human improves.
- **Training**: A lab's model replaces Gemini as the coach. Same pipeline, same reward. The env handles the swap transparently.

### Components

| Component | Owner | Tech |
|-----------|-------|------|
| Expo app (UI, audio capture, display tabs/tips) | Collaborator | Expo / React Native |
| Tab scraping | You | Browserbase + Playwright |
| Gemini evaluation (reward signal) | You | Gemini multimodal API |
| RL environment | You | Prime Intellect `verifiers` |
| WebSocket bridge (Expo <-> RL env) | You | Python asyncio + websockets |

### Directory Structure

```
dexter-rl/
  dexter_rl/                  # RL environment package
    __init__.py               # load_environment() entry point
    env.py                    # MusicCoachEnv (verifiers StatefulToolEnv)
    rewards.py                # Rubric: improvement reward + metrics
    tabs.py                   # Browserbase tab scraping
    evaluator.py              # Gemini multimodal evaluation
    bridge.py                 # WebSocket bridge to Expo app
  dexter_app/                 # Collaborator's Expo app
  datasets/
    songs.jsonl               # {"song": "Wonderwall", "instrument": "guitar"}
  pyproject.toml
  README.md
```

## RL Environment Design (verifiers)

### Framework: Prime Intellect `verifiers`

Not Gymnasium. The LLM RL ecosystem has converged on message-based environments where observations are chat messages, actions are LLM completions, and execution is async. `verifiers` is the framework used to train INTELLECT-2 and INTELLECT-3, with an Environments Hub for publishing.

### Class: `MusicCoachEnv(vf.StatefulToolEnv)`

StatefulToolEnv because we need:
- Per-rollout mutable state (score history, WebSocket connection, Gemini session)
- Tool calling (agent can request tab display, view score history)

### Episode Flow (Turn-Based)

```
Turn 1:
  System: "You are coaching a guitar student learning 'Wonderwall'.
           Tabs: [Em, G, D, A7sus4...]
           Student just played. Evaluation: 'Timing off on chord
           transition in bar 2. Score: 3/10'"
  Agent:  "Slow down between bars 1-2. Count 1-2-3-4 out loud."

  [env: show tip to human via Expo app]
  [env: human plays again]
  [env: Gemini evaluates the new attempt]

Turn 2:
  System: "New evaluation: 'Timing improved on bar 2 but strumming
           pattern inconsistent. Score: 5/10' (Improvement: +2)"
  Agent:  "Good progress! Focus on down-up-down strumming pattern."

  ...repeat until score > 8/10 or max_turns (10) reached

Reward: cumulative score improvement across all turns
```

### Observation (what the agent sees)

Chat message sequence containing:
- System prompt with role description
- Current tabs (text)
- Gemini's evaluation of the latest attempt (text + numeric score)
- Score history (previous scores for this episode)
- Attempt number

### Action (what the agent produces)

LLM text completion: a single coaching tip in natural language. May also include tool calls (request specific tab section, ask to see score trend).

### Reward Signal

```python
async def improvement_reward(completion, answer, state) -> float:
    current_score = state["scores"][-1]
    prev_score = state["scores"][-2] if len(state["scores"]) > 1 else 0
    return (current_score - prev_score) / 10.0  # Normalized to [0, 1]
```

Additional metrics (tracked but zero-weight):
- Absolute score
- Total attempts
- Improvement trajectory (monotonic?)

### Gemini Evaluation (Reward Computation)

Send audio recording + tabs to Gemini multimodal (non-Live, standard API) with a structured prompt:

```
You are evaluating a guitar student's attempt at playing a passage.

Tabs for this passage:
{tabs}

Listen to the audio and evaluate:
1. Pitch accuracy (are they playing the right notes?)
2. Timing (are transitions between chords smooth?)
3. Rhythm (is the strumming pattern correct?)

Return JSON: {"score": <1-10>, "feedback": "<2 sentence evaluation>"}
```

This is separate from Gemini Live (which handles real-time coaching in the Expo app). The standard multimodal API gives us structured, deterministic-ish scoring suitable for reward computation.

### Bridge to Expo App

WebSocket server in the RL env. Protocol:

```
Env -> App:  {"type": "show_tip", "tip": "Focus on bar 2 transition"}
Env -> App:  {"type": "show_tabs", "tabs": "Em G D A7sus4..."}
App -> Env:  {"type": "attempt_complete", "audio_base64": "..."}
App -> Env:  {"type": "session_start", "song": "Wonderwall", "instrument": "guitar"}
```

### Tab Scraping (Browserbase)

On `env.reset()`:
1. Browserbase creates a browser session
2. Navigate to Ultimate Guitar (or similar)
3. Search for song + instrument
4. Extract tab notation
5. Return as structured text

Cached per song to avoid re-scraping across episodes.

## Dataset

Simple JSONL:
```json
{"task": "Wonderwall", "song": "Wonderwall", "artist": "Oasis", "instrument": "guitar"}
{"task": "Blackbird", "song": "Blackbird", "artist": "The Beatles", "instrument": "guitar"}
{"task": "Smoke on the Water", "song": "Smoke on the Water", "artist": "Deep Purple", "instrument": "guitar"}
```

Expandable. The `task` field is what verifiers uses as the problem identifier.

## Integration with prime-rl

Once published to the Environments Hub:

```toml
# prime-rl config
[[env]]
id = "dexter/music-coach"
args = { max_turns = 10, instrument = "guitar" }
```

Labs run:
```bash
prime env install dexter/music-coach
prime train --config config.toml
```

## Hackathon Demo Plan

1. Show the Expo app: pick a song, see tabs, start playing
2. Gemini Live coaches in real-time via the app
3. Split screen: show the RL env logging trajectories live
4. Show the reward signal updating as the human improves
5. "This trajectory is now training data. Any lab can train their model on this."
6. Show the verifiers env code — drop-in compatible with prime-rl

## Constraints

- 3-4 hours total build time
- Collaborator handles Expo app, you handle RL env + infrastructure
- Gemini API key required (hackathon should provide)
- Browserbase API key required (hackathon sponsor)
