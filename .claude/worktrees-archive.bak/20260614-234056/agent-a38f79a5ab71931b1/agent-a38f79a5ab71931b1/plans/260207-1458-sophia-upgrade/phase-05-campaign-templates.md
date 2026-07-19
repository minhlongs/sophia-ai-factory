# Phase 05: Campaign Templates

## Context Links

- [Main Plan](./plan.md)
- [Phase 4: Discovery Engine](./phase-04-discovery-engine.md)
- [OpenAI GPT-4 Docs](https://platform.openai.com/docs)
- [PDFKit Documentation](https://pdfkit.org/)

## Overview

**Priority**: P1 (Critical)
**Status**: Pending
**Description**: Build template system for AI-powered campaign content generation, implement export functionality (PDF, CSV, JSON), and create template versioning system.

## Key Insights

- **AI-Powered Generation**: GPT-4 generates campaign content from trend data
- **Template Categories**: Social media, email, blog, ads (4 main types)
- **Export Formats**: PDF (visual), CSV (data), JSON (API)
- **Template Versioning**: Track template changes, allow rollback
- **Personalization**: Use user's niche/brand voice in generation
- **Export Speed**: Target < 5s for PDF generation
- **Storage**: Templates in DB, exports in cloud storage (S3/Vercel Blob)

## Requirements

### Functional Requirements
- Template CRUD operations (create, read, update, delete)
- AI content generation using GPT-4
- Template categories (social, email, blog, ads)
- Variable substitution system ({{trend.title}}, {{user.brand}})
- Export to PDF with branding
- Export to CSV for data analysis
- Export to JSON for API integration
- Template versioning and history
- Template preview before export
- Bulk export (multiple campaigns at once)

### Non-Functional Requirements
- Content generation time < 3s per campaign
- PDF export time < 5s
- Support 100+ templates
- Export file size < 5MB
- Template rendering preview < 1s
- Concurrent exports (10 users)

## Architecture

```
src/
├── lib/
│   ├── templates/
│   │   ├── template-engine.ts              # Template rendering
│   │   ├── template-storage-service.ts     # CRUD operations
│   │   ├── template-versioning-service.ts  # Version control
│   │   └── template-types.ts               # TypeScript types
│   ├── campaigns/
│   │   ├── campaign-generator.ts           # AI content generation
│   │   ├── campaign-storage-service.ts     # Campaign CRUD
│   │   └── campaign-types.ts               # TypeScript types
│   ├── exports/
│   │   ├── pdf-exporter.ts                 # PDF generation
│   │   ├── csv-exporter.ts                 # CSV generation
│   │   ├── json-exporter.ts                # JSON generation
│   │   └── export-storage-service.ts       # Cloud storage
│   └── ai/
│       └── campaign-prompt-builder.ts      # GPT-4 prompt engineering
└── app/api/
    ├── campaigns/
    │   ├── generate/route.ts               # Generate campaign
    │   ├── export/route.ts                 # Export campaign
    │   └── [id]/route.ts                   # Get/update campaign
    └── templates/
        ├── route.ts                        # List templates
        └── [id]/route.ts                   # Get template

Database Schema (Supabase):
templates
├── id (uuid, PK)
├── name (text)
├── category (enum: social, email, blog, ads)
├── content (text)                # Mustache template with {{variables}}
├── variables (jsonb)             # Available variables
├── version (int)
├── parent_id (uuid, FK → templates.id)
├── created_by (uuid, FK → users)
├── created_at (timestamp)
└── updated_at (timestamp)

campaigns
├── id (uuid, PK)
├── user_id (bigint, FK → users.telegram_id)
├── trend_id (uuid, FK → trends.id)
├── template_id (uuid, FK → templates.id)
├── title (text)
├── content (jsonb)               # Generated content sections
├── status (enum: draft, ready, exported)
├── export_urls (jsonb)           # {pdf, csv, json} URLs
├── created_at (timestamp)
└── updated_at (timestamp)
```

**Data Flow**:
1. User selects trend from discovery results
2. Bot shows template categories (social, email, blog, ads)
3. User selects template
4. Bot calls `/api/campaigns/generate`
5. GPT-4 generates content based on trend + template
6. Campaign saved as draft
7. User previews and edits content
8. User selects export format (PDF, CSV, JSON)
9. Bot calls `/api/campaigns/export`
10. File uploaded to Vercel Blob
11. Download link sent to Telegram

## Related Code Files

### Files to Create
- `src/lib/templates/template-engine.ts` - Mustache rendering
- `src/lib/templates/template-storage-service.ts` - Template CRUD
- `src/lib/templates/template-versioning-service.ts` - Version control
- `src/lib/templates/template-types.ts` - TypeScript types
- `src/lib/campaigns/campaign-generator.ts` - AI content generation
- `src/lib/campaigns/campaign-storage-service.ts` - Campaign CRUD
- `src/lib/campaigns/campaign-types.ts` - TypeScript types
- `src/lib/exports/pdf-exporter.ts` - PDF generation (PDFKit)
- `src/lib/exports/csv-exporter.ts` - CSV generation
- `src/lib/exports/json-exporter.ts` - JSON generation
- `src/lib/exports/export-storage-service.ts` - Vercel Blob storage
- `src/lib/ai/campaign-prompt-builder.ts` - GPT-4 prompts
- `src/app/api/campaigns/generate/route.ts` - Generate endpoint
- `src/app/api/campaigns/export/route.ts` - Export endpoint
- `src/app/api/campaigns/[id]/route.ts` - Get/update campaign
- `src/app/api/templates/route.ts` - List templates
- `src/app/api/templates/[id]/route.ts` - Get template
- `supabase/migrations/005_templates_campaigns.sql` - Schema migration
- `src/lib/templates/default-templates.ts` - Seed templates

### Files to Modify
- `src/bot/commands/campaign-command-handler.ts` - Integrate campaign flow
- `.env.example` - Add `VERCEL_BLOB_READ_WRITE_TOKEN`

## Implementation Steps

1. **Create Database Schema**
   ```sql
   -- supabase/migrations/005_templates_campaigns.sql
   CREATE TABLE templates (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL,
     category TEXT CHECK (category IN ('social', 'email', 'blog', 'ads')),
     content TEXT NOT NULL,
     variables JSONB DEFAULT '{}',
     version INT DEFAULT 1,
     parent_id UUID REFERENCES templates(id),
     created_by UUID,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE campaigns (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id BIGINT NOT NULL,
     trend_id UUID REFERENCES trends(id),
     template_id UUID REFERENCES templates(id),
     title TEXT NOT NULL,
     content JSONB NOT NULL,
     status TEXT CHECK (status IN ('draft', 'ready', 'exported')),
     export_urls JSONB DEFAULT '{}',
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE INDEX idx_templates_category ON templates(category);
   CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
   CREATE INDEX idx_campaigns_status ON campaigns(status);
   ```

2. **Create Default Templates**
   - Create `src/lib/templates/default-templates.ts`
   - Seed 10+ templates:
     ```typescript
     export const DEFAULT_TEMPLATES = [
       {
         name: 'Twitter Thread',
         category: 'social',
         content: `{{trend.title}}

         Thread 🧵 (1/{{thread_length}})

         {{sections}}

         What do you think? Drop your thoughts below! 👇`,
         variables: ['trend.title', 'thread_length', 'sections']
       },
       {
         name: 'Email Newsletter',
         category: 'email',
         content: `Subject: {{subject}}

         Hi {{user.name}},

         {{intro}}

         {{main_content}}

         {{cta}}

         Best,
         {{user.brand}}`,
         variables: ['subject', 'user.name', 'intro', 'main_content', 'cta', 'user.brand']
       }
       // ... more templates
     ];
     ```

3. **Build Template Engine**
   - Create `src/lib/templates/template-engine.ts`
   - Use Mustache.js for variable substitution
   - Methods:
     ```typescript
     render(template: string, data: object): string
     validate(template: string): boolean
     extractVariables(template: string): string[]
     ```

4. **Build Campaign Generator**
   - Create `src/lib/campaigns/campaign-generator.ts`
   - GPT-4 prompt engineering:
     ```typescript
     const prompt = `Generate a ${template.category} campaign based on this trend:

     Trend: ${trend.title}
     Description: ${trend.description}
     Keywords: ${trend.keywords.join(', ')}

     Template structure:
     ${template.content}

     Brand voice: ${user.brandVoice || 'professional and engaging'}

     Generate compelling content that:
     1. Hooks the reader immediately
     2. Provides value and insights
     3. Includes a clear call-to-action
     4. Matches the brand voice

     Return JSON with all required variables filled.`;

     const response = await openai.chat.completions.create({
       model: 'gpt-4',
       messages: [{ role: 'user', content: prompt }],
       response_format: { type: 'json_object' }
     });
     ```

5. **Build PDF Exporter**
   - Create `src/lib/exports/pdf-exporter.ts`
   - Use PDFKit or react-pdf
   - Features:
     - Custom branding (logo, colors)
     - Formatted text with sections
     - Headers/footers
     - Page numbers
   - Example:
     ```typescript
     import PDFDocument from 'pdfkit';

     export async function exportToPDF(campaign: Campaign) {
       const doc = new PDFDocument();
       doc.fontSize(20).text(campaign.title, 100, 100);
       doc.fontSize(12).text(campaign.content.main, 100, 150);
       // ... add more content
       doc.end();
       return doc;
     }
     ```

6. **Build CSV Exporter**
   - Create `src/lib/exports/csv-exporter.ts`
   - Export campaign data as tabular format
   - Columns: title, content, trend_url, keywords, created_at
   - Use `csv-stringify` library

7. **Build JSON Exporter**
   - Create `src/lib/exports/json-exporter.ts`
   - Export full campaign object
   - Include metadata, trend data, generated content
   - Minified JSON format

8. **Build Export Storage Service**
   - Create `src/lib/exports/export-storage-service.ts`
   - Use Vercel Blob Storage
   - Methods:
     ```typescript
     async uploadFile(file: Buffer, filename: string): Promise<string>
     async getFile(url: string): Promise<Buffer>
     async deleteFile(url: string): Promise<void>
     ```
   - Generate signed URLs with 7-day expiry

9. **Build Template Versioning**
   - Create `src/lib/templates/template-versioning-service.ts`
   - On template update: Create new row with incremented version
   - Link to parent via `parent_id`
   - Methods:
     ```typescript
     createVersion(templateId: string, updates: object): Promise<Template>
     getVersionHistory(templateId: string): Promise<Template[]>
     rollback(templateId: string, version: number): Promise<Template>
     ```

10. **Create API Endpoints**

    **Generate Campaign**:
    ```typescript
    // src/app/api/campaigns/generate/route.ts
    export async function POST(request: Request) {
      const { trendId, templateId, userId } = await request.json();

      const trend = await getTrend(trendId);
      const template = await getTemplate(templateId);
      const user = await getUser(userId);

      const content = await campaignGenerator.generate(trend, template, user);
      const campaign = await campaignStorage.create({
        user_id: userId,
        trend_id: trendId,
        template_id: templateId,
        title: trend.title,
        content,
        status: 'draft'
      });

      return Response.json({ campaign });
    }
    ```

    **Export Campaign**:
    ```typescript
    // src/app/api/campaigns/export/route.ts
    export async function POST(request: Request) {
      const { campaignId, format } = await request.json();
      const campaign = await getCampaign(campaignId);

      let exportUrl: string;
      switch (format) {
        case 'pdf':
          const pdf = await pdfExporter.export(campaign);
          exportUrl = await exportStorage.upload(pdf, `campaign-${campaignId}.pdf`);
          break;
        case 'csv':
          const csv = await csvExporter.export(campaign);
          exportUrl = await exportStorage.upload(csv, `campaign-${campaignId}.csv`);
          break;
        case 'json':
          const json = await jsonExporter.export(campaign);
          exportUrl = await exportStorage.upload(json, `campaign-${campaignId}.json`);
          break;
      }

      await updateCampaign(campaignId, { export_urls: { [format]: exportUrl } });
      return Response.json({ exportUrl });
    }
    ```

11. **Update Campaign Command**
    - Modify `src/bot/commands/campaign-command-handler.ts`
    - Flow:
      1. Show template categories
      2. User selects category → show templates
      3. User selects template → generate campaign
      4. Show preview with inline keyboard (Edit | Export)
      5. If export: Show format options (PDF | CSV | JSON)
      6. Send download link to user

12. **Seed Default Templates**
    - Create migration script to insert default templates
    - Run: `npm run db:seed`

13. **Test Campaign Flow**
    - Test generation with different templates
    - Verify AI content quality
    - Test all export formats
    - Verify file storage (Vercel Blob)
    - Test template versioning

## Todo List

- [ ] Create `templates` and `campaigns` tables
- [ ] Run migrations on Supabase
- [ ] Create default templates file (10+ templates)
- [ ] Build template engine with Mustache.js
- [ ] Build template storage service (CRUD)
- [ ] Build template versioning service
- [ ] Build campaign generator with GPT-4
- [ ] Build campaign storage service (CRUD)
- [ ] Install PDFKit dependency
- [ ] Build PDF exporter with branding
- [ ] Build CSV exporter
- [ ] Build JSON exporter
- [ ] Setup Vercel Blob Storage
- [ ] Build export storage service
- [ ] Create `/api/campaigns/generate` endpoint
- [ ] Create `/api/campaigns/export` endpoint
- [ ] Create `/api/campaigns/[id]` endpoint
- [ ] Create `/api/templates` endpoint
- [ ] Update `/campaign` command with full flow
- [ ] Seed default templates to database
- [ ] Test campaign generation with all templates
- [ ] Test all export formats (PDF, CSV, JSON)
- [ ] Verify file uploads to Vercel Blob
- [ ] Test template versioning and rollback
- [ ] Test concurrent exports (10 users)

## Success Criteria

- [x] Campaign generates in < 3s
- [x] PDF exports in < 5s with branding
- [x] CSV export includes all campaign data
- [x] JSON export is valid and minified
- [x] Template engine renders variables correctly
- [x] Template versioning tracks all changes
- [x] AI content matches template structure
- [x] All export files < 5MB
- [x] Download links work in Telegram
- [x] Template categories render correctly
- [x] 10+ default templates available

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| GPT-4 content quality issues | Medium | High | Fine-tune prompts, add content validation |
| PDF generation timeout | Low | Medium | Optimize rendering, use lighter fonts |
| Vercel Blob storage limits | Low | Medium | Monitor usage, implement cleanup for old exports |
| Template rendering errors | Medium | Low | Validate templates before saving, test thoroughly |
| Export file size exceeds limit | Low | Low | Compress PDFs, limit content length |

## Security Considerations

- **Template Injection**: Sanitize user inputs in templates
- **File Storage**: Use signed URLs with expiry (7 days)
- **Content Validation**: Sanitize AI-generated content before export
- **Rate Limiting**: Limit exports to 10/day per user
- **Storage Cleanup**: Auto-delete exports after 30 days
- **API Keys**: Store OpenAI key in Vercel env vars

## Next Steps

After Phase 5 completion:
1. Proceed to [Phase 6: Testing & Shipping](./phase-06-testing-shipping.md)
2. Test full campaign flow end-to-end
3. Collect user feedback on content quality
4. Monitor export performance and storage usage
5. Fine-tune GPT-4 prompts based on results
