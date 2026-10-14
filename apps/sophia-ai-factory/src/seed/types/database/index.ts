/**
 * Database Interface Meta-Types Barrel
 *
 * Layer: seed/types/database
 */

import type { DatabaseTables } from './tables';
import type { DatabaseFunctions } from './functions';

export * from './tables';
export * from './functions';

export interface Database {
  public: {
    Tables: DatabaseTables;
    Views: {
      [_ in never]: never;
    };
    Functions: DatabaseFunctions;
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
