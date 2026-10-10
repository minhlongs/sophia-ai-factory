/**
 * Organization Types & DTOs
 * Layer: Land (Admin)
 */

export interface OrgRow {
  id: string;
  name: string;
  memberCount: number;
}

export interface OrgWithMeta extends OrgRow {
  description: string | null;
  createdAt: string;
}

export interface MemberRow {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
}

export interface OrgDetail extends OrgRow {
  description: string | null;
  createdAt: string;
  members: MemberRow[];
}
