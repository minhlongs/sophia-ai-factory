/**
 * CategoryBadge tests — verify category labels render in Vi + En.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { CategoryBadge } from './category-badge';
import type { SopTemplateRow } from '@/lib/sop/sop-types';

const enMessages = {
  sop: {
    categories: {
      content: 'Content',
      leads: 'Leads',
      email: 'Email',
      analytics: 'Analytics',
      proposals: 'Proposals',
      crisis: 'Crisis PR',
    },
  },
};

const viMessages = {
  sop: {
    categories: {
      content: 'Nội Dung',
      leads: 'Khách Hàng',
      email: 'Email',
      analytics: 'Phân Tích',
      proposals: 'Đề Xuất',
      crisis: 'Xử Lý Khủng Hoảng',
    },
  },
};

function wrapEn(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={enMessages}>{ui}</NextIntlClientProvider>);
}

function wrapVi(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="vi" messages={viMessages}>{ui}</NextIntlClientProvider>);
}

type Category = SopTemplateRow['category'];
const categories: Category[] = ['content', 'leads', 'email', 'analytics', 'proposals', 'crisis'];

describe('CategoryBadge', () => {
  for (const cat of categories) {
    it(`renders ${cat} in English`, () => {
      const { getByText } = wrapEn(<CategoryBadge category={cat} />);
      expect(getByText(enMessages.sop.categories[cat])).toBeTruthy();
    });

    it(`renders ${cat} in Vietnamese`, () => {
      const { getByText } = wrapVi(<CategoryBadge category={cat} />);
      expect(getByText(viMessages.sop.categories[cat])).toBeTruthy();
    });
  }

  it('applies custom className', () => {
    const { container } = wrapEn(<CategoryBadge category="content" className="ml-4" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('ml-4');
  });
});
