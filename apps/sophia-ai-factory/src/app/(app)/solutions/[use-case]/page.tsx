import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{
    'use-case'?: string;
    useCase?: string;
  }>;
}

export default async function BareSolutionRoute({ params }: Props) {
  const resolved = await params;
  const slug = resolved['use-case'] || resolved.useCase || '';
  redirect(`/vi/solutions/${slug}`);
}
