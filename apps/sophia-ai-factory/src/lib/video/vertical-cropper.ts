/**
 * Vertical Cropper — generates FFmpeg filter for 16:9 → 9:16 center-crop.
 * Output: 1080x1920 (portrait / Shorts / Reels / TikTok format).
 */

/** Returns the FFmpeg filter string for 16:9 → 9:16 center-crop */
export function getVerticalCropFilter(): string {
  return 'crop=ih*9/16:ih,scale=1080:1920';
}

/** Returns a complete FFmpeg filter_complex for vertical crop with optional padding */
export function getVerticalCropFilterComplex(addBlurredBg = false): string {
  if (!addBlurredBg) {
    return getVerticalCropFilter();
  }

  // Blurred background version: overlay cropped foreground on blurred+scaled background
  return [
    '[0:v]scale=1080:1920,boxblur=20:20[bg]',
    '[0:v]crop=ih*9/16:ih,scale=1080:1920[fg]',
    '[bg][fg]overlay=0:0',
  ].join(';');
}
