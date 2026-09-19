import { redirect } from 'next/navigation';

export default async function PlaybooksAliasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/playbook`);
}
