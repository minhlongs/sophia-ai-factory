"""
MoviePy Render Service
Provides /render and /compose endpoints for Sophia video pipeline.
"""

from __future__ import annotations

import io
import os
import tempfile
from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from moviepy.editor import (
    AudioFileClip,
    ColorClip,
    CompositeVideoClip,
    TextClip,
    VideoFileClip,
    concatenate_videoclips,
)
from pydantic import BaseModel

app = FastAPI(title="sophia-moviepy-render", version="1.0.0")

R2_BASE_URL = os.environ.get("R2_BASE_URL", "")


class RenderRequest(BaseModel):
    templateId: str
    audio_r2_key: str
    scenes: List[str]
    output_format: str = "mp4"


class ComposeRequest(BaseModel):
    audio_r2_key: str
    visual_r2_key: str
    subtitle_srt: Optional[str] = ""
    output_format: str = "mp4"


async def fetch_r2_object(key: str) -> bytes:
    """Download object from R2 public URL or direct URL."""
    url = f"{R2_BASE_URL}/{key}" if R2_BASE_URL else key
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/render")
async def render(req: RenderRequest) -> StreamingResponse:
    """Render template video: text overlays on color background + audio."""
    try:
        audio_bytes = await fetch_r2_object(req.audio_r2_key)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch audio: {exc}") from exc

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.wav")
        output_path = os.path.join(tmpdir, "output.mp4")

        with open(audio_path, "wb") as f:
            f.write(audio_bytes)

        audio_clip = AudioFileClip(audio_path)
        duration = audio_clip.duration

        # Build scene clips from text overlays
        per_scene = duration / max(len(req.scenes), 1)
        clips = []
        for scene_text in req.scenes:
            bg = ColorClip(size=(1280, 720), color=(10, 10, 10), duration=per_scene)
            txt = TextClip(
                scene_text[:120],
                fontsize=40,
                color="white",
                font="Noto-Sans",
                method="caption",
                size=(1100, None),
            ).set_duration(per_scene).set_position("center")
            clips.append(CompositeVideoClip([bg, txt]))

        video = concatenate_videoclips(clips)
        video = video.set_audio(audio_clip)
        video.write_videofile(output_path, fps=30, codec="libx264", audio_codec="aac", logger=None)
        audio_clip.close()

        with open(output_path, "rb") as f:
            content = f.read()

    return StreamingResponse(io.BytesIO(content), media_type="video/mp4")


@app.post("/compose")
async def compose(req: ComposeRequest) -> StreamingResponse:
    """Compose audio + visual + optional subtitle into final MP4."""
    try:
        audio_bytes = await fetch_r2_object(req.audio_r2_key)
        visual_bytes = await fetch_r2_object(req.visual_r2_key)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch assets: {exc}") from exc

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.wav")
        visual_path = os.path.join(tmpdir, "visual.mp4")
        output_path = os.path.join(tmpdir, "final.mp4")

        with open(audio_path, "wb") as f:
            f.write(audio_bytes)
        with open(visual_path, "wb") as f:
            f.write(visual_bytes)

        video = VideoFileClip(visual_path)
        audio = AudioFileClip(audio_path)
        final = video.set_audio(audio)
        final.write_videofile(output_path, fps=30, codec="libx264", audio_codec="aac", logger=None)
        video.close()
        audio.close()

        with open(output_path, "rb") as f:
            content = f.read()

    return StreamingResponse(io.BytesIO(content), media_type="video/mp4")
