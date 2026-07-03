'use client';

import { useRouter } from '@/navigation';
import { VideoCreationPage } from '@/components/stitch/screens/video-creation';

export function VideoCreationClient() {
  const router = useRouter();

  return (
    <VideoCreationPage
      onBack={() => router.push('/dashboard/videos')}
      onContinue={() => router.push('/dashboard/videos')}
      onAIGenerate={(_script: string) => {
        // TODO: Wire to AI script generation server action
      }}
    />
  );
}
