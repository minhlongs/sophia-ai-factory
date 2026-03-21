/**
 * Real-time Sync Provider
 */

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Collaborator, CollaborationState } from '@/types/collaboration';

interface CollaborationContextType {
  state: CollaborationState | null;
  users: Collaborator[];
  isOnline: boolean;
  updateUserCursor: (position: number) => void;
}

const CollaborationContext = createContext<CollaborationContextType | null>(null);

export function CollaborationProvider({
  children,
  proposalId,
  userId,
}: {
  children: React.ReactNode;
  proposalId: string;
  userId: string;
}) {
  const [state, setState] = useState<CollaborationState | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Connect to WebSocket for real-time sync
    const ws = new WebSocket(`ws://localhost:3001/proposals/${proposalId}`);

    ws.onopen = () => {
      setIsOnline(true);
      // Join collaboration room
      ws.send(JSON.stringify({
        type: 'join',
        userId,
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setState(data);
    };

    ws.onclose = () => {
      setIsOnline(false);
    };

    return () => {
      ws.close();
    };
  }, [proposalId, userId]);

  const updateUserCursor = (position: number) => {
    if (state) {
      setState({
        ...state,
        activeCursor: {
          userId,
          position,
        },
      });
    }
  };

  return (
    <CollaborationContext.Provider
      value={{
        state,
        users: state?.users || [],
        isOnline,
        updateUserCursor,
      }}
    >
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaboration() {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within CollaborationProvider');
  }
  return context;
}
