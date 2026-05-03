import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { createServerClient } from "@/seed/db/client";
import { localizedHref } from "@/lib/i18n/localized-href";
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
  const { id, locale } = await params;
  if (!user) redirect(localizedHref(locale, "/login"));

  const t = await getTranslations("dashboard.videos");
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
            href={localizedHref(locale, "/dashboard/videos")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("backToGallery")}
          </Link>
          <h1 className="text-2xl font-semibold mt-1">
            {video.title ?? t("untitled")}
          </h1>
        </div>
      </header>
      <VideoDetailClient video={video} />
    </div>
  );
}
