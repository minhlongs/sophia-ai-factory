"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTranslations } from 'next-intl';

// Chart color palette (works on both light and dark backgrounds)
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

interface ChartData {
  name: string;
  value?: number;
  duration?: number;
}

interface ChartProps {
  data: ChartData[];
}

export function StatusDistributionChart({ data }: ChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent ? percent * 100 : 0).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            itemStyle={{ color: 'var(--foreground)' }}
          />
          <Legend wrapperStyle={{ color: 'var(--foreground)' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompletionTimeChart({ data }: ChartProps) {
  const t = useTranslations('dashboard.analytics');

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" unit="m" stroke="var(--muted-foreground)" />
          <YAxis dataKey="name" type="category" width={100} stroke="var(--muted-foreground)" />
          <Tooltip
            cursor={{ fill: 'var(--muted)' }}
            contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            itemStyle={{ color: 'var(--foreground)' }}
          />
          <Legend wrapperStyle={{ color: 'var(--foreground)' }} />
          <Bar dataKey="duration" name={t('duration_min')} fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CampaignsByTypeChart({ data }: ChartProps) {
    const t = useTranslations('dashboard.analytics');

    if (!data || data.length === 0) {
        return (
            <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                {t('no_data')}
            </div>
        )
    }
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            fill="#82ca9d"
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            itemStyle={{ color: 'var(--foreground)' }}
          />
          <Legend wrapperStyle={{ color: 'var(--foreground)' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
