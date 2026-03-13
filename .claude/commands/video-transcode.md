---
description: 🎥 Video Transcode — FFmpeg, H.264/H.265, Adaptive Bitrate
argument-hint: [--quality=23] [--format=mp4] [--max-bitrate=5M]
---

**Think harder** để video transcode: <$ARGUMENTS>

**IMPORTANT:** Videos PHẢI optimized — H.264/H.265, adaptive bitrate, lazy load.

## FFmpeg Commands

```bash
# === Basic H.264 Encode ===
ffmpeg -i input.mov -c:v libx264 -crf 23 -c:a aac -b:a 128k output.mp4

# === High Quality (CRF 18) ===
ffmpeg -i input.mov -c:v libx264 -crf 18 -c:a aac output.mp4

# === H.265/HEVC (Better Compression) ===
ffmpeg -i input.mov -c:v libx265 -crf 28 -c:a aac output.mp4

# === Max Bitrate Limit ===
ffmpeg -i input.mov -c:v libx264 -maxrate 5M -bufsize 10M output.mp4

# === Resize to 1080p ===
ffmpeg -i input.mov -c:v libx264 -vf scale=1920:1080 output.mp4

# === Extract Thumbnail ===
ffmpeg -i input.mp4 -ss 00:00:05 -vframes 1 thumbnail.jpg

# === Create GIF ===
ffmpeg -i input.mp4 -vf "fps=10,scale=480:-1" output.gif
```

## Adaptive Bitrate Streaming

```bash
# === Create HLS Playlist ===
ffmpeg -i input.mov \
  -c:v libx264 -c:a aac \
  -start_number 0 -hls_time 10 -hls_list_size 0 \
  -f hls playlist.m3u8

# === Multi-bitrate HLS ===
ffmpeg -i input.mov \
  -c:v libx264 -b:v 5000k -c:a aac -b:a 192k -f hls -hls_time 10 -hls_playlist_type vod output_5000k.m3u8 \
  -c:v libx264 -b:v 2500k -c:a aac -b:a 128k -f hls -hls_time 10 -hls_playlist_type vod output_2500k.m3u8 \
  -c:v libx264 -b:v 1000k -c:a aac -b:a 64k -f hls -hls_time 10 -hls_playlist_type vod output_1000k.m3u8
```

## Related Commands

- `/image-optimize` — Image optimization
- `/perf-audit` — Performance audit
- `/bundle-analyze` — Bundle analysis
