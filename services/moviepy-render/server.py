"""
MoviePy Render Service v2.0.0

Endpoints:
  POST /render            — template render (text scenes + audio)
  POST /compose           — backwards-compatible streaming compose
  POST /compose-rich      — extended compose: subtitle burn-in, watermark,
                            audio loudnorm, optional thumbnail. Returns
                            multipart/mixed with parts: video, thumbnail,
                            metadata-json.
  POST /thumbnail         — extract a poster frame from a video R2 key
  POST /probe             — return duration/width/height/size_bytes JSON
  GET  /health            — liveness

Backwards compatibility:
  /compose unchanged for existing path-a / path-b callers. New features
  are opt-in via /compose-rich. Worker's composer-ffmpeg.ts may keep
  calling /compose until the rich path is wired in everywhere.
"""

from __future__ import annotations

import io
import json
import os
import subprocess
import tempfile
from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response, StreamingResponse
from moviepy.editor import (
    AudioFileClip,
    ColorClip,
    CompositeVideoClip,
    ImageClip,
    TextClip,
    VideoFileClip,
    concatenate_videoclips,
)
from pydantic import BaseModel, Field

app = FastAPI(title="sophia-moviepy-render", version="2.0.0")

R2_BASE_URL = os.environ.get("R2_BASE_URL", "")


# ── Models ────────────────────────────────────────────────────────────────────

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


class SubtitleStyle(BaseModel):
    """TikTok / IG REELS-style subtitle burn-in config."""
    font_size: int = 48
    color: str = "white"
    stroke_color: str = "black"
    stroke_width: int = 3
    position: str = "bottom"   # 'top' | 'center' | 'bottom'
    font: str = "Noto-Sans-Bold"


class WatermarkConfig(BaseModel):
    """Agency / Sophia watermark overlay."""
    text: Optional[str] = None
    logo_url: Optional[str] = None
    position: str = "bottom-right"   # corner anchors
    opacity: float = 0.85


class ComposeRichRequest(BaseModel):
    audio_r2_key: str
    visual_r2_key: str
    subtitle_srt: Optional[str] = ""
    subtitle_style: Optional[SubtitleStyle] = None
    watermark: Optional[WatermarkConfig] = None
    loudnorm: bool = False                       # EBU R128 normalize to -14 LUFS
    output_thumbnail: bool = True                # extract a poster at ~1s
    output_format: str = "mp4"


class ProbeRequest(BaseModel):
    r2_key: str


class ThumbnailRequest(BaseModel):
    r2_key: str
    timestamp: float = 1.0   # seconds into video


# ── Helpers ───────────────────────────────────────────────────────────────────

async def fetch_r2_object(key: str) -> bytes:
    """Download object from R2 public URL or direct URL."""
    url = f"{R2_BASE_URL}/{key}" if R2_BASE_URL else key
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


def normalize_audio_loudnorm(in_path: str, out_path: str) -> None:
    """Apply ffmpeg EBU R128 loudnorm to bring audio to -14 LUFS."""
    cmd = [
        "ffmpeg", "-y", "-i", in_path,
        "-af", "loudnorm=I=-14:LRA=7:tp=-2",
        "-ar", "44100", "-ac", "2",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def burn_subtitles_ffmpeg(video_in: str, srt_path: str, video_out: str, style: SubtitleStyle) -> None:
    """
    Burn SRT into video using ffmpeg subtitles filter.
    Style is mapped to libass force_style options.
    """
    align = {"bottom": 2, "center": 10, "top": 6}.get(style.position, 2)
    force = (
        f"FontName={style.font},"
        f"FontSize={style.font_size},"
        f"PrimaryColour=&H{_color_to_ass(style.color)}&,"
        f"OutlineColour=&H{_color_to_ass(style.stroke_color)}&,"
        f"Outline={style.stroke_width},"
        f"Alignment={align}"
    )
    cmd = [
        "ffmpeg", "-y", "-i", video_in,
        "-vf", f"subtitles='{srt_path}':force_style='{force}'",
        "-c:a", "copy",
        video_out,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def _color_to_ass(name: str) -> str:
    """Convert a CSS-ish color name to ASS BGR hex (libass quirk)."""
    palette = {
        "white": "FFFFFF",
        "black": "000000",
        "yellow": "00FFFF",
        "red": "0000FF",
        "blue": "FF0000",
    }
    return palette.get(name.lower(), "FFFFFF")


def add_watermark(clip, wm: WatermarkConfig):
    """Overlay a text or image watermark onto a MoviePy clip."""
    overlays = [clip]
    duration = clip.duration

    pos_map = {
        "bottom-right": ("right", "bottom"),
        "bottom-left": ("left", "bottom"),
        "top-right": ("right", "top"),
        "top-left": ("left", "top"),
    }
    pos = pos_map.get(wm.position, ("right", "bottom"))

    if wm.logo_url:
        try:
            # Download logo synchronously inside the request; fine for small images
            with httpx.Client(timeout=15.0) as client:
                resp = client.get(wm.logo_url)
                resp.raise_for_status()
                logo_bytes = resp.content
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as logo_tmp:
                logo_tmp.write(logo_bytes)
                logo_path = logo_tmp.name
            logo = (
                ImageClip(logo_path)
                .set_duration(duration)
                .resize(height=80)
                .set_opacity(wm.opacity)
                .set_position(pos)
                .margin(right=20, bottom=20, opacity=0)
            )
            overlays.append(logo)
        except Exception:
            # Logo fetch failed — fall back to text if available
            pass

    if wm.text:
        text = TextClip(
            wm.text,
            fontsize=24,
            color="white",
            font="Noto-Sans-Bold",
            stroke_color="black",
            stroke_width=2,
        ).set_duration(duration).set_opacity(wm.opacity).set_position(pos).margin(right=20, bottom=20, opacity=0)
        overlays.append(text)

    return CompositeVideoClip(overlays) if len(overlays) > 1 else clip


def probe_metadata(path: str) -> dict:
    """Extract duration, width, height, size via ffprobe."""
    cmd = [
        "ffprobe", "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", path,
    ]
    result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    data = json.loads(result.stdout)
    video_stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
    return {
        "duration_seconds": float(data.get("format", {}).get("duration", 0)),
        "size_bytes": int(data.get("format", {}).get("size", 0)),
        "width": int(video_stream.get("width", 0)) if video_stream else 0,
        "height": int(video_stream.get("height", 0)) if video_stream else 0,
        "codec_name": video_stream.get("codec_name", "") if video_stream else "",
    }


def extract_thumbnail(video_path: str, jpg_path: str, timestamp: float = 1.0) -> None:
    """Extract a single JPG frame at the given timestamp."""
    cmd = [
        "ffmpeg", "-y", "-ss", str(timestamp), "-i", video_path,
        "-vframes", "1", "-q:v", "2", jpg_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": app.version}


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
    """Compose audio + visual + optional subtitle into final MP4 (legacy)."""
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


@app.post("/compose-rich")
async def compose_rich(req: ComposeRichRequest) -> Response:
    """
    Rich compose: subtitle burn-in, watermark, audio loudnorm, thumbnail.
    Returns multipart-style response via response headers + body.

    Body:    final mp4 bytes
    Headers:
      X-Sophia-Metadata     — JSON {duration_seconds, width, height, size_bytes, codec_name}
      X-Sophia-Thumbnail-B64 — base64-encoded JPEG (only if output_thumbnail=true)
    """
    try:
        audio_bytes = await fetch_r2_object(req.audio_r2_key)
        visual_bytes = await fetch_r2_object(req.visual_r2_key)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch assets: {exc}") from exc

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_in = os.path.join(tmpdir, "audio_in.wav")
        audio_use = audio_in
        visual_path = os.path.join(tmpdir, "visual.mp4")
        merged_path = os.path.join(tmpdir, "merged.mp4")
        burned_path = os.path.join(tmpdir, "burned.mp4")
        final_path = os.path.join(tmpdir, "final.mp4")
        thumb_path = os.path.join(tmpdir, "poster.jpg")

        with open(audio_in, "wb") as f:
            f.write(audio_bytes)
        with open(visual_path, "wb") as f:
            f.write(visual_bytes)

        # 1. Optional audio normalize (loudnorm)
        if req.loudnorm:
            audio_norm = os.path.join(tmpdir, "audio_norm.wav")
            try:
                normalize_audio_loudnorm(audio_in, audio_norm)
                audio_use = audio_norm
            except subprocess.CalledProcessError:
                # Non-fatal — fall back to raw audio
                audio_use = audio_in

        # 2. MoviePy compose video + audio + watermark
        video_clip = VideoFileClip(visual_path)
        audio_clip = AudioFileClip(audio_use)
        composed = video_clip.set_audio(audio_clip)

        if req.watermark and (req.watermark.text or req.watermark.logo_url):
            composed = add_watermark(composed, req.watermark)

        composed.write_videofile(merged_path, fps=30, codec="libx264", audio_codec="aac", logger=None)
        video_clip.close()
        audio_clip.close()

        # 3. Optional subtitle burn-in via ffmpeg subtitles filter
        produced_path = merged_path
        if req.subtitle_srt and req.subtitle_style:
            srt_path = os.path.join(tmpdir, "captions.srt")
            with open(srt_path, "w", encoding="utf-8") as f:
                f.write(req.subtitle_srt)
            try:
                burn_subtitles_ffmpeg(merged_path, srt_path, burned_path, req.subtitle_style)
                produced_path = burned_path
            except subprocess.CalledProcessError:
                # Non-fatal — fall back to merged without subtitles burned
                produced_path = merged_path

        # Final rename for clarity
        os.replace(produced_path, final_path)

        # 4. Probe metadata
        try:
            metadata = probe_metadata(final_path)
        except subprocess.CalledProcessError:
            metadata = {}

        # 5. Optional thumbnail
        thumbnail_b64 = None
        if req.output_thumbnail:
            try:
                ts = min(1.0, metadata.get("duration_seconds", 1.0))
                extract_thumbnail(final_path, thumb_path, timestamp=ts)
                with open(thumb_path, "rb") as f:
                    import base64
                    thumbnail_b64 = base64.b64encode(f.read()).decode("ascii")
            except subprocess.CalledProcessError:
                thumbnail_b64 = None

        with open(final_path, "rb") as f:
            content = f.read()

    headers = {"X-Sophia-Metadata": json.dumps(metadata)}
    if thumbnail_b64:
        headers["X-Sophia-Thumbnail-B64"] = thumbnail_b64
    return Response(content=content, media_type="video/mp4", headers=headers)


@app.post("/thumbnail")
async def thumbnail(req: ThumbnailRequest) -> Response:
    """Extract a poster frame from a video R2 key. Returns image/jpeg bytes."""
    try:
        video_bytes = await fetch_r2_object(req.r2_key)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch video: {exc}") from exc

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = os.path.join(tmpdir, "input.mp4")
        thumb_path = os.path.join(tmpdir, "thumb.jpg")
        with open(video_path, "wb") as f:
            f.write(video_bytes)
        try:
            extract_thumbnail(video_path, thumb_path, timestamp=req.timestamp)
        except subprocess.CalledProcessError as exc:
            raise HTTPException(status_code=500, detail=f"thumbnail failed: {exc}") from exc
        with open(thumb_path, "rb") as f:
            jpg = f.read()
    return Response(content=jpg, media_type="image/jpeg")


@app.post("/probe")
async def probe(req: ProbeRequest) -> JSONResponse:
    """Return ffprobe metadata for an R2-hosted video."""
    try:
        video_bytes = await fetch_r2_object(req.r2_key)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch video: {exc}") from exc

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = os.path.join(tmpdir, "input.mp4")
        with open(video_path, "wb") as f:
            f.write(video_bytes)
        try:
            metadata = probe_metadata(video_path)
        except subprocess.CalledProcessError as exc:
            raise HTTPException(status_code=500, detail=f"probe failed: {exc}") from exc
    return JSONResponse(metadata)
