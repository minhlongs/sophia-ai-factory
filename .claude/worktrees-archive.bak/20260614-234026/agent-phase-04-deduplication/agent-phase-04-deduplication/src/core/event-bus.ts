/**
 * Inter-Module Event Bus
 *
 * Provides a pub/sub event bus with:
 * - Typed event names and payloads
 * - Namespaced events (e.g., `module.action`)
 * - Wildcard subscriptions for groups of events
 * - Listener ordering (priority, prepend)
 * - Once and async listeners
 * - Automatic cleanup on removal
 *
 * ## Usage
 *
 * ```typescript
 * import { eventBus, createTypedEventBus } from './event-bus';
 *
 * // Subscribe to a specific event
 * eventBus.on('orchestrator.workflow.completed', (payload) => {
 *   console.log('Workflow completed:', payload.workflowId, 'with result:', payload.result);
 * });
 *
 * // Subscribe to all orchestrator events (wildcard)
 * eventBus.on('orchestrator.*', (eventName, payload) => {
 *   console.log('Orchestrator event:', eventName, payload);
 * });
 *
 * // One-time subscription
 * eventBus.once('orchestrator.workflow.completed', (payload) => {
 *   console.log('First completion:', payload.workflowId);
 * });
 *
 * // Emit an event
 * eventBus.emit('orchestrator.workflow.completed', { workflowId: 'wf-123', result: { status: 'success' } });
 *
 * // Remove a specific listener
 * const listenerId = eventBus.on('orchestrator.workflow.completed', handler);
 * eventBus.off('orchestrator.workflow.completed', listenerId);
 *
 * // Remove all listeners for a specific event
 * eventBus.removeAllListeners('orchestrator.workflow.completed');
 *
 * // Typed event bus for better DX
 * interface MyEvents {
 *   'module.action': { data: string };
 *   'module.error': { message: string; code: number };
 * }
 * const typedBus = createTypedEventBus<MyEvents>();
 * typedBus.on('module.action', (payload) => { ... });
 * typedBus.emit('module.error', { message: 'Oops', code: 500 });
 * ```
 */

import { SophiaError } from './error-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Represents the type of the payload for a given event */
export type EventPayload<T, K extends keyof T> = T[K];

/** Generic listener type for typed event bus */
export type EventListener<T, K extends keyof T = keyof T> = (payload: EventPayload<T, K>, eventName: K) => void;

/** Unsubscribe function returned by `on` or `once` */
export type UnsubscribeFn = () => void;

/** Listener registration with metadata for priority and cleanup */
interface ListenerRegistration<T> {
  id: string;
  eventName: string;
  listener: (payload: unknown, eventName: string) => void;
  priority: number;
  once: boolean;
}

/** Options for emitting events */
export interface EmitOptions {
  /** If true, silences errors thrown by listeners */
  swallowErrors?: boolean;
}

/**
 * @deprecated Use EmitOptions instead
 * Options for listening to events (kept for backward compat)
 */
export type ListenOptions = EmitOptions;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unique listener ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Check if an event name matches a pattern (supports wildcards) */
function matchEventName(eventName: string, pattern: string): boolean {
  if (pattern === eventName) return true;
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return eventName.startsWith(prefix) || prefix === '*' || prefix === '';
  }
  return false;
}

// ---------------------------------------------------------------------------
// InterModuleEventBus
// ---------------------------------------------------------------------------

/**
 * Central event bus for inter-module communication.
 *
 * Supports namespaced event names, wildcard subscriptions, and
 * priority-based listener ordering.
 *
 * ### Event Naming Convention
 *
 * Use `moduleName.action` or `moduleName.submodule.action`.
 *
 * | Name | Description |
 * |------|-------------|
 * | `orchestrator.workflow.started` | Workflow started |
 * | `orchestrator.workflow.completed` | Workflow completed |
 * | `rag.document.indexed` | Document indexed |
 * | `agent.task.assigned` | Task assigned to agent |
 */
export class InterModuleEventBus<T extends Record<string, unknown> = Record<string, unknown>> {
  private listeners: Map<string, ListenerRegistration<T>[]> = new Map();
  private static instance: InterModuleEventBus<Record<string, unknown>> | null = null;

  /** Get the singleton instance of the event bus */
  static getInstance(): InterModuleEventBus<Record<string, unknown>> {
    if (!InterModuleEventBus.instance) {
      InterModuleEventBus.instance = new InterModuleEventBus<Record<string, unknown>>();
    }
    return InterModuleEventBus.instance;
  }

  /**
   * Subscribe to an event.
   *
   * @param eventName The event name (supports wildcards, e.g. `module.*`)
   * @param listener  The callback to invoke
   * @param options   Optional priority (default: 0)
   * @returns An unsubscribe function
   */
  on<K extends keyof T>(
    eventName: K | string,
    listener: (payload: EventPayload<T, K>, eventName: K) => void,
    options: { priority?: number; once?: boolean } = {},
  ): UnsubscribeFn {
    const id = generateId();
    const name = eventName as string;
    const priority = options.priority ?? 0;
    const once = options.once ?? false;

    if (!this.listeners.has(name)) {
      this.listeners.set(name, []);
    }

    const reg: ListenerRegistration<T> = {
      id,
      eventName: name,
      listener: listener as (payload: unknown, eventName: string) => void,
      priority,
      once,
    };

    const existing = this.listeners.get(name)!;
    existing.push(reg);
    // Sort by priority (higher first)
    existing.sort((a, b) => b.priority - a.priority);

    return () => {
      this.offById(name, id);
    };
  }

  /**
   * Subscribe to an event for one-time execution.
   *
   * @param eventName The event name
   * @param listener  The callback to invoke once
   * @param options   Optional priority (default: 0)
   * @returns An unsubscribe function
   */
  once<K extends keyof T>(
    eventName: K | string,
    listener: (payload: EventPayload<T, K>, eventName: K) => void,
    options: { priority?: number } = {},
  ): UnsubscribeFn {
    return this.on(eventName, listener, { ...options, once: true });
  }

  /**
   * Unsubscribe a specific listener by its ID.
   *
   * @param eventName The event name
   * @param id        The listener ID returned by `on`
   */
  private offById(eventName: string, id: string): void {
    const registrations = this.listeners.get(eventName);
    if (!registrations) return;

    const index = registrations.findIndex((reg) => reg.id === id);
    if (index !== -1) {
      registrations.splice(index, 1);
    }

    if (registrations.length === 0) {
      this.listeners.delete(eventName);
    }
  }

  /**
   * Remove all listeners for a specific event.
   *
   * @param eventName The event name to clear
   */
  removeAllListeners(eventName: string): void {
    this.listeners.delete(eventName);
  }

  /**
   * Emit an event to all matching listeners.
   *
   * @param eventName The event name to emit
   * @param payload   The payload to pass to listeners
   * @param options   Optional emit options
   * @returns Promise that resolves when all listeners have been invoked
   */
  async emit<K extends keyof T>(
    eventName: K,
    payload: EventPayload<T, K>,
    options: EmitOptions = {},
  ): Promise<void> {
    const name = eventName as string;
    const registrations: ListenerRegistration<T>[] = [];

    // Collect exact match and wildcard listeners
    for (const [pattern, regs] of this.listeners) {
      if (matchEventName(name, pattern)) {
        registrations.push(...regs);
      }
    }

    if (registrations.length === 0) return;

    // Sort by priority (higher first)
    registrations.sort((a, b) => b.priority - a.priority);

    // Execute listeners
    for (const reg of registrations) {
      try {
        await reg.listener(payload, name);
      } catch (error) {
        if (!options.swallowErrors) {
          throw new SophiaError(
            `Listener for event "${name}" threw an error: ${error instanceof Error ? error.message : String(error)}`,
            'EVENT_LISTENER_ERROR',
            { cause: error, eventName: name, listenerId: reg.id },
          );
        }
      } finally {
        if (reg.once) {
          this.offById(reg.eventName, reg.id);
        }
      }
    }
  }

  /**
   * Synchronous emit that does not wait for async listeners.
   *
   * @param eventName The event name to emit
   * @param payload   The payload to pass to listeners
   * @param options   Optional emit options
   */
  emitSync<K extends keyof T>(
    eventName: K,
    payload: EventPayload<T, K>,
    options: EmitOptions = {},
  ): void {
    const name = eventName as string;
    const registrations: ListenerRegistration<T>[] = [];

    for (const [pattern, regs] of this.listeners) {
      if (matchEventName(name, pattern)) {
        registrations.push(...regs);
      }
    }

    if (registrations.length === 0) return;

    registrations.sort((a, b) => b.priority - a.priority);

    for (const reg of registrations) {
      try {
        // Fire and forget async listeners
        Promise.resolve(reg.listener(payload, name)).catch((error) => {
          if (!options.swallowErrors) {
            console.error(
              `Async listener for event "${name}" threw an error:`,
              error,
            );
          }
        });
      } catch (error) {
        if (!options.swallowErrors) {
          throw new SophiaError(
            `Listener for event "${name}" threw an error: ${error instanceof Error ? error.message : String(error)}`,
            'EVENT_LISTENER_ERROR',
            { cause: error, eventName: name, listenerId: reg.id },
          );
        }
      } finally {
        if (reg.once) {
          this.offById(reg.eventName, reg.id);
        }
      }
    }
  }

  /**
   * Get the number of listeners for a given event.
   *
   * @param eventName The event name to count listeners for
   * @returns The number of listeners
   */
  listenerCount(eventName: string): number {
    let count = 0;
    for (const [pattern, regs] of this.listeners) {
      if (matchEventName(eventName, pattern)) {
        count += regs.length;
      }
    }
    return count;
  }

  /**
   * Clear all listeners from the event bus.
   */
  clearAll(): void {
    this.listeners.clear();
  }
}

// ---------------------------------------------------------------------------
// Typed Event Bus Factory
// ---------------------------------------------------------------------------

/** Event map type for typed event bus */
export interface EventMap {
  [key: string]: unknown;
}

/**
 * Create a typed instance of the event bus for a specific event map.
 *
 * @returns A typed InterModuleEventBus instance
 */
export function createTypedEventBus<T extends EventMap>(): InterModuleEventBus<T> {
  return new InterModuleEventBus<T>();
}

/** Default singleton export for ease of use */
export const eventBus = InterModuleEventBus.getInstance();
