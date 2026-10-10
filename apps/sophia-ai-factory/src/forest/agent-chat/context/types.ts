export interface ContextCheckResult {
  withinLimit: boolean;
  currentTokens: number;
  limitTokens: number;
  action: 'none' | 'trim' | 'summarize+trim';
}

export interface ContextManagerOptions {
  contextLimit?: number;
  summarizeThreshold?: number;
  minRecent?: number;
  summarizationEnabled?: boolean;
}

export interface ContextMessage {
  role: string;
  content: string;
}
