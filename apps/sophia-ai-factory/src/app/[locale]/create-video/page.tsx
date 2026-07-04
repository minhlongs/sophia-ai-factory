import type { Metadata } from 'next';
import VideoCreationWizard from '@/app/components/sections/video-creation-wizard';

interface CreateVideoPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: CreateVideoPageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return {
    title: isVi
      ? 'Tạo Video AI | Sophia AI Factory'
      : 'Create AI Video | Sophia AI Factory',
    description: isVi
      ? 'Tạo video AI chuyên nghiệp với trình chỉnh sửa trực quan. Chọn kịch bản, giọng nói, phong cách và tạo video chỉ trong vài phút.'
      : 'Create professional AI videos with our visual editor. Choose your script, voice, visual style, and generate in minutes.',
    alternates: {
      languages: { en: '/en/create-video', vi: '/vi/create-video' },
      canonical: `/${locale}/create-video`,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function CreateVideoPage() {
  return (
    <main className="min-h-screen dark stitch-indigo">
      <VideoCreationWizard />
    </main>
  );
}
