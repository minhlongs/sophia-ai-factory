import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { createServerClient } from "@/seed/db/client";
import { localizedHref } from '@/seed/utils/localized-href';
import { VideoDetailClient } from "../components/video-detail-client";
import { DistributeButton } from "../components/distribute-button";
import { PublishingStatusBadges } from "../components/publishing-status-badges";

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

interface PublishJobRow {
  id: string;
  channel_id: string;
  status: string;
  provider: string;
  scheduled_at: number | null;
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

  // Load publishing jobs for this video (video_id = videos.id; renamed from
  // video_job_id in Wave 20 Phase 05 / migration 0101).
  const { data: jobsData } = await db
    .from("publishing_jobs")
    .select("id, channel_id, status, scheduled_at")
    .eq("video_id", id)
    .eq("tenant_id", user.id);

  // Join publishing_channels to get provider for each job
  const jobRows = (jobsData as Omit<PublishJobRow, "provider">[] | null) ?? [];
  const channelIds = [...new Set(jobRows.map((j) => j.channel_id))];
  let publishJobs: PublishJobRow[] = [];

  if (channelIds.length > 0) {
    const { data: channelData } = await db
      .from("publishing_channels")
      .select("id, provider")
      .in("id", channelIds);

    const providerMap = new Map(
      ((channelData as { id: string; provider: string }[] | null) ?? []).map(
        (c) => [c.id, c.provider]
      )
    );
    publishJobs = jobRows.map((j) => ({
      ...j,
      provider: providerMap.get(j.channel_id) ?? "unknown",
    }));
  }

  const distributeHref = localizedHref(locale, `/dashboard/videos/${id}/distribute`);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
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
        {video.status === "completed" && video.video_url && (
          <DistributeButton href={distributeHref} label={t("distribute.cta")} />
        )}
      </header>
      <VideoDetailClient video={video} />
      {publishJobs.length > 0 && (
        <PublishingStatusBadges jobs={publishJobs} />
      )}
    </div>
  );
}
