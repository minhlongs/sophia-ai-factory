export const CONTENT_TYPES = [
  { type: 'Tutorial', suitableFor: ['how to', 'guide', 'learn'] },
  { type: 'List', suitableFor: ['best', 'top', 'worst'] },
  { type: 'Review', suitableFor: ['review', 'vs', 'comparison'] },
  { type: 'Explainer', suitableFor: ['what is', 'why', 'explained'] },
  { type: 'Story', suitableFor: ['story', 'journey', 'experience'] },
] as const;

export const ALLOWED_CONTENT_TYPES = new Set(['Tutorial', 'Explainer', 'List', 'Review', 'Story', 'News']);

export const EVERGREEN_FALLBACK_TOPICS = [
  'Time Management Strategies That Actually Work',
  'Beginner Mistakes to Avoid When Learning a New Skill',
  'How to Start a Side Project With Zero Budget',
  'Simple Habits That Improve Focus and Productivity',
  'How to Learn Anything Faster Using Proven Study Techniques',
] as const;

export const BEST_TIMES = [
  { day: 'Tuesday', hour: 14 },
  { day: 'Wednesday', hour: 14 },
  { day: 'Thursday', hour: 14 },
  { day: 'Friday', hour: 15 },
  { day: 'Saturday', hour: 10 },
  { day: 'Sunday', hour: 10 },
] as const;
