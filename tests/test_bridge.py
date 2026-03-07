import pytest
import json
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
