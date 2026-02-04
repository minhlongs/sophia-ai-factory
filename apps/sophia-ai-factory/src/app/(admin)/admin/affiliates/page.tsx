"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { getAllPrograms } from "@/lib/affiliates";
import { ExternalLink, Search } from "lucide-react";

export default function AffiliatesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const programs = getAllPrograms();

  const filteredPrograms = programs.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Affiliate Programs</h1>
        <p className="text-gray-400">
          Manage and view all affiliate program partnerships
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search programs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-[var(--neon-cyan)] transition-colors"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card glass>
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Total Programs</p>
            <p className="text-3xl font-bold text-white">{programs.length}</p>
          </CardContent>
        </Card>
        <Card glass>
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Average EPC</p>
            <p className="text-3xl font-bold text-white">
              ${(programs.reduce((sum, p) => sum + p.epc, 0) / programs.length).toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card glass>
          <CardContent className="p-6">
            <p className="text-sm text-gray-400 mb-1">Enterprise Programs</p>
            <p className="text-3xl font-bold text-white">
              {programs.filter(p => p.tier === "ENTERPRISE").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card glass>
        <CardHeader>
          <CardTitle>All Programs ({filteredPrograms.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">
                    Program
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">
                    Category
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">
                    Commission
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">
                    EPC
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">
                    Tier
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPrograms.map((program) => (
                  <tr
                    key={program.id}
                    className="border-b border-white/10 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <span className="text-white font-medium">{program.name}</span>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant="default">{program.category}</Badge>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-[var(--neon-cyan)] font-semibold">
                        {program.commission}%
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-white">${program.epc.toFixed(2)}</span>
                    </td>
                    <td className="py-4 px-4">
                      {program.tier ? (
                        <Badge
                          variant={
                            program.tier === "ENTERPRISE"
                              ? "enterprise"
                              : program.tier === "PREMIUM"
                              ? "premium"
                              : "basic"
                          }
                        >
                          {program.tier}
                        </Badge>
                      ) : (
                        <span className="text-gray-500 text-sm">All</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => window.open(program.link, "_blank")}
                        className="text-gray-400 hover:text-[var(--neon-cyan)] transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPrograms.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No programs found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
