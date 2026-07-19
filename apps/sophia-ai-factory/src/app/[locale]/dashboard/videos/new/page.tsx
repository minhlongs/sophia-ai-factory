import { redirect } from "next/navigation";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { localizedHref } from '@/seed/utils/localized-href';
import { VideoCreationClient } from "./_video-creation-client";

export const dynamic = "force-dynamic";

export default async function NewVideoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const user = await getCurrentUser();
  const { locale } = await params;
  if (!user) redirect(localizedHref(locale, "/login"));

  return <VideoCreationClient />;
}
