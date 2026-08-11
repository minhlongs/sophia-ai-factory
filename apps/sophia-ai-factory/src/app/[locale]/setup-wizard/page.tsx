import { redirect } from 'next/navigation';

export default function SetupWizardRedirect() {
  redirect('/vi/setup-wizard'); // This will be handled by middleware
}
