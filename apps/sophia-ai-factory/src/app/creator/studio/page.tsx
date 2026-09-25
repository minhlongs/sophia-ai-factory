/**
 * Root Creator Studio Redirect
 *
 * Redirects unlocalized /creator/studio requests to the localized studio route.
 * Default locale: 'vi' (APAC primary market) or 'en'.
 *
 * @module app/creator/studio/page
 */

import { redirect } from 'next/navigation';

export default function RootCreatorStudioRedirect() {
  redirect('/vi/creator/studio');
}
