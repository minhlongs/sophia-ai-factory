"""
Runpod Serverless Handler — HunyuanVideo 1.5 FP8

Accepts: { prompts: list[str], duration: int, fps: int }
Outputs: { r2_key: str, download_url: str }

GPU requirement: NVIDIA A100 80GB
Model: HunyuanVideo 1.5 (FP8 quantized, ~30fps, 1216x704)
"""

from __future__ import annotations

import os
import tempfile
import time
from typing import Any, Dict, List

import boto3
import runpod
import torch

# HunyuanVideo imports — available in the Runpod container image
try:
    from hyvideo.inference import HunyuanVideoSampler
    from hyvideo.utils.file_utility import save_videos_grid
    HUNYUAN_AVAILABLE = True
except ImportError:
    HUNYUAN_AVAILABLE = False

R2_ENDPOINT = os.environ.get("R2_ENDPOINT", "")
R2_ACCESS_KEY = os.environ.get("R2_ACCESS_KEY_ID", "")
R2_SECRET_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET = os.environ.get("R2_BUCKET", "sophia-videos")
MODEL_PATH = os.environ.get("MODEL_PATH", "/models/hunyuanvideo")


def get_s3_client() -> Any:
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        region_name="auto",
    )


def upload_to_r2(local_path: str, r2_key: str) -> str:
    """Upload video file to R2 and return the object key."""
    s3 = get_s3_client()
    with open(local_path, "rb") as f:
        s3.upload_fileobj(f, R2_BUCKET, r2_key, ExtraArgs={"ContentType": "video/mp4"})
    return r2_key


def handler(job: Dict[str, Any]) -> Dict[str, Any]:
    """Runpod serverless job handler."""
    job_input = job.get("input", {})
    prompts: List[str] = job_input.get("prompts", ["A professional product showcase"])
    duration: int = int(job_input.get("duration", 30))
    fps: int = int(job_input.get("fps", 30))
    job_id: str = job.get("id", str(int(time.time())))

    r2_key = f"runpod/{job_id}/visual.mp4"

    if not HUNYUAN_AVAILABLE:
        return {"error": "HunyuanVideo not installed in this container", "r2_key": None}

    # Combine prompts into a single generation prompt (use first 3)
    prompt_text = ". ".join(prompts[:3])
    num_frames = duration * fps

    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = f"{tmpdir}/output.mp4"

        sampler = HunyuanVideoSampler.from_pretrained(
            MODEL_PATH,
            args={"precision": "fp8"},
        )
        outputs = sampler.predict(
            prompt=prompt_text,
            height=720,
            width=1280,
            video_length=num_frames,
            seed=42,
            num_inference_steps=50,
            guidance_scale=6.0,
            flow_shift=7.0,
            embedded_guidance_scale=6.0,
        )
        samples = outputs["samples"]
        save_videos_grid(samples, output_path, fps=fps)

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        upload_to_r2(output_path, r2_key)

    # Return presigned download URL (valid 1h)
    s3 = get_s3_client()
    download_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": R2_BUCKET, "Key": r2_key},
        ExpiresIn=3600,
    )

    return {"r2_key": r2_key, "download_url": download_url}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
