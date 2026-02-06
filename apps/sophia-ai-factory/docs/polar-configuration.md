# Polar.sh Configuration & Payout Details

## Payout Configuration (Wise / Vietnam)

These details are for configuring the Payout settings in the Polar.sh Dashboard.

**Bank Details:**
- **Bank:** ACB (Ngân hàng Á Châu / Asia Commercial Bank)
- **Account Number:** 5566776868
- **Account Holder:** TRẦN THIỆN LÂM
- **Branch:** ACB Chi nhánh Đồng Tháp
- **CITID/Bank Code:** 87307001
- **Address:** 352 Nguyen Sinh Sac, Sa Dec Ward, Dong Thap Province, Vietnam

## Environment Variables

Ensure the following variables are set in your `.env` file (and Vercel):

```bash
# Polar.sh Configuration
POLAR_ACCESS_TOKEN=your_polar_access_token
POLAR_WEBHOOK_SECRET=your_polar_webhook_secret

# Product IDs (Mapped to Tiers)
POLAR_PRODUCT_ID_STARTER=...
POLAR_PRODUCT_ID_GROWTH=...
POLAR_PRODUCT_ID_PREMIUM=...
```
