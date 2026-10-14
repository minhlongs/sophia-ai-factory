import { NextRequest } from 'next/server';
import {
  handleBatchUsagePost,
  handleBatchUsageOptions,
} from './core/index';

export const POST = handleBatchUsagePost;

export async function OPTIONS(request: NextRequest) {
  return handleBatchUsageOptions(request);
}
