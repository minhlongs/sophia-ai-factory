"use client";

import { useState, useMemo } from "react";
import { AffiliateProgram } from "@/types";
import { ProgramCard } from "./program-card";
import { Button } from "@/app/components/ui/button";
import { Search, SlidersHorizontal } from "lucide-react";

interface ProgramGridProps {
  programs: AffiliateProgram[];
  showAll?: boolean;
}

type SortOption = "epc-high" | "epc-low" | "commission-high" | "commission-low";

export function ProgramGrid({ programs, showAll = true }: ProgramGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("epc-high");

  // Filter and sort programs
  const filteredPrograms = useMemo(() => {
    let result = programs;

    // Search filter
    if (searchQuery) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "epc-high":
          return b.epc - a.epc;
        case "epc-low":
          return a.epc - b.epc;
        case "commission-high":
          return parseFloat(b.commission) - parseFloat(a.commission);
        case "commission-low":
          return parseFloat(a.commission) - parseFloat(b.commission);
        default:
          return 0;
      }
    });

    return result;
  }, [programs, searchQuery, sortBy]);

  return (
    <div>
      {/* Search and Sort */}
      <div className="mb-8 flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search programs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-[var(--neon-cyan)] transition-colors"
          />
        </div>

        {/* Sort */}
        <div className="relative">
          <SlidersHorizontal className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="pl-12 pr-8 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[var(--neon-cyan)] transition-colors appearance-none cursor-pointer min-w-[200px]"
          >
            <option value="epc-high">EPC: High to Low</option>
            <option value="epc-low">EPC: Low to High</option>
            <option value="commission-high">Commission: High to Low</option>
            <option value="commission-low">Commission: Low to High</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-6">
        <p className="text-gray-400">
          Showing <span className="text-white font-semibold">{filteredPrograms.length}</span> programs
        </p>
      </div>

      {/* Grid */}
      {filteredPrograms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              isLocked={!showAll}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No programs found matching your criteria</p>
          <Button
            variant="secondary"
            onClick={() => {
              setSearchQuery("");
              setSortBy("epc-high");
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
