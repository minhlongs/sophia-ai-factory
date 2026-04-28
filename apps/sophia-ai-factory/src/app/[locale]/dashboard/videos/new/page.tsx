import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/better-auth-session";
import { VideoCreatorWizard } from "./components/video-creator-wizard";

export const dynamic = "force-dynamic";

export default async function NewVideoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Create Video</h1>
        <p className="text-muted-foreground mt-2">
          Generate an AI video: write script → pick avatar &amp; voice → render.
        </p>
      </header>
      <VideoCreatorWizard />
    </div>
  );
}
