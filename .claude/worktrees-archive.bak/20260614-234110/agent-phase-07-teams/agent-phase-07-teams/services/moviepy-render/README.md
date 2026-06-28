# sophia-moviepy-render

MoviePy render microservice for Sophia AI Factory video pipeline (Path A — Template).
Runs on Fly.io (region: sin), 4 shared CPUs / 4 GB RAM.

## Endpoints

- `POST /render` — render template video from scenes + audio → mp4 stream
- `POST /compose` — compose audio + visual → final mp4 stream
- `GET /health` — liveness check

## Local dev

```bash
pip install -r requirements.txt
R2_BASE_URL=https://videos.sophia.agencyos.network uvicorn server:app --reload
```

## Deploy

```bash
fly auth login
fly deploy --app sophia-moviepy-render
```

## Environment vars

| Var | Description |
|-----|-------------|
| `R2_BASE_URL` | Public base URL for R2 bucket (e.g., `https://videos.sophia.agencyos.network`) |

## Fonts

Docker image includes `fonts-noto` + `fonts-noto-cjk` for Vietnamese tone marks.
Font name for MoviePy TextClip: `"Noto-Sans"`.
