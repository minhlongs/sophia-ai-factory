import { LoginPage } from '@/components/stitch/screens/login';

interface LoginRouteProps {
 searchParams: { next?: string };
}

export default function LoginRoute({ searchParams }: LoginRouteProps) {
 const redirectTo = searchParams.next;
 return <LoginPage redirectTo={redirectTo} />;
}
