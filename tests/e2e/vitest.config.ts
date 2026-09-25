import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const srcDir = path.resolve(projectRoot, 'apps/sophia-ai-factory/src');

export default {
  resolve: {
    alias: {
      '@/seed': path.resolve(srcDir, 'seed'),
      '@/tree': path.resolve(srcDir, 'tree'),
      '@/forest': path.resolve(srcDir, 'forest'),
      '@/land': path.resolve(srcDir, 'land'),
      '@': srcDir,
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
};
