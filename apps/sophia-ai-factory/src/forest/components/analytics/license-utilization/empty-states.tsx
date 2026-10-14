'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';

export function LoadingState({ title }: { title: string }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, emptyText }: { title: string; emptyText: string }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
          <p className="text-sm">{emptyText}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function BasicTierState({ title }: { title: string }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
          <p className="text-sm font-medium">Advanced Analytics</p>
          <p className="text-xs mt-1">Upgrade to Growth or higher to view license utilization</p>
        </div>
      </CardContent>
    </Card>
  );
}
