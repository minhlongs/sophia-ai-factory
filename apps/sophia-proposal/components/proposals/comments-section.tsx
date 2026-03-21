/**
 * Comments Section Component
 */

'use client';

import { useState } from 'react';
import type { ProposalComment } from '@/types/collaboration';

interface CommentsSectionProps {
  proposalId: string;
  initialComments: ProposalComment[];
  userId: string;
}

export function CommentsSection({
  proposalId,
  initialComments,
  userId,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<ProposalComment[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [filter, setFilter] = useState<'all' | 'unresolved'>('all');

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    const comment: ProposalComment = {
      id: `temp-${Date.now()}`,
      proposalId,
      userId,
      userName: 'You',
      content: newComment,
      resolved: false,
      createdAt: new Date().toISOString(),
    };

    setComments([...comments, comment]);
    setNewComment('');

    // Send to API
    try {
      await fetch('/api/proposals/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comment),
      });
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleResolveComment = async (commentId: string) => {
    setComments(
      comments.map((c) =>
        c.id === commentId ? { ...c, resolved: true } : c
      )
    );

    try {
      await fetch(`/api/proposals/comments/${commentId}/resolve`, {
        method: 'PATCH',
      });
    } catch (error) {
      console.error('Failed to resolve comment:', error);
    }
  };

  const filteredComments =
    filter === 'unresolved'
      ? comments.filter((c) => !c.resolved)
      : comments;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Comments</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'unresolved')}
          className="text-sm border-gray-300 rounded-md"
        >
          <option value="all">All ({comments.length})</option>
          <option value="unresolved">
            Unresolved ({comments.filter((c) => !c.resolved).length})
          </option>
        </select>
      </div>

      {/* New Comment */}
      <div className="mb-6">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full border border-gray-300 rounded-md p-2 text-sm"
          rows={3}
        />
        <button
          onClick={handleAddComment}
          disabled={!newComment.trim()}
          className="mt-2 px-4 py-2 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 disabled:opacity-50"
        >
          Add Comment
        </button>
      </div>

      {/* Comments List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredComments.map((comment) => (
          <div
            key={comment.id}
            className={`p-3 rounded-lg ${
              comment.resolved ? 'bg-gray-50' : 'bg-blue-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {comment.userName}
                </p>
                <p className="text-sm text-gray-600 mt-1">{comment.content}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(comment.createdAt).toLocaleString()}
                </p>
              </div>
              {!comment.resolved && (
                <button
                  onClick={() => handleResolveComment(comment.id)}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredComments.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-8">
            No comments yet
          </p>
        )}
      </div>
    </div>
  );
}
