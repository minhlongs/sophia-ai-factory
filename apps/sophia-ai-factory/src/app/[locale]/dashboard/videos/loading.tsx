import { Loader2 } from "lucide-react";

export default function VideosLoading() {
  return (
    <div className="container mx-auto p-6 max-w-4xl flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
    </div>
  );
}
