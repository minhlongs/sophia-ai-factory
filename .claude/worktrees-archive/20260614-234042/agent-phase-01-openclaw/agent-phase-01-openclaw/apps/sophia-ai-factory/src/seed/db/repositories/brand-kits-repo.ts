import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface BrandKit {
id: string;
user_id: string;
logo_r2_key: string | null;
intro_r2_key: string | null;
outro_r2_key: string | null;
font_r2_key: string | null;
primary_color: string;
secondary_color: string;
logo_position: string;
logo_opacity: number;
created_at: string;
updated_at: string;
}

export interface UpsertBrandKitInput {
userId: string;
logoR2Key?: string | null;
introR2Key?: string | null;
outroR2Key?: string | null;
fontR2Key?: string | null;
primaryColor?: string | null;
secondaryColor?: string | null;
logoPosition?: string | null;
logoOpacity?: number | null;
}

export async function getBrandKit(userId: string): Promise<BrandKit | null> {
const db = getD1();
if (!db) return null;
const result = await db
.prepare('SELECT * FROM brand_kits WHERE user_id = ?')
.bind(userId)
.first<BrandKit>();
return result ?? null;
}

export async function upsertBrandKit(input: UpsertBrandKitInput): Promise<BrandKit> {
const db = getD1();
if (!db) throw new Error('Database unavailable');
const existing = await getBrandKit(input.userId);

if (existing) {
await db
.prepare(
`UPDATE brand_kits SET
logo_r2_key = COALESCE(?, logo_r2_key),
intro_r2_key = COALESCE(?, intro_r2_key),
outro_r2_key = COALESCE(?, outro_r2_key),
font_r2_key = COALESCE(?, font_r2_key),
primary_color = COALESCE(?, primary_color),
secondary_color = COALESCE(?, secondary_color),
logo_position = COALESCE(?, logo_position),
logo_opacity = COALESCE(?, logo_opacity),
updated_at = datetime('now')
WHERE user_id = ?`,
)
.bind(
input.logoR2Key ?? null,
input.introR2Key ?? null,
input.outroR2Key ?? null,
input.fontR2Key ?? null,
input.primaryColor ?? null,
input.secondaryColor ?? null,
input.logoPosition ?? null,
input.logoOpacity ?? null,
input.userId,
)
.run();

logger.info('[brand-kits-repo] Updated brand kit', { userId: input.userId });
return (await getBrandKit(input.userId))!;
} else {
const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
await db
.prepare(
`INSERT INTO brand_kits (id, user_id, logo_r2_key, intro_r2_key, outro_r2_key, font_r2_key, primary_color, secondary_color, logo_position, logo_opacity)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)
.bind(
id,
input.userId,
input.logoR2Key ?? null,
input.introR2Key ?? null,
input.outroR2Key ?? null,
input.fontR2Key ?? null,
input.primaryColor ?? '#000000',
input.secondaryColor ?? '#FFFFFF',
input.logoPosition ?? 'bottom-right',
input.logoOpacity ?? 0.8,
)
.run();

logger.info('[brand-kits-repo] Created brand kit', { userId: input.userId, id });
return (await getBrandKit(input.userId))!;
}
}

const ALLOWED_ASSET_COLUMNS = new Set([
'logo_r2_key',
'intro_r2_key',
'outro_r2_key',
'font_r2_key',
] as const);

export async function deleteBrandKitAsset(
userId: string,
asset: 'logo_r2_key' | 'intro_r2_key' | 'outro_r2_key' | 'font_r2_key',
): Promise<void> {
if (!ALLOWED_ASSET_COLUMNS.has(asset)) {
throw new Error(`Invalid asset column: ${asset}`);
}
const db = getD1();
if (!db) return;
db.prepare(`UPDATE brand_kits SET ${asset} = NULL, updated_at = datetime('now') WHERE user_id = ?`)
.bind(userId)
.run();
}
