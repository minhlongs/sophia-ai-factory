/**
 * Command Reference Table — /docs/api
 * Lists all 17 RaaS mission commands with category, model, cost, and key params.
 */

interface CommandRow {
  command: string;
  category: string;
  model: string;
  estCost: string;
  keyParams: string;
}

const COMMANDS: CommandRow[] = [
  { command: 'proposal:create',          category: 'Proposals', model: 'GPT-4o',         estCost: '5 MCU',  keyParams: 'client_name, product_name, tone' },
  { command: 'sales:proposal-deck',      category: 'Proposals', model: 'GPT-4o',         estCost: '5 MCU',  keyParams: 'client_name, product_name' },
  { command: 'video:create',             category: 'Video',     model: 'D-ID / ElevenLabs', estCost: '10 MCU', keyParams: 'script, avatar_id' },
  { command: 'content:blog',             category: 'Content',   model: 'GPT-4o',         estCost: '3 MCU',  keyParams: 'topic, company' },
  { command: 'content:social',           category: 'Content',   model: 'GPT-4o-mini',    estCost: '2 MCU',  keyParams: 'topic, company, platform' },
  { command: 'affiliate:generate',       category: 'Affiliate', model: 'GPT-4o-mini',    estCost: '3 MCU',  keyParams: 'product, niche' },
  { command: 'affiliate:scrape',         category: 'Affiliate', model: 'Scraper',         estCost: '2 MCU',  keyParams: 'url, program_name' },
  { command: 'sales:battlecard',         category: 'Sales',     model: 'GPT-4o',         estCost: '3 MCU',  keyParams: 'competitor, product' },
  { command: 'sales:competitor-analysis', category: 'Sales',   model: 'GPT-4o',         estCost: '5 MCU',  keyParams: 'competitor, market' },
  { command: 'sales:roi-calculator',     category: 'Sales',     model: 'GPT-4o',         estCost: '3 MCU',  keyParams: 'product, target_revenue' },
  { command: 'sales:pricing-optimizer',  category: 'Sales',     model: 'GPT-4o',         estCost: '3 MCU',  keyParams: 'product, competitors' },
  { command: 'sales:outreach-sequence',  category: 'Sales',     model: 'GPT-4o',         estCost: '5 MCU',  keyParams: 'prospect_name, product' },
  { command: 'gtm:campaign',             category: 'GTM',       model: 'GPT-4o',         estCost: '5 MCU',  keyParams: 'product, target_audience' },
  { command: 'lead:generate',            category: 'Leads',     model: 'GPT-4o',         estCost: '5 MCU',  keyParams: 'icp_description, count' },
  { command: 'crm:sync',                 category: 'CRM',       model: 'Integration',    estCost: '1 MCU',  keyParams: 'contact_id, data' },
  { command: 'analytics:export',         category: 'Analytics', model: 'Data',           estCost: '2 MCU',  keyParams: 'report_type, date_range' },
  { command: 'email:send',               category: 'Email',     model: 'Resend',         estCost: '1 MCU',  keyParams: 'to, subject, body' },
];

export function ApiCommandReferenceTable() {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-semibold text-on-surface mb-2">Command Reference</h2>
      <p className="text-on-surface-variant mb-6">
        All 17 available mission commands. Click any command to jump to the interactive docs below.
      </p>
      <div className="overflow-x-auto rounded-xl border border-outline-variant">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-container border-b border-outline-variant">
              <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Command</th>
              <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Category</th>
              <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Model</th>
              <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Est. Cost</th>
              <th className="text-left px-4 py-3 text-on-surface-variant font-medium">Key Params</th>
            </tr>
          </thead>
          <tbody>
            {COMMANDS.map((row, i) => (
              <tr
                key={row.command}
                className={`border-b border-outline-variant last:border-0 hover:bg-surface-container-low transition-colors ${
                  i % 2 === 0 ? 'bg-surface' : 'bg-surface-container-lowest'
                }`}
              >
                <td className="px-4 py-3">
                  <a
                    href={`#${row.command}`}
                    className="font-mono text-primary hover:underline text-xs"
                  >
                    {row.command}
                  </a>
                </td>
                <td className="px-4 py-3 text-on-surface-variant">{row.category}</td>
                <td className="px-4 py-3 text-on-surface-variant font-mono text-xs">{row.model}</td>
                <td className="px-4 py-3 text-on-surface font-medium">{row.estCost}</td>
                <td className="px-4 py-3 text-on-surface-variant font-mono text-xs">{row.keyParams}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
