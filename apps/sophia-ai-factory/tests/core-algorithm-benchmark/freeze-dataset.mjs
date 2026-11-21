import { readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync(process.argv[2], 'utf8');
const cases = [...source.matchAll(/^\| ([VEIA]\d\d) \| (.*?) \| (.*?) \|$/gm)].map(([, id, brief, constraints]) => ({
  id, brief, constraints,
  category: { V: 'vn-smb', E: 'english-bilingual', I: 'clarification', A: 'adversarial' }[id[0]],
  evaluation: ['A05', 'A06', 'A07', 'A08', 'A09'].includes(id) ? 'controlled-fault' : 'creative',
  expectedOutcome: id.startsWith('I') ? 'clarification' : id.startsWith('A') ? 'safety' : 'asset',
}));
if (cases.length !== 50) throw new Error('Expected exactly 50 frozen briefs');
writeFileSync(process.argv[3], JSON.stringify({
  version: 'GOLDEN_OPTION_A_V1', synthetic: true, timezone: 'Asia/Saigon', locale: 'en-US',
  defaults: {
    tier: 'BASIC', initialMcu: 500, validDays: 14,
    delivery: 'Offline draft only; no public posting or video generation.',
    requested: 'One campaign plan, exactly three hooks, one script/caption and one CTA; affiliate disclosure when applicable.',
    facts: 'Use only supplied facts. Clarify essential missing facts; label optional assumptions. Never invent price, efficacy, inventory, testimonials, affiliations or observed performance.',
    funding: 'Own customer OpenRouter key only. Campaign spend is not model authorization. Controlled faults override defaults.',
  }, cases,
}, null, 2) + '\n');
