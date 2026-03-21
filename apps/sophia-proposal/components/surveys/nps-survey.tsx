'use client';

import { useState } from 'react';

interface NpsSurveyProps {
  orgId: string;
  onSubmit: (score: number, feedback?: string) => Promise<void>;
}

export function NpsSurvey({ orgId, onSubmit }: NpsSurveyProps) {
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (score === null) return;

    setLoading(true);
    setError(null);
    try {
      await onSubmit(score, feedback || undefined);
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit NPS:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (n: number) => {
    if (n <= 6) return 'border-red-400 hover:border-red-600';
    if (n <= 8) return 'border-yellow-400 hover:border-yellow-600';
    return 'border-green-400 hover:border-green-600';
  };

  if (submitted) {
    return (
      <div className="border rounded-lg p-6 bg-green-50">
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-green-500 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <p className="text-green-700 font-semibold text-lg">
            Thank you for your feedback!
          </p>
          <p className="text-green-600 text-sm mt-2">
            Your input helps us improve Sophia AI Factory.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6 bg-white">
      <h3 className="text-lg font-semibold mb-2 text-gray-900">
        How likely are you to recommend Sophia AI Factory?
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        On a scale of 0-10, where 0 is "Not likely at all" and 10 is "Extremely likely"
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => setScore(n)}
            className={`w-10 h-10 rounded-full border-2 font-medium transition-all ${
              score === n
                ? 'bg-blue-600 border-blue-600 text-white scale-110'
                : `bg-white text-gray-700 ${getScoreColor(n)}`
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="flex justify-between text-xs text-gray-500 mb-6">
        <div className="text-center">
          <div className="flex items-center gap-1 justify-center mb-1">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span>0-6</span>
          </div>
          <span>Detractors</span>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1 justify-center mb-1">
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <span>7-8</span>
          </div>
          <span>Passives</span>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1 justify-center mb-1">
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span>9-10</span>
          </div>
          <span>Promoters</span>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
          Any additional feedback? (optional)
        </label>
        <textarea
          id="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What do you like most? What could we improve?"
          className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={4}
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={score === null || loading}
        className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </div>
  );
}
