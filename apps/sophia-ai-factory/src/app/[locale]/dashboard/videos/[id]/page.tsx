import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/better-auth-session";
import { createServerClient } from "@/lib/db/client";
import { VideoDetailClient } from "../components/video-detail-client";

interface VideoRow {
  id: string;
  user_id: string;
  title: string | null;
  status: "processing" | "completed" | "failed";
  video_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  heygen_job_id: string;
  script_request_id: string | null;
  error: string | null;
  created_at: number;
  updated_at: string | null;
}

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const db = createServerClient();
  const { data } = await db
    .from("videos")
    .select(
      "id, user_id, title, status, video_url, thumbnail_url, duration_sec, heygen_job_id, script_request_id, error, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  const video = data as VideoRow | null;
  if (!video) notFound();
  if (video.user_id !== user.id) notFound();

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <header className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/videos"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to gallery
          </Link>
          <h1 className="text-2xl font-semibold mt-1">
            {video.title ?? "Untitled"}
          </h1>
        </div>
      </header>
      <VideoDetailClient video={video} />
    </div>
  );
}
