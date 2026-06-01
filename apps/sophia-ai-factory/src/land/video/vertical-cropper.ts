export interface FocalPoint {
  timestamp_ms: number;
  x_ratio: number;
}

export interface CropOptions {
  mode?: 'center' | 'blurred-bg' | 'letterbox' | 'smart-panning';
  focalPoints?: FocalPoint[];
}

export function buildPanningExpr(focalPoints: FocalPoint[]): string {
  if (focalPoints.length === 0) return '0.5';
  const sorted = [...focalPoints].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  if (sorted.length === 1) return sorted[0].x_ratio.toFixed(3);

  let expr = sorted[sorted.length - 1].x_ratio.toFixed(3);

  for (let i = sorted.length - 2; i >= 0; i--) {
    const t_curr = sorted[i].timestamp_ms / 1000;
    const t_next = sorted[i + 1].timestamp_ms / 1000;
    const x_curr = sorted[i].x_ratio;
    const x_next = sorted[i + 1].x_ratio;
    const duration = t_next - t_curr;
    const diff = x_next - x_curr;

    if (duration > 0) {
      expr = `if(lt(t,${t_next.toFixed(3)}),${x_curr.toFixed(3)}+(${diff.toFixed(3)})*(t-${t_curr.toFixed(3)})/${duration.toFixed(3)},${expr})`;
    } else {
      expr = `if(lt(t,${t_next.toFixed(3)}),${x_curr.toFixed(3)},${expr})`;
    }
  }
  return expr;
}

/** Returns the FFmpeg filter string for 16:9 → 9:16 center-crop */
export function getVerticalCropFilter(options?: CropOptions): string {
  const mode = options?.mode ?? 'center';

  if (mode === 'letterbox') {
    return 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2';
  }

  if (mode === 'smart-panning' && options?.focalPoints && options.focalPoints.length > 0) {
    const panningExpr = buildPanningExpr(options.focalPoints);
    // Escape commas with \\, inside crop parameters so FFmpeg doesn't treat them as filter separators
    return `crop=ih*9/16:ih:min(max(iw*(${panningExpr})-ow/2\\,0)\\,iw-ow):0,scale=1080:1920`;
  }

  // Default is center-crop
  return 'crop=ih*9/16:ih,scale=1080:1920';
}

/** Returns a complete FFmpeg filter_complex for vertical crop with optional padding/blur */
export function getVerticalCropFilterComplex(options?: boolean | CropOptions): string {
  if (options === undefined) {
    return getVerticalCropFilter();
  }

  if (typeof options === 'boolean') {
    if (!options) {
      return getVerticalCropFilter({ mode: 'center' });
    }
    // Blurred background version: overlay cropped foreground on blurred+scaled background
    return [
      '[0:v]scale=1080:1920,boxblur=20:20[bg]',
      '[0:v]crop=ih*9/16:ih,scale=1080:1920[fg]',
      '[bg][fg]overlay=0:0',
    ].join(';');
  }

  const mode = options.mode ?? 'center';

  if (mode === 'blurred-bg') {
    return [
      '[0:v]scale=1080:1920,boxblur=20:20[bg]',
      '[0:v]crop=ih*9/16:ih,scale=1080:1920[fg]',
      '[bg][fg]overlay=0:0',
    ].join(';');
  }

  return getVerticalCropFilter(options);
}
