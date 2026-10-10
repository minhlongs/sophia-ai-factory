export function fromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatTimestampFull(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getNextPayoutDate(): string {
  const now = new Date();
  const currentDay = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
  const nextSunday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilSunday,
    12, 0, 0, 0,
  ));
  return nextSunday.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}
