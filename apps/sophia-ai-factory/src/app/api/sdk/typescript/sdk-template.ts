/**
 * Full TypeScript SDK template combiner
 *
 * Layer: app/api/sdk/typescript
 */

import { SDK_TYPES_PART } from './sdk-template-types';
import { SDK_CLIENT_TRANSPORT_PART } from './sdk-template-client-transport';
import { SDK_CLIENT_CORE_PART } from './sdk-template-client-core';
import { SDK_CLIENT_ALGORITHMS_PART } from './sdk-template-client-algorithms';

export const SDK_SOURCE = `${SDK_TYPES_PART}${SDK_CLIENT_TRANSPORT_PART}${SDK_CLIENT_CORE_PART}${SDK_CLIENT_ALGORITHMS_PART}`;
