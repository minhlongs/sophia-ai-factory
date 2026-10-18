/**
 * Responsive HTML Document Shell for White-Label Emails
 *
 * Layer: tree/branding/styler
 */

import {
  DEFAULT_BG_COLOR,
  DEFAULT_CONTAINER_BG,
  DEFAULT_TEXT_COLOR,
} from './types';
import { escapeHtml } from './css-inliner';

export interface EmailDocumentShellInput {
  agencyName: string;
  locale: 'en' | 'vi';
  width: number;
  primaryColor: string;
  contrastText: string;
  preheaderText?: string;
  headerHtml: string;
  styledBody: string;
  footerHtml: string;
}

export function renderEmailDocumentShell(input: EmailDocumentShellInput): string {
  const {
    agencyName,
    locale,
    width,
    primaryColor,
    contrastText,
    preheaderText,
    headerHtml,
    styledBody,
    footerHtml,
  } = input;

  const preheaderHtml = preheaderText
    ? `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
        ${escapeHtml(preheaderText)}
       </div>`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${locale}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(agencyName)}</title>
  <style type="text/css">
    body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:${DEFAULT_BG_COLOR}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { color:${primaryColor}; text-decoration:none; }
    a:hover { text-decoration:underline; }
    .brand-btn { background-color:${primaryColor} !important; color:${contrastText} !important; border-radius:8px; text-decoration:none; display:inline-block; font-weight:600; padding:14px 28px; }
  </style>
</head>
<body style="margin:0;padding:24px 12px;background-color:${DEFAULT_BG_COLOR};color:${DEFAULT_TEXT_COLOR};">
  ${preheaderHtml}
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:${width}px;background-color:${DEFAULT_CONTAINER_BG};border:1px solid #27272a;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.4);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 16px 32px;" align="center">
              ${headerHtml}
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding:16px 32px 32px 32px;font-size:15px;line-height:24px;color:${DEFAULT_TEXT_COLOR};">
              ${styledBody}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 32px 32px;">
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
