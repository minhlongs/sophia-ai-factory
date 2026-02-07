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

// Colors for charts - using CSS variables if possible, but Recharts needs hex strings
// We can define a palette that looks good in both or adapt based on theme context if we had access to it.
// For now, let's use a standard palette that works reasonably well on both backgrounds.
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
          <Bar dataKey="duration" name="Duration (min)" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CampaignsByTypeChart({ data }: ChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                No data available
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
