'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getInteractions,
  addReaction,
  addComment,
  addLike,
  type PosterInteractions,
  type Comment,
} from '@/utils/interactionStore';

export interface InteractionPanelProps {
  abstractId: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '👏', '🎯'] as const;

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function InteractionPanel({ abstractId }: InteractionPanelProps) {
  const [interactions, setInteractions] = useState<PosterInteractions | null>(null);
  const [commentText, setCommentText] = useState('');

  const refresh = useCallback(() => {
    setInteractions(getInteractions(abstractId));
  }, [abstractId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleReaction = (emoji: string) => {
    addReaction(abstractId, emoji);
    refresh();
  };

  const handleLike = () => {
    addLike(abstractId);
    refresh();
  };

  const handleSubmitComment = () => {
    const success = addComment(abstractId, commentText);
    if (success) {
      setCommentText('');
    }
    refresh();
  };

  if (!interactions) return null;

  return (
    <div className="flex flex-col gap-5 p-5 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 w-full">
      {/* Like button — prominent */}
      <section aria-label="Likes">
        <button
          onClick={handleLike}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 transition-all text-blue-700 dark:text-blue-400 font-semibold text-sm border border-blue-100 dark:border-blue-800/50"
          aria-label={`Like this poster, current count: ${interactions.likes}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          Like
          <span className="bg-blue-100 dark:bg-blue-800 px-2.5 py-0.5 rounded-full text-xs font-bold">
            {interactions.likes}
          </span>
        </button>
      </section>

      {/* Reactions */}
      <section aria-label="Reactions">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Reactions</h3>
        <div className="flex gap-1.5 flex-wrap">
          {REACTION_EMOJIS.map((emoji) => {
            const count = interactions.reactions[emoji] || 0;
            return (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  count > 0
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                aria-label={`React with ${emoji}`}
              >
                <span className="text-base">{emoji}</span>
                <span className="text-gray-600 dark:text-gray-300 text-xs font-medium min-w-[1ch]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Comments */}
      <section aria-label="Comments" className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Comments {interactions.comments.length > 0 && `(${interactions.comments.length})`}
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitComment();
            }}
            placeholder="Add a comment..."
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
            aria-label="Comment input"
          />
          <button
            onClick={handleSubmitComment}
            disabled={!commentText.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed"
          >
            Post
          </button>
        </div>

        {interactions.comments.length > 0 && (
          <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto" aria-label="Comment list">
            {interactions.comments.map((comment: Comment, idx: number) => (
              <li
                key={`${comment.timestamp}-${idx}`}
                className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 text-sm border border-gray-100 dark:border-gray-700"
              >
                <p className="text-gray-900 dark:text-gray-100">{comment.text}</p>
                <time
                  className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5 block"
                  dateTime={new Date(comment.timestamp).toISOString()}
                >
                  {formatTimestamp(comment.timestamp)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
