export interface InboundVerifyOptions {
  algo: 'SHA-256' | 'SHA-512';
  canonicalize?: (rawBody: string) => string;
}

export interface VerifyOptions {
  toleranceSec?: number;
  acceptLegacy?: boolean;
}
