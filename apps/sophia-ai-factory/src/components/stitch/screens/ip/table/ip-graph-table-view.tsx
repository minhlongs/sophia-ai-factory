'use client';

import React from 'react';
import { TypeStatCards } from './type-stat-cards';
import { TableFilters } from './table-filters';
import { IpEntityTable } from './ip-entity-table';
import type { IpGraphTableProps } from './types';

export function IpGraphTableView({
  entities,
  query,
  onQueryChange,
  onTypeFilterChange,
  typeFilter,
  onStatusChange,
  loading,
  t,
}: IpGraphTableProps) {
  const filtered = entities.filter(
    (e) =>
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.description.toLowerCase().includes(query.toLowerCase()),
  );

  const counts = entities.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <TypeStatCards counts={counts} t={t} />

      <TableFilters
        query={query}
        onQueryChange={onQueryChange}
        typeFilter={typeFilter}
        onTypeFilterChange={onTypeFilterChange}
        t={t}
      />

      <IpEntityTable
        filtered={filtered}
        loading={loading}
        onStatusChange={onStatusChange}
        t={t}
      />
    </div>
  );
}
