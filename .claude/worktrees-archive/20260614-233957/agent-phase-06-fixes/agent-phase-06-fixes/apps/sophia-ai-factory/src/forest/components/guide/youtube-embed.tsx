const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  if (!YOUTUBE_ID_RE.test(videoId)) {
    return null;
  }

  return (
    <div className="aspect-video rounded-xl overflow-hidden border border-white/10 my-4">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
        loading="lazy"
      />
    </div>
  );
}
