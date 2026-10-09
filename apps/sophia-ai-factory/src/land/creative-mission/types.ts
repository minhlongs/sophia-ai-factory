/**
 * @module land/creative-mission/types
 * Type definitions for creative mission server actions.
 *
 * Layer: land — imports seed only.
 */

import type { z } from 'zod';
import type { executeMultiTrackMissionSchema } from './schemas';

export type MissionError = {
  code: string;
  message: string;
};

export type MissionAction = {
  missionId: string;
};

export type ExecuteMultiTrackMissionInput = z.infer<typeof executeMultiTrackMissionSchema>;
