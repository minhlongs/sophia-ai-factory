/**
 * Performance Feedback Types
 * Layer: tree/sop
 */

export interface StepWithPrompt {
  index: number;
  name: string;
  tool: string;
  prompt: string;
}

export interface LlmOptimizationSuggestion {
  step_index: number;
  suggested_prompt: string;
}
