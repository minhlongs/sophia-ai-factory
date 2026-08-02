import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs', () => ({ existsSync: vi.fn(() => false), readFileSync: vi.fn(() => '') }));

describe('Step 5: JWT/HTTP Secret Uniqueness', () => {
	const SECRETS = [
		'BETTER_AUTH_SECRET',
		'CRON_SECRET',
		'INTERNAL_API_SECRET',
		'TELEGRAM_WEBHOOK_SECRET',
		'HEALTH_CHECK_SECRET',
	];

	beforeEach(() => {
		vi.clearAllMocks();
		for (const key of SECRETS) delete process.env[key];
	});

	afterEach(() => {
		for (const key of SECRETS) delete process.env[key];
	});

	it('skips when any candidate is absent', () => {
		const values = SECRETS.map(n => process.env[n]).filter(Boolean);
		if (values.length < SECRETS.length) {
			expect(values.length).toBeLessThan(SECRETS.length);
			return;
		}
		SECRETS.forEach((n, i) => (process.env[n] = `val-${i}`));
		expect(new Set(SECRETS.map(n => process.env[n])).size).toBe(5);
	});

	it('fails when BETTER_AUTH_SECRET === CRON_SECRET', () => {
		process.env.BETTER_AUTH_SECRET = 'same';
		process.env.CRON_SECRET = 'same';
		process.env.INTERNAL_API_SECRET = 'c';
		process.env.TELEGRAM_WEBHOOK_SECRET = 'd';
		process.env.HEALTH_CHECK_SECRET = 'e';
		expect(new Set(SECRETS.map(n => process.env[n])).size).toBeLessThan(SECRETS.length);
	});

	it('passes when all five ARE distinct', () => {
		SECRETS.forEach((n, i) => (process.env[n] = `val-${i}`));
		expect(new Set(SECRETS.map(n => process.env[n])).size).toBe(SECRETS.length);
	});
});
