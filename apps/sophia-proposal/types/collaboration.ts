/**
 * Team Collaboration Types
 */

// User role
export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

// Comment on proposal
export interface ProposalComment {
  id: string;
  proposalId: string;
  userId: string;
  userName: string;
  sectionId?: string;
  content: string;
  resolved: boolean;
  createdAt: string;
  updatedAt?: string;
}

// Real-time sync state
export interface CollaborationState {
  proposalId: string;
  users: Collaborator[];
  activeCursor?: {
    userId: string;
    position: number;
  };
  lastSyncAt: string;
}

// Active collaborator
export interface Collaborator {
  userId: string;
  userName: string;
  email: string;
  role: UserRole;
  joinedAt: string;
  lastActiveAt: string;
  cursorPosition?: number;
}

// Version history
export interface ProposalVersion {
  id: string;
  proposalId: string;
  userId: string;
  userName: string;
  content: string;
  changeSummary?: string;
  createdAt: string;
}

// Permission check
export interface PermissionCheck {
  canEdit: boolean;
  canComment: boolean;
  canShare: boolean;
  canDelete: boolean;
}
