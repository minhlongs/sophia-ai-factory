/**
 * Font Configuration for 84tea
 * Material Design 3 Typography System
 *
 * - Display: Playfair Display (Serif) - Headlines, Hero text
 * - Body: Inter (Sans-serif) - Body text, UI elements
 */

import { Inter, Playfair_Display } from 'next/font/google';

// Playfair Display for display and headline typography
export const playfairDisplay = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
});

// Inter for body and label typography
export const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
});
