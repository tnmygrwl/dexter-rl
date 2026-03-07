# Dexter Agent — LiveKit + Gemini Guitar Coach

Backend agent that joins a LiveKit room alongside the Expo app,
receives the student's camera + audio, forwards them to Google Gemini's
multimodal live API, and sends coaching feedback back via data channel.

## Setup

```bash
cd dexter_agent

# Create a virtual env
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Copy and fill in your env
cp .env.example .env
# → set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, GOOGLE_API_KEY
```

## Running

You need **two** processes running:

### 1. Token server (for the Expo app to get join tokens)

```bash
python token_server.py
# → http://localhost:8081/token?room=dexter-practice&identity=student
```

### 2. LiveKit agent (joins rooms and runs Gemini)

```bash
python agent.py dev
```

Then in the Expo app, tap "Start Bar" — the app fetches a token from
the token server, connects to the LiveKit room, the agent auto-joins
and begins analyzing your playing.
