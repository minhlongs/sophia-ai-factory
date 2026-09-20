# Technical Analysis: Executive BI Digest Dispatcher & Formatting Engines (Milestone 3)

**Agent**: `teamwork_preview_explorer_m3_2`  
**Milestone**: Milestone 3 (Executive BI & Automated Reporting Engine)  
**Date**: 2026-09-20  
**Target Files**:
- `apps/sophia-ai-factory/src/forest/bi/telegram-digest-sender.ts`
- `apps/sophia-ai-factory/src/forest/bi/email-digest-sender.ts`
- `apps/sophia-ai-factory/src/forest/bi/executive-digest-dispatcher.ts`

---

## 1. E2E Test Contract & Harness Deep-Dive

### 1.1 Telegram Digest Formatting (F2: `executive-bi.e2e.test.ts`)
The test suite in `apps/sophia-ai-factory/src/__tests__/e2e/enterprise/executive-bi.e2e.test.ts` establishes 5 strict contract tests for Telegram digest formatting:
1. **F2-1: Key Performance Indicators & Escaping**:
   - `formatTelegramDigest(metrics, { agencyName: 'Apex Viral Agency' })`
   - Must contain agency name `Apex Viral Agency`.
   - Currency and decimals must have periods escaped in MarkdownV2: `5432\\.00`, `12500\\.00`, `89\\.5/100`, `3\\.57x`.
   - Throughput must format as `${throughputCount} videos`.
2. **F2-2: Strict MarkdownV2 Character Escaping**:
   - `escapeTelegramMarkdownV2('_ * [ ] ( ) ~ ` > # + - = | { } . !')`
   - Must return `\\_ \\* \\[ \\] \\( \\) \\~ \\` \\> \\# \\+ \\- \\= \\| \\{ \\} \\. \\!`.
   - Exactly all 18 Telegram MarkdownV2 reserved characters + `\`.
3. **F2-3: Telegram 4096-Character Limit Compliance**:
   - For long content (e.g. repeated agency names or multi-channel breakdowns), the output must adhere to `< 4096` characters.
4. **F2-4: Default Branding Fallback**:
   - When branding is omitted (`branding === undefined`), agency name must default to `'Sophia AI Factory'`.
5. **F2-5: Currency Formatting From Integer Cents**:
   - `99` cents -> `0\\.99`
   - `10000` cents -> `100\\.00`

### 1.2 Branded HTML Email Digest Formatting (F3: `executive-bi.e2e.test.ts`)
The test suite establishes 5 strict contract tests for Email digest formatting:
1. **F3-1: White-Label Email Container & Branding Injection**:
   - Must render agency name (`Horizon Media Group`), primary color (`#2563eb`), logo URL (`https://horizon.com/logo.png`), and report title (`Executive Monthly Performance Report`).
   - Must contain the metrics values including `Affiliate ROI: 4.2x`.
2. **F3-2: Valid HTML Doctype & Markup Container**:
   - Must contain `<!DOCTYPE html>` doctype.
   - Must contain `<table width="100%"`.
3. **F3-3: Powered-By Footer Verification**:
   - Must contain `Powered by Sophia Enterprise Scale Engine`.
4. **F3-4: HTML Injection & XSS Sanitization in Header**:
   - When `agencyName` contains `<img src=x onerror=alert(1)> Agency`, it must NOT contain `<img src=x onerror=alert(1)>`.
   - It must escape to `&lt;img src=x onerror=alert(1)&gt; Agency`.
5. **F3-5: Multi-Paragraph Layout Preservation**:
   - Handles multi-paragraph digest layouts cleanly without stripping or corrupting inner HTML tags.

---

## 2. Telegram MarkdownV2 Escaping & 4096-Character Safe Chunking

### 2.1 The Telegram MarkdownV2 Character Set
Telegram Bot API spec defines that inside MarkdownV2 text:
Any character with code between 1 and 126 inclusively can be escaped with a preceding `\`.
The following 18 characters MUST be escaped:
`_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`
Along with `\` itself.

The canonical regular expression is:
```typescript
export const TELEGRAM_MARKDOWN_V2_SPECIALS = /([_*[\]()~`>#+\-=|{}.!\\])/g;

export function escapeTelegramMarkdownV2(text: string): string {
  return text.replace(TELEGRAM_MARKDOWN_V2_SPECIALS, '\\$1');
}
```

### 2.2 The 4096-Character Safe Splitting Problem
Telegram's `sendMessage` endpoint rejects any message body with `length > 4096` UTF-16 code units (`HTTP 400 Bad Request: message is too long`).

#### Failure Modes in Naive Splitting:
1. **Dangling Backslash (Escape Sequence Severing)**:
   - If cut occurs between `\` and `.`, Chunk 1 ends with `\` and Chunk 2 starts with `.`.
   - Chunk 1 fails: `Bad Request: can't parse entities: Character '\' is reserved`.
   - Chunk 2 fails: `Bad Request: can't parse entities: Character '.' is reserved and must be escaped`.
2. **Surrogate Pair Severing (Emoji Corruption)**:
   - High surrogate (`0xD800`–`0xDBFF`) separated from low surrogate (`0xDC00`–`0xDFFF`) creates invalid Unicode characters (``) and ruins mobile rendering.
3. **Paired Entity Severing**:
   - Splitting inside `*bold*`, `_italic_`, `[label](url)`, or ```` ```code``` ```` leaves unclosed tokens in Chunk 1 and unexpected tokens in Chunk 2.

#### Safe Splitting Algorithm (`splitTelegramMarkdownV2`):
```typescript
export function splitTelegramMarkdownV2(
  text: string,
  maxChunkSize: number = 4000
): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining);
      break;
    }

    let cutIndex = maxChunkSize;
    const window = remaining.slice(0, maxChunkSize);

    // 1. Prefer natural boundaries: paragraph -> newline -> space
    const doubleNewline = window.lastIndexOf('\n\n');
    const singleNewline = window.lastIndexOf('\n');
    const space = window.lastIndexOf(' ');

    if (doubleNewline >= maxChunkSize * 0.3) {
      cutIndex = doubleNewline + 2;
    } else if (singleNewline >= maxChunkSize * 0.3) {
      cutIndex = singleNewline + 1;
    } else if (space >= maxChunkSize * 0.3) {
      cutIndex = space + 1;
    }

    // 2. Guard against surrogate pair splitting
    if (cutIndex > 0) {
      const prevCode = remaining.charCodeAt(cutIndex - 1);
      if (prevCode >= 0xd800 && prevCode <= 0xdbff) {
        cutIndex -= 1;
      }
    }

    // 3. Guard against severed escape sequences (odd trailing backslashes)
    let backslashCount = 0;
    for (let i = cutIndex - 1; i >= 0 && remaining[i] === '\\'; i--) {
      backslashCount++;
    }
    if (backslashCount % 2 === 1) {
      cutIndex -= 1;
    }

    const currentChunk = remaining.slice(0, cutIndex).trimEnd();
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    remaining = remaining.slice(cutIndex).trimStart();
  }

  return chunks;
}
```

---

## 3. White-Label HTML Email Layout & KPI Card Design

### 3.1 Architecture of White-Label Email Formatting
In Milestone 1, `src/tree/branding/email-styler.ts` established the foundation:
- `wrapWithAgencyBranding(htmlContent: string, branding: BrandingSettings): string`
- `formatWhiteLabelEmail(htmlBody, branding, options)`
- `getContrastTextColor(hexColor: string)` conforming to WCAG AA luminance contrast (>4.5:1 text, >3.0:1 UI components).
- `isValidHttpUrl(url)` preventing pseudo-protocol XSS (`javascript:`, `data:`).

In `forest/bi/email-digest-sender.ts`, the executive digest generator builds the inner HTML containing:
1. Executive Performance Title & Subtitle.
2. Responsive 2x2 Metrics Card Table.
3. Structured Semantic List for Plain/Accessibility Clients.
4. Call-to-Action (CTA) Button to the Executive Dashboard.
And then passes the HTML to `wrapWithAgencyBranding` (or `formatWhiteLabelEmail`).

### 3.2 2x2 KPI Cards Responsive Layout
Email clients have notoriously inconsistent CSS support. Tables with inline CSS remain the industry standard:

```html
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
  <tr>
    <!-- Card 1: MRR -->
    <td width="48%" style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
      <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Monthly Recurring Revenue</div>
      <div style="font-size: 26px; font-weight: 700; color: ${primaryColor}; margin: 8px 0 4px 0;">$${mrrUsd}</div>
      <div style="font-size: 12px; color: #94a3b8;">Peak MRR this period</div>
    </td>
    <td width="4%">&nbsp;</td>
    <!-- Card 2: Video Throughput -->
    <td width="48%" style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
      <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Video Throughput</div>
      <div style="font-size: 26px; font-weight: 700; color: #0f172a; margin: 8px 0 4px 0;">${metrics.throughputCount} videos</div>
      <div style="font-size: 12px; color: #94a3b8;">Autonomous multi-track renders</div>
    </td>
  </tr>
  <tr><td height="16" colspan="3">&nbsp;</td></tr>
  <tr>
    <!-- Card 3: Viral Score -->
    <td width="48%" style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
      <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Viral Score</div>
      <div style="font-size: 26px; font-weight: 700; color: #0f172a; margin: 8px 0 4px 0;">${metrics.viralScore}/100</div>
      <div style="font-size: 12px; color: #94a3b8;">Average engagement index</div>
    </td>
    <td width="4%">&nbsp;</td>
    <!-- Card 4: Affiliate ROI -->
    <td width="48%" style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
      <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Affiliate ROI</div>
      <div style="font-size: 26px; font-weight: 700; color: #10b981; margin: 8px 0 4px 0;">${metrics.roiRatio}x</div>
      <div style="font-size: 12px; color: #94a3b8;">$${affiliateUsd} rev / $${spendUsd} spend</div>
    </td>
  </tr>
</table>
```

---

## 4. 4-Layer Architecture Discipline

The canonical dependency rule:
- `seed`: Types, contracts (`ExecutiveBIMetricsSummary`, `DigestDeliveryReceipt`).
- `tree`: Pure domain logic, pure formatters (`formatTelegramDigest`, `escapeTelegramMarkdownV2`, `wrapWithAgencyBranding`).
- `forest`: Side-effect executors, network dispatchers (`telegram-digest-sender.ts`, `email-digest-sender.ts`, `executive-digest-dispatcher.ts`).
- `land`: Server actions & edge route handlers (`app/api/v1/analytics/export/route.ts`).

Both `telegram-digest-sender.ts` and `email-digest-sender.ts` belong strictly to `forest/bi/`:
- They perform outbound network requests (`fetch` to Resend API and Telegram Bot API).
- They incorporate circuit-breaker tracking (`shouldAllowRequest`, `recordSuccess`, `recordFailure`).
- They can import from `@/seed/*`, `@/tree/*`, and `@/forest/*`.
- They will NOT be imported by `tree` or `seed`, ensuring 0 layer boundary errors.
