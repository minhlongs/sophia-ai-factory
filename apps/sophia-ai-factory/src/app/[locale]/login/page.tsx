import { LoginPage } from '@/components/stitch/screens/login';

interface LoginRouteProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LocaleLoginRoute({ searchParams }: LoginRouteProps) {
  const { next } = await searchParams;
  return <LoginPage redirectTo={next} />;
}
