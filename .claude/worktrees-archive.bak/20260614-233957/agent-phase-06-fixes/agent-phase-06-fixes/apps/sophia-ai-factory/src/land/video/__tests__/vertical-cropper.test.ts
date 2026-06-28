import { describe, it, expect } from 'vitest';
import {
  getVerticalCropFilter,
  getVerticalCropFilterComplex,
  buildPanningExpr,
  FocalPoint,
} from '../vertical-cropper';

describe('vertical-cropper', () => {
  describe('buildPanningExpr', () => {
    it('returns 0.5 when focal points are empty', () => {
      expect(buildPanningExpr([])).toBe('0.5');
    });

    it('returns the ratio when there is only one focal point', () => {
      expect(buildPanningExpr([{ timestamp_ms: 5000, x_ratio: 0.3 }])).toBe('0.300');
    });

    it('builds linear interpolation expression for multiple keyframes', () => {
      const focalPoints: FocalPoint[] = [
        { timestamp_ms: 0, x_ratio: 0.5 },
        { timestamp_ms: 5000, x_ratio: 0.2 },
        { timestamp_ms: 10000, x_ratio: 0.8 },
      ];

      const expr = buildPanningExpr(focalPoints);
      // Keyframe 1: 0s to 5s. x_curr=0.5, x_next=0.2. duration=5s, diff=-0.3.
      // Keyframe 2: 5s to 10s. x_curr=0.2, x_next=0.8. duration=5s, diff=0.6.
      // Expected nested if expression structure:
      expect(expr).toContain('if(lt(t,5.000),0.500+(-0.300)*(t-0.000)/5.000');
      expect(expr).toContain('if(lt(t,10.000),0.200+(0.600)*(t-5.000)/5.000,0.800)');
    });
  });

  describe('getVerticalCropFilter', () => {
    it('returns center-crop filter by default', () => {
      expect(getVerticalCropFilter()).toBe('crop=ih*9/16:ih,scale=1080:1920');
    });

    it('returns letterbox filter when mode is letterbox', () => {
      expect(getVerticalCropFilter({ mode: 'letterbox' })).toBe(
        'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
      );
    });

    it('returns center-crop filter for smart-panning with empty focal points', () => {
      expect(getVerticalCropFilter({ mode: 'smart-panning' })).toBe('crop=ih*9/16:ih,scale=1080:1920');
    });

    it('returns dynamic crop filter with escaped commas for smart-panning', () => {
      const focalPoints: FocalPoint[] = [
        { timestamp_ms: 0, x_ratio: 0.5 },
        { timestamp_ms: 5000, x_ratio: 0.2 },
      ];
      const filter = getVerticalCropFilter({ mode: 'smart-panning', focalPoints });
      expect(filter).toContain('crop=ih*9/16:ih:min(max(iw*(');
      // Verify commas inside min/max functions are escaped as \,
      expect(filter).toContain('\\,0)\\,iw-ow)');
    });
  });

  describe('getVerticalCropFilterComplex', () => {
    it('handles backward compatibility for booleans', () => {
      // false => center crop
      expect(getVerticalCropFilterComplex(false)).toBe('crop=ih*9/16:ih,scale=1080:1920');
      // true => blurred background
      expect(getVerticalCropFilterComplex(true)).toContain('boxblur=20:20[bg]');
    });

    it('handles mode: blurred-bg', () => {
      expect(getVerticalCropFilterComplex({ mode: 'blurred-bg' })).toContain('boxblur=20:20[bg]');
    });

    it('delegates to getVerticalCropFilter for other modes', () => {
      expect(getVerticalCropFilterComplex({ mode: 'letterbox' })).toBe(
        'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
      );
    });
  });
});
