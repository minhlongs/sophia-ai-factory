import { redirect } from 'next/navigation';

export default function ResetPasswordRedirect() {
  redirect('/vi/reset-password'); // This will be handled by middleware
}
