import { describe, it, expect } from 'vitest';
import type { AttributionLedgerEntry } from '../growth-triad';

describe('Growth Triad Types', () => {
    it('should correctly type the ledger entries', () => {
        const entry: AttributionLedgerEntry = {
            id: 'test-id',
            organizationId: 'org-1',
            videoId: 'vid-1',
            sourcePlatform: 'tiktok',
            conversionValue: 15.0,
            status: 'PENDING',
            attributedAt: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        expect(entry.status).toBe('PENDING');
        expect(entry.conversionValue).toBe(15.0);
    });
});
