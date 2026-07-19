"""
Coqui XTTS v2 FastAPI Server

POST /synth — Synthesize speech from text.
GET  /health — Health check.

Environment variables:
  COQUI_INTERNAL_TOKEN — validates x-internal-token header (optional in dev).
  MODEL_NAME           — override model, default "tts_models/multilingual/multi-dataset/xtts_v2"
"""

import io
import os
import struct
import wave
import logging
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Coqui TTS Service", version="1.0.0")

INTERNAL_TOKEN = os.getenv("COQUI_INTERNAL_TOKEN", "")
MODEL_NAME = os.getenv("MODEL_NAME", "tts_models/multilingual/multi-dataset/xtts_v2")

# Lazy-loaded TTS model
_tts_model = None


def get_tts() -> "TTS":  # type: ignore[name-defined]
    global _tts_model
    if _tts_model is None:
        from TTS.api import TTS  # type: ignore[import]
        logger.info("Loading XTTS v2 model: %s", MODEL_NAME)
        _tts_model = TTS(MODEL_NAME)
        logger.info("XTTS v2 model loaded.")
    return _tts_model


def verify_token(x_internal_token: str) -> None:
    if not INTERNAL_TOKEN:
        return  # Dev mode
    if x_internal_token != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


class SynthRequest(BaseModel):
    text: str
    voice_ref_url: Optional[str] = None
    language: str = "en"


def wav_bytes_to_duration(wav_buf: bytes) -> float:
    """Extract duration in seconds from raw WAV bytes."""
    try:
        with wave.open(io.BytesIO(wav_buf)) as wf:
            return wf.getnframes() / wf.getframerate()
    except Exception:
        return 0.0


@app.post("/synth")
async def synthesize(
    body: SynthRequest,
    x_internal_token: str = Header(default=""),
) -> Response:
    verify_token(x_internal_token)

    if not body.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    tts = get_tts()

    buf = io.BytesIO()
    tts.tts_to_file(
        text=body.text,
        language=body.language,
        speaker_wav=body.voice_ref_url,
        file_path=buf,
    )
    buf.seek(0)
    wav_data = buf.read()
    duration = wav_bytes_to_duration(wav_data)

    logger.info("Synthesized %.2fs audio, %d bytes", duration, len(wav_data))

    return Response(
        content=wav_data,
        media_type="audio/wav",
        headers={"x-duration-sec": str(round(duration, 3))},
    )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME}
