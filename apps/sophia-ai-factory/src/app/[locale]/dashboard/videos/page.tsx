import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/better-auth-session";
import { VideoGallery } from "./components/video-gallery";

export default async function VideosGalleryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Videos</h1>
          <p className="text-sm text-muted-foreground">
            Generated videos from your Sophia campaigns
          </p>
        </div>
        <Link
          href="/dashboard/videos/new"
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          New Video
        </Link>
      </header>
      <VideoGallery />
    </div>
  );
}
