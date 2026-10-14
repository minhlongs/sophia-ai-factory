import type { NextRequest, NextResponse } from 'next/server';
import { handleWorkflowStepperCron } from './stepper-handler';

export * from './types';
export * from './step-evaluator';
export * from './stepper-handler';

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleWorkflowStepperCron(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleWorkflowStepperCron(req);
}
