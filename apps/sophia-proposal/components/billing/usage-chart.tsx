'use client';

import { useEffect, useState } from 'react';

interface DailyUsage {
  date: string;
  mcuUsed: number;
}

export function UsageChart() {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<DailyUsage[]>([]);

  useEffect(() => {
    fetch('/api/usage?days=30')
      .then(res => res.json())
      .then(data => {
        setUsage(data.dailyUsage || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading usage data...</div>;
  }

  if (usage.length === 0) {
    return <p className="text-gray-500 text-center py-8">No usage data available</p>;
  }

  const maxUsage = Math.max(...usage.map(d => d.mcuUsed), 1);

  return (
    <div className="h-48 flex items-end gap-1">
      {usage.map(day => (
        <div
          key={day.date}
          className="flex-1 bg-blue-500 hover:bg-blue-600 transition-colors rounded-t"
          style={{ height: `${(day.mcuUsed / maxUsage) * 100}%` }}
          title={`${day.date}: ${day.mcuUsed} MCU`}
        />
      ))}
    </div>
  );
}
