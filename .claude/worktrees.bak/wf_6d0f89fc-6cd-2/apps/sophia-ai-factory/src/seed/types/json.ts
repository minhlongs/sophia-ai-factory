/**
 * JSON type alias
 *
 * Recursive type for arbitrary JSON values.
 * @module seed/types/json
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
