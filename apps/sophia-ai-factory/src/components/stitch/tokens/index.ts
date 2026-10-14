import { stitchColors } from './colors';
import { stitchSpacing, stitchBorderRadius } from './layout';
import { stitchTypography } from './typography';
import { stitchClasses } from './classes';

export { stitchColors } from './colors';
export { stitchSpacing, stitchBorderRadius } from './layout';
export { stitchTypography } from './typography';
export { stitchClasses } from './classes';

const stitchDesignTokens = {
  colors: stitchColors,
  spacing: stitchSpacing,
  borderRadius: stitchBorderRadius,
  typography: stitchTypography,
  classes: stitchClasses,
};

export default stitchDesignTokens;
