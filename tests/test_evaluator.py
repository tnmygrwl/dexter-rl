import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_evaluate_returns_score_and_feedback():
    """Evaluator should return a dict with score (1-10) and feedback string."""
    from dexter_rl.evaluator import GeminiEvaluator

    mock_response = MagicMock()
    mock_response.text = json.dumps({"score": 6, "feedback": "Good timing but sloppy transitions."})

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
