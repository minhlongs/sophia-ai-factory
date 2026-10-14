export const OUTPUT_SCHEMA = JSON.stringify({
  type: 'object',
  required: ['demo_reel_url', 'final_video_url'],
  properties: {
    demo_reel_url: { type: 'string' },
    final_video_url: { type: 'string' },
    approval_email_sent: { type: 'boolean' },
    invoice_url: { type: 'string' },
  },
});

export const CONFIG_SCHEMA = JSON.stringify({
  properties: {
    agency_name: {
      type: 'string',
      title: 'Agency Name',
      placeholder: 'e.g. AvatarStudio Pro',
    },
    target_market: {
      type: 'string',
      title: 'Target Market',
      enum: ['saas_companies', 'ecommerce', 'real_estate', 'coaching', 'general_b2b'],
      default: 'saas_companies',
    },
    brand_name: {
      type: 'string',
      title: 'Client Brand Name',
      placeholder: 'e.g. TechCorp Inc',
    },
    client_brief: {
      type: 'string',
      title: 'Client Video Brief',
      placeholder: 'e.g. 60s explainer video for SaaS onboarding flow',
    },
    avatar_style: {
      type: 'string',
      title: 'Avatar Style',
      enum: ['professional', 'casual', 'presenter', 'custom'],
      default: 'professional',
    },
    video_tone: {
      type: 'string',
      title: 'Video Tone',
      enum: ['professional', 'friendly', 'authoritative', 'inspirational'],
      default: 'professional',
    },
    language: {
      type: 'string',
      title: 'Language',
      enum: ['en', 'vi'],
      default: 'en',
    },
    output_format: {
      type: 'string',
      title: 'Output Format',
      enum: ['landscape_16x9', 'vertical_9x16', 'square_1x1'],
      default: 'landscape_16x9',
    },
    service_tier: {
      type: 'string',
      title: 'Service Tier',
      enum: ['Starter', 'Growth', 'Enterprise'],
      default: 'Growth',
    },
    tier_price: {
      type: 'number',
      title: 'Tier Price (USD/mo)',
      default: 1500,
    },
  },
  required: ['agency_name', 'target_market'],
});

export const CONFIG_DEFAULTS = JSON.stringify({
  target_market: 'saas_companies',
  avatar_style: 'professional',
  video_tone: 'professional',
  language: 'en',
  output_format: 'landscape_16x9',
  service_tier: 'Growth',
  tier_price: 1500,
});
