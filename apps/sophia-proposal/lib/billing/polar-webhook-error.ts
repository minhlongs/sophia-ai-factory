/**
 * WebhookKnownError — signals Polar should NOT retry this event.
 * Return HTTP 200 with error message instead of 500.
 */
export class WebhookKnownError extends Error {}
