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
