-- Seed: 10 curated affiliate offers from public networks.
-- Commission rates verified from each network's public docs (2026-04-29).

INSERT OR IGNORE INTO affiliate_offers_catalog (offer_name, network, url, commission_rate, category, description) VALUES
  ('Bluehost Web Hosting', 'shareasale', 'https://www.bluehost.com/track/affiliateprogram/', 65.0, 'hosting', 'Earn $65+ per qualified sign-up. Top-tier WordPress hosting with 99.9% uptime.'),
  ('SEMrush SEO Toolkit', 'impact', 'https://www.semrush.com/lp/affiliate-program/', 40.0, 'seo', 'Recurring 40% commission on each new subscription. Industry-leading SEO + content marketing platform.'),
  ('ConvertKit Email Marketing', 'cj', 'https://convertkit.com/affiliates', 30.0, 'email', '30% lifetime recurring commission. Email automation built for creators.'),
  ('Teachable Online Courses', 'impact', 'https://teachable.com/affiliate-program', 30.0, 'education', '30% recurring commission per active customer. Sell courses, coaching, downloads.'),
  ('Canva Pro Design', 'impact', 'https://www.canva.com/affiliates/', 80.0, 'design', '$36 per Pro subscription + $80 per Enterprise. Drag-and-drop graphic design tool.'),
  ('NordVPN Privacy', 'cj', 'https://nordvpn.com/affiliate-program/', 100.0, 'security', '100% commission on monthly + 40% on annual plans. Trusted VPN with 14M+ users.'),
  ('Shopify E-commerce', 'impact', 'https://www.shopify.com/affiliates', 200.0, 'ecommerce', 'Up to $150 USD bounty per merchant referral + bonuses. Build online stores in minutes.'),
  ('ClickFunnels 2.0', 'clickbank', 'https://www.clickfunnels.com/affiliates', 30.0, 'marketing', '30% recurring commission for life. Sales funnel and landing page builder.'),
  ('Amazon Associates Bestsellers', 'amazon', 'https://affiliate-program.amazon.com/', 4.0, 'general', 'Up to 10% commission across millions of products. Largest e-commerce affiliate program.'),
  ('Wealthy Affiliate Training', 'shareasale', 'https://www.wealthyaffiliate.com/affiliates', 50.0, 'education', '$23.50 first month + $235/year recurring per Premium referral. Affiliate marketing training platform.');
