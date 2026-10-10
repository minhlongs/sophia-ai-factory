import { LogEntry, ResolvedErrorArgs } from './types';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const formatLogEntry = (entry: LogEntry): string => {
  if (isDevelopment) {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.requestId ? `[${entry.requestId}]` : '',
      entry.message,
    ].filter(Boolean);

    let output = parts.join(' ');

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      output += `\n  Metadata: ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      const extras: Record<string, unknown> = {};
      if (entry.error.code !== undefined) extras.code = entry.error.code;
      if (entry.error.details !== undefined) extras.details = entry.error.details;
      if (entry.error.hint !== undefined) extras.hint = entry.error.hint;
      if (Object.keys(extras).length > 0) {
        output += `\n  Details: ${JSON.stringify(extras)}`;
      }
      if (entry.error.stack) {
        output += `\n${entry.error.stack}`;
      }
    }

    return output;
  }

  return JSON.stringify(entry);
};

export function resolveErrorArgs(
  arg2: Error | Record<string, unknown> | undefined,
  arg3: Record<string, unknown> | undefined,
  arg4: string | undefined
): ResolvedErrorArgs {
  if (arg2 !== undefined && !(arg2 instanceof Error)) {
    const record = arg2 as Record<string, unknown>;
    const embeddedErr = record.error;
    if (embeddedErr instanceof Error) {
      const { error: _pulled, ...rest } = record;
      void _pulled;
      const meta = Object.keys(rest).length > 0 ? rest : undefined;
      return { err: embeddedErr, meta, reqId: arg3 as string | undefined };
    }
    return { err: undefined, meta: record, reqId: arg3 as string | undefined };
  }
  return { err: arg2, meta: arg3, reqId: arg4 };
}
