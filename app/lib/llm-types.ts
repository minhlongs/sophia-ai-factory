// LLM Types for Sophia AI Factory

export interface LLMRequest {
  prompt: string
  model?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

export interface LLMResponse {
  response: string
  model: string
  done: boolean
}

export interface LLMStreamChunk {
  response: string
  done: boolean
}

export interface LLMError {
  error: string
  message: string
}
