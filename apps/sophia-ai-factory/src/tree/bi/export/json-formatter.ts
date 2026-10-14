import type { JsonFormatOptions } from './types';

/**
 * Streams a JSON array or NDJSON from an AsyncIterable.
 * Handles empty sets correctly: outputs "[]" when 0 records are present (RFC/Test F5-2).
 */
export function streamJsonArray<T = unknown>(
  items: AsyncIterable<T> | Iterable<T>,
  options?: JsonFormatOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const isNdjson = options?.ndjson ?? false;
  const indent = options?.indent ?? 2;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (isNdjson) {
          for await (const item of items) {
            controller.enqueue(encoder.encode(JSON.stringify(item) + '\n'));
          }
          controller.close();
          return;
        }

        let count = 0;
        const prefixSpaces = ' '.repeat(indent);

        for await (const item of items) {
          count++;
          const formattedItem = indent > 0
            ? JSON.stringify(item, null, indent).replace(/\n/g, `\n${prefixSpaces}`)
            : JSON.stringify(item);

          if (count === 1) {
            controller.enqueue(encoder.encode(`[\n${prefixSpaces}${formattedItem}`));
          } else {
            controller.enqueue(encoder.encode(`,\n${prefixSpaces}${formattedItem}`));
          }
        }

        if (count === 0) {
          // Empty dataset contract: F5-2
          controller.enqueue(encoder.encode('[]'));
        } else {
          controller.enqueue(encoder.encode('\n]'));
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
