import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="w-full h-screen p-8 space-y-8 flex flex-col justify-center items-center">
      <div className="space-y-4 w-full max-w-3xl px-4">
        <Skeleton className="h-12 w-full max-w-[250px] mx-auto bg-white/5" />
        <Skeleton className="h-4 w-full max-w-[200px] mx-auto bg-white/5" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl px-4">
        <Skeleton className="h-[200px] w-full rounded-xl bg-white/5" />
        <Skeleton className="h-[200px] w-full rounded-xl bg-white/5" />
        <Skeleton className="h-[200px] w-full rounded-xl bg-white/5" />
      </div>
    </div>
  );
}
