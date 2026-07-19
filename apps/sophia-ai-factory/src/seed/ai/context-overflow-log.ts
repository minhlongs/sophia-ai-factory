import { createServerClient } from '@/seed/db/client';

export interface OverflowEvent {
	timestamp: number;
	agentId?: string;
	provider: string;
	tokensUsed: number;
	limit: number;
	contextWindow: string;
	requestId?: string;
	metadata?: Record<string, any>;
}

class ContextOverflowLog {
	private readonly TABLE_NAME = 'ai_context_overflow_logs';

	/** Logs a context overflow event to the database. */
	async log(event: Partial<OverflowEvent>): Promise<void> {
		const db = createServerClient();
		const timestamp = event.timestamp ?? Date.now();
		const provider = event.provider ?? 'unknown';
		const tokensUsed = event.tokensUsed ?? 0;
		const limit = event.limit ?? 0;
		const contextWindow = event.contextWindow ?? 'unknown';
		const agentId = event.agentId ?? 'system';
		const requestId = event.requestId ?? '';
		const metadata = event.metadata
			? JSON.stringify(event.metadata)
			: '{}';

		try {
			db.prepare(
				`INSERT INTO ${this.TABLE_NAME}
					(timestamp, agent_id, provider, tokens_used, "limit", context_window, request_id, metadata)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
			)
				.bind(timestamp, agentId, provider, tokensUsed, limit, contextWindow, requestId, metadata)
				.run();
		} catch (error) {
			// Fallback to console for critical infrastructure failure, but don't throw
			console.error(`[ContextOverflowLog] Failed to log event:`, error);
		}
	}

	/** Gets the most recent overflow events. */
	async getRecent(limit = 100): Promise<any[]> {
		const db = createServerClient();
		const result = await db
			.prepare(
				`SELECT * FROM ${this.TABLE_NAME} ORDER BY timestamp DESC LIMIT ?`,
			)
			.bind(limit)
			.all();
		return result.results;
	}

	/** Gets aggregated stats by provider and agent. */
	async getStats(): Promise<any[]> {
		const db = createServerClient();
		const result = await db
			.prepare(
				`SELECT provider, agent_id, COUNT(*) as count, MAX(tokens_used) as max_tokens
				 FROM ${this.TABLE_NAME}
				 GROUP BY provider, agent_id`,
			)
			.all();
		return result.results;
	}

	/** Gets overflow events within the last X hours. */
	async getByTimeRange(hours: number): Promise<any[]> {
		const db = createServerClient();
		const cutoff = Date.now() - hours * 60 * 60 * 1000;
		const result = await db
			.prepare(
				`SELECT * FROM ${this.TABLE_NAME} WHERE timestamp > ? ORDER BY timestamp DESC`,
			)
			.bind(cutoff)
			.all();
		return result.results;
	}

	/** Gets aggregated stats within the last X hours. */
	async getStatsByTimeRange(hours: number): Promise<any[]> {
		const db = createServerClient();
		const cutoff = Date.now() - hours * 60 * 60 * 1000;
		const result = await db
			.prepare(
				`SELECT provider, agent_id, COUNT(*) as count, SUM(tokens_used) as total_tokens, AVG(tokens_used) as avg_tokens
				 FROM ${this.TABLE_NAME}
				 WHERE timestamp > ?
				 GROUP BY provider, agent_id`,
			)
			.bind(cutoff)
			.all();
		return result.results;
	}

	/** Clears logs older than a certain date. */
	async clear(daysOld = 30): Promise<any> {
		const db = createServerClient();
		const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
		return db.prepare(
			`DELETE FROM ${this.TABLE_NAME} WHERE timestamp < ?`,
		)
			.bind(cutoff)
			.run();
	}
}

export const contextOverflowLog = new ContextOverflowLog();
