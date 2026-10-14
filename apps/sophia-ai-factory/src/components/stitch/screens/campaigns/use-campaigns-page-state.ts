'use client';

import { useState, useMemo } from 'react';
import { DEFAULT_CAMPAIGNS } from './campaigns-page-types';
import type { CampaignsPageProps } from './campaigns-page-types';

type StateProps = Pick<
  CampaignsPageProps,
  'initialCampaigns' | 'totalCampaigns' | 'initialSearchQuery' | 'onSearch' | 'onPageChange'
> & { itemsPerPage: number };

export function useCampaignsPageState({
  initialCampaigns,
  totalCampaigns: totalProp,
  itemsPerPage,
  initialSearchQuery = '',
  onSearch,
  onPageChange,
}: StateProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const campaigns = initialCampaigns ?? DEFAULT_CAMPAIGNS;
  const totalCampaigns = totalProp ?? campaigns.length;

  const filtered = useMemo(() => {
    let result = campaigns;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q));
    }

    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (channelFilter !== 'all') {
      result = result.filter((c) => c.channel.toLowerCase().includes(channelFilter));
    }

    return result;
  }, [campaigns, searchQuery, statusFilter, channelFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCampaigns / itemsPerPage));
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalCampaigns);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    onSearch?.(value);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    onPageChange?.(page);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleChannelChange = (value: string) => {
    setChannelFilter(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setChannelFilter('all');
    setCurrentPage(1);
  };

  const paginationButtons = useMemo(() => {
    const buttons: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) buttons.push(i);
    } else {
      buttons.push(1);
      if (currentPage > 3) buttons.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        buttons.push(i);
      }
      if (currentPage < totalPages - 2) buttons.push('ellipsis');
      buttons.push(totalPages);
    }
    return buttons;
  }, [totalPages, currentPage]);

  return {
    searchQuery,
    statusFilter,
    channelFilter,
    currentPage,
    totalCampaigns,
    filtered,
    totalPages,
    startItem,
    endItem,
    paginationButtons,
    handleSearch,
    handlePageChange,
    handleStatusChange,
    handleChannelChange,
    clearFilters,
  };
}
