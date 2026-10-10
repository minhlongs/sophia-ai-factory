export interface KeyVersionItem {
  id: string;
  key_type: string;
  version: number;
  created_at: string;
  rotated_at: string | null;
  rotated_by: string | null;
  is_active: number;
}

export interface AuditLogItem {
  id: string;
  action: string;
  user_id: string | null;
  details: string | null;
  created_at: number | string;
}

export interface ByokRotationClientProps {
  locale: string;
  currentVersion: KeyVersionItem | null;
  versionHistory: KeyVersionItem[];
  auditLogs: AuditLogItem[];
}
