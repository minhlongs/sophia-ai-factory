'use client';

import {
  AffiliateOfferDrawerView,
  type AffiliateOfferDrawerProps,
} from './drawer';

export type { AffiliateOfferDrawerProps };

export function AffiliateOfferDrawer(props: AffiliateOfferDrawerProps) {
  return <AffiliateOfferDrawerView {...props} />;
}

export default AffiliateOfferDrawer;
