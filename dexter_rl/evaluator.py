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
