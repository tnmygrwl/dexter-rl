import json
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
        super().__init__(
            dataset=dataset,
            rubric=rubric,
            max_turns=max_turns,
            **kwargs,
        )
        self.evaluator = GeminiEvaluator()
        self.tab_scraper = TabScraper()
        self.bridge = ExpoBridge(port=bridge_port)

    async def setup_state(self, state: State) -> State:
        state = await super().setup_state(state)
        info = state.get("info", {})
        if isinstance(info, str):
            info = json.loads(info)
        song = info.get("song", state.get("task", "Unknown"))
        instrument = info.get("instrument", "guitar")
        artist = info.get("artist", "Unknown")

        tabs = await self.tab_scraper.scrape(song, instrument)
        state["scores"] = []
        state["tabs"] = tabs
        state["song"] = song
        state["artist"] = artist
        state["instrument"] = instrument

        # Update the system prompt in the prompt messages with the tabs
        prompt = state.get("prompt", [])
        if prompt and isinstance(prompt, list) and prompt[0].get("role") == "system":
            prompt[0]["content"] = SYSTEM_PROMPT.format(
                song=song,
                artist=artist,
                instrument=instrument,
                tabs=tabs,
            )

        await self.bridge.start()
        await self.bridge.wait_for_client(timeout=300)
        await self.bridge.send_tabs(tabs)

        return state

    @vf.stop
    async def student_mastered(self, state: State) -> bool:
        """Stop if the student has reached a score of 8 or higher."""
        scores = state.get("scores", [])
        if scores and scores[-1] >= 8:
            return True
        return False

    async def env_response(self, messages: Messages, state: State, **kwargs) -> Messages:
        # Extract the last assistant message (the coaching tip)
        last_assistant = None
        for m in reversed(messages):
            if isinstance(m, dict) and m.get("role") == "assistant":
                content = m.get("content", "")
                if isinstance(content, list):
                    # Handle structured content (list of parts)
                    last_assistant = " ".join(
                        p.get("text", "") for p in content if isinstance(p, dict)
                    )
                else:
                    last_assistant = content
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
        return [env_msg]


def _format_dataset(dataset: Dataset) -> Dataset:
    """Format the songs dataset for the verifiers Environment.

    Adds a 'question' column (the initial prompt to the model) and an 'info'
    column that packs song metadata for access during rollouts.
    """
    def add_fields(example):
        example["question"] = (
            f"The student is about to attempt playing {example['song']} "
            f"by {example['artist']} on {example['instrument']}. "
            f"Please provide your first coaching tip."
        )
        example["info"] = json.dumps({
            "song": example["song"],
            "artist": example["artist"],
            "instrument": example["instrument"],
        })
        example["answer"] = ""
        return example

    return dataset.map(add_fields)


def load_environment(**kwargs) -> MusicCoachEnv:
    dataset = Dataset.from_json("datasets/songs.jsonl")
    dataset = _format_dataset(dataset)

    rubric = vf.Rubric(
        funcs=[improvement_reward, absolute_score],
        weights=[1.0, 0.0],
    )

    return MusicCoachEnv(
        dataset=dataset,
        rubric=rubric,
        max_turns=kwargs.pop("max_turns", 10),
        system_prompt="You are an expert music coach.",
        **kwargs,
    )
