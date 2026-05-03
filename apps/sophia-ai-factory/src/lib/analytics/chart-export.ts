/**
 * Chart Export Utilities
 *
 * Export charts to PNG format using html2canvas
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

/**
 * Export a chart element to PNG
 *
 * @param elementId - DOM element ID of the chart container
 * @param filename - Output filename (without extension)
 */
export async function exportChartToPng(
  elementId: string,
  filename: string = 'chart'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Chart element #${elementId} not found`);
  }

  // Dynamically import html2canvas
  const html2canvas = (await import('html2canvas')).default;

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2, // Retina quality
    logging: false,
    useCORS: true,
    ignoreElements: (node) => {
      // Ignore elements that shouldn't be in export
      if (node instanceof HTMLElement) {
        if (node.getAttribute('data-no-export')) return true;
      }
      return false;
    },
  });

  // Download PNG
  const link = document.createElement('a');
  link.download = `${filename}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Export multiple charts to a ZIP file
 *
 * @param chartIds - Array of element IDs to export
 * @param zipFilename - Output ZIP filename
 */
export async function exportChartsToZip(
  chartIds: string[],
  zipFilename: string = 'charts'
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const chartId of chartIds) {
    try {
      const element = document.getElementById(chartId);
      if (!element) continue;

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/png');
      });

      zip.file(`chart-${chartId}.png`, blob);
    } catch (error) {
      logger.error(`Failed to export chart ${chartId}`, toError(error));
    }
  }

  // Generate and download ZIP
  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.download = `${zipFilename}-${Date.now()}.zip`;
  link.href = URL.createObjectURL(content);
  link.click();
  URL.revokeObjectURL(link.href);
}
