/**
 * Types and interfaces for CDN thumbnail generator.
 *
 * @module tree/cdn/generator/types
 */

export interface CropAndScaleResult {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  targetWidth: number;
  targetHeight: number;
  scaleFactor: number;
}

export interface DimensionsResult {
  width: number;
  height: number;
}

export interface SeedColor {
  r: number;
  g: number;
  b: number;
}
