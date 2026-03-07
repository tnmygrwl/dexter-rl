#!/usr/bin/env python3
"""Dexter RL -- Hackathon Demo Script

Runs the full music coaching pipeline:
  1. Loads the MusicCoachEnv with song dataset
  2. Scrapes guitar tabs via Browserbase
  3. Waits for the Expo mobile app to connect via WebSocket
  4. Loops: Gemini generates coaching tips -> student plays -> Gemini evaluates
  5. Prints score progression after each attempt
  6. Stops when score >= 8 or max turns reached

Required environment variables:
    GOOGLE_API_KEY           - Google AI / Gemini API key
    BROWSERBASE_API_KEY      - Browserbase API key
    BROWSERBASE_PROJECT_ID   - Browserbase project ID
"""

import asyncio
import json
import os
import sys
import time

from google import genai


REQUIRED_ENV_VARS = [
    "GOOGLE_API_KEY",
    "BROWSERBASE_API_KEY",
    "BROWSERBASE_PROJECT_ID",
]

COACHING_PROMPT = """You are an expert music coach. Given the evaluation below, provide ONE specific, actionable tip.

Tabs:
{tabs}

{eval_context}

Respond with just the coaching tip (2-3 sentences). Be encouraging but precise."""


# -- Terminal helpers -------------------------------------------------------

def banner():
    print()
    print("=" * 60)
    print("    DEXTER RL  --  AI Music Coach Demo")
    print("=" * 60)
    print()


def check_env():
    missing = [v for v in REQUIRED_ENV_VARS if not os.environ.get(v)]
    if missing:
        print("ERROR: Missing required environment variables:\n")
        for v in missing:
            print(f"    export {v}=<your-value>")
        print()
        sys.exit(1)
    print("[ok] All required environment variables are set.")


def print_scores(scores):
    bar_width = 40
    print()
    print("  Score Progression")
    print("  " + "-" * (bar_width + 12))
    for i, s in enumerate(scores, 1):
        filled = int((s / 10) * bar_width)
        bar = "#" * filled + "." * (bar_width - filled)
        delta = ""
        if i > 1:
            diff = s - scores[i - 2]
            delta = f"  ({'+' if diff >= 0 else ''}{diff})"
        print(f"  Turn {i:2d} | [{bar}] {s:2d}/10{delta}")
    print("  " + "-" * (bar_width + 12))
    print()


# -- Core loop --------------------------------------------------------------

async def run_demo():
    banner()
    check_env()

    # Lazy import so env-var check runs first
    from dexter_rl.env import load_environment

    max_turns = 10
    target_score = 8

    print(f"\n[*] Loading environment (max_turns={max_turns}) ...")
    env = load_environment(max_turns=max_turns)

    # Pick the first song from the dataset
    dataset = env.dataset
    row = dataset[0]
    song = row.get("song", row.get("task", "Unknown"))
    artist = row.get("artist", "Unknown")
    instrument = row.get("instrument", "guitar")

    print(f"[*] Song: {song} by {artist} ({instrument})")
    print(f"[*] Target score: {target_score}/10\n")

    # Build initial state (mimics what verifiers does internally)
    info = {"song": song, "artist": artist, "instrument": instrument}
    state = {
        "prompt": [
            {"role": "system", "content": "placeholder"},
            {"role": "user", "content": f"Coach the student on {song} by {artist}."},
        ],
        "task": song,
        "info": info,
    }

    print("[*] Scraping tabs via Browserbase ...")
    state = await env.setup_state(state)
    tabs = state.get("tabs", "")
    print(f"[ok] Tabs loaded ({len(tabs)} chars).\n")

    print("=" * 60)
    print("  Waiting for Expo app to connect on ws://0.0.0.0:8765 ...")
    print("  Open the Dexter app on your phone and tap 'Connect'.")
    print("=" * 60)
    print()

    # Gemini client for generating coaching tips (acts as the "agent")
    gemini = genai.Client()
    model = "gemini-2.5-flash"

    scores = state["scores"]
    turn = 0

    while turn < max_turns:
        turn += 1
        print(f"--- Turn {turn}/{max_turns} " + "-" * 40)

        # Build context for the coaching tip
        if not scores:
            eval_context = "This is the student's first attempt. Give an opening tip."
        else:
            last = scores[-1]
            history = " -> ".join(str(s) for s in scores)
            eval_context = f"Latest score: {last}/10. History: {history}."

        # Generate coaching tip with Gemini
        print("[*] Generating coaching tip ...")
        prompt = COACHING_PROMPT.format(tabs=tabs, eval_context=eval_context)
        response = await gemini.aio.models.generate_content(
            model=model,
            contents=prompt,
        )
        tip = response.text.strip()
        print(f"\n    Coach says: {tip}\n")

        # Feed through the env as an assistant message
        messages = [{"role": "assistant", "content": tip}]
        env_msgs = await env.env_response(messages, state)

        # Extract score from latest env message
        latest_score = scores[-1] if scores else 0
        print(f"[*] Student scored: {latest_score}/10")

        if scores:
            print_scores(scores)

        # Check mastery
        if latest_score >= target_score:
            print("=" * 60)
            print(f"  MASTERY REACHED!  Final score: {latest_score}/10")
            print(f"  Total turns: {turn}")
            print("=" * 60)
            break
    else:
        print("=" * 60)
        print(f"  Max turns reached.  Final score: {scores[-1] if scores else 'N/A'}/10")
        print(f"  Scores: {' -> '.join(str(s) for s in scores)}")
        print("=" * 60)

    # Cleanup
    await env.bridge.stop()
    print("\n[*] Bridge stopped. Demo complete.\n")


if __name__ == "__main__":
    asyncio.run(run_demo())
