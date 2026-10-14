/**
 * @file pipeline-sop-repurpose-events.ts
 * @description Inngest event contracts for SOP execution, repurposing, analytics sync and YouTube pipelines.
 * @layer seed
 */

export type SopExecutionRequestedEvent = {
  data: {
    executionId: string;
    userId: string;
    orgId: string;
    sopTemplateId: string;
    installationId?: string;
    inputJson: string;
  };
};

export type SopStepCompletedEvent = {
  data: { executionId: string; stepOrder: number; result: Record<string, unknown> };
};

export type RepurposeAnalyzeEvent = {
  data: {
    jobId: string;
    userId: string;
    videoUrl: string;
    transcript: Array<{ text: string; start_ms: number; end_ms: number }>;
  };
};

export type RepurposeClipGenerateEvent = {
  data: {
    clipId: string;
    jobId: string;
    videoUrl: string;
    startMs: number;
    endMs: number;
    userId: string;
  };
};

export type AnalyticsSyncRequestedEvent = { data: { userId: string; requestedAt: number } };

export type KeyRotationRequestedEvent = { data: { keyVersion: number; reason?: string } };

export type YouTubeContentPipelineRequestedEvent = {
  data: {
    userId: string;
    channelConfigId: string;
    topic?: string | null;
    requestedAt?: number;
    resume?: boolean;
    resumeFrom?: string;
  };
};
