'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  generateNewsletter,
  NewsletterConfigError,
} from '@/land/scripts/generate-newsletter';
import { getErrorMessage } from '@/seed/utils/to-error';

interface NewsletterActionInput {
  brandName: string;
  topic: string;
  tone: 'professional' | 'conversational' | 'educational' | 'witty';
  editorIntro?: string;
  ctaText?: string;
  language?: 'en' | 'vi';
}

type NewsletterActionResult =
  | { success: true; subject: string; html: string; plainText: string; wordCount: number }
  | { success: false; error: string; code?: string };

export async function newsletterGenerateAction(
  input: NewsletterActionInput,
): Promise<NewsletterActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  try {
    const result = await generateNewsletter({
      userId: user.id,
      brandName: input.brandName,
      topic: input.topic,
      tone: input.tone,
      editorIntro: input.editorIntro,
      ctaText: input.ctaText,
      language: input.language,
    });

    return {
      success: true,
      subject: result.subject,
      html: result.html,
      plainText: result.plainText,
      wordCount: result.wordCount,
    };
  } catch (err) {
    if (err instanceof NewsletterConfigError) {
      return { success: false, error: err.message, code: err.code };
    }
    return { success: false, error: getErrorMessage(err) };
  }
}
