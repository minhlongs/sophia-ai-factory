/**
 * Database Functions & RPC Stored Procedure Types
 *
 * Layer: seed/types/database
 */

import type { Json } from '../json';

export interface DatabaseFunctions {
  increment_rate_limit: {
    Args: {
      p_identifier: string;
      p_window_seconds?: number;
    };
    Returns: {
      current_count: number;
    }[];
  };
  check_telegram_rate_limit: {
    Args: {
      p_chat_id: string;
      p_command_type?: string;
      p_max_requests?: number;
      p_window_seconds?: number;
    };
    Returns: {
      allowed: boolean;
      current_count: number;
      remaining: number;
      oldest_timestamp: string;
    }[];
  };
  cleanup_expired_rate_limits: {
    Args: {
      p_retention_hours?: number;
    };
    Returns: {
      deleted_count: number;
    }[];
  };
  get_telegram_user_session: {
    Args: {
      p_chat_id: string;
    };
    Returns: {
      session_id: string;
      state: string;
      context_data: Json;
      subscription_tier: string | null;
      auth_cache: Json;
      expires_at: string | null;
    }[];
  };
  set_telegram_user_state: {
    Args: {
      p_chat_id: string;
      p_state: string;
      p_context_data?: Json;
    };
    Returns: string;
  };
  link_telegram_user: {
    Args: {
      p_chat_id: string;
      p_user_id: string;
    };
    Returns: string;
  };
  get_user_by_telegram_chat_id: {
    Args: {
      p_chat_id: string;
    };
    Returns: string;
  };
  clear_telegram_session: {
    Args: {
      p_chat_id: string;
    };
    Returns: boolean;
  };
  update_session_subscription_tier: {
    Args: {
      p_chat_id: string;
      p_tier: string;
    };
    Returns: boolean;
  };
}
