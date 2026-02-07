"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { getAllPrograms } from "@/lib/affiliates";
import { Tier } from "@/types";
import { Lock, ExternalLink, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AffiliateDiscovery() {
  const [currentTier, setCurrentTier] = useState<Tier>("BASIC");
  const [filter, setFilter] = useState("All");

  const allPrograms = getAllPrograms();
  const categories = ["All", ...Array.from(new Set(allPrograms.map(p => p.category)))];

  const filteredPrograms = allPrograms.filter(p => filter === "All" || p.category === filter);

  // Tier logic
  const tierLevels: Record<Tier, number> = { BASIC: 0, PREMIUM: 1, ENTERPRISE: 2 };

  const isLocked = (programTier?: Tier) => {
    if (!programTier) return false;
    return tierLevels[currentTier] < tierLevels[programTier];
  };

  return (
    <section className="py-24 bg-gray-50 dark:bg-gray-900" id="affiliate-discovery">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            High-Ticket Affiliate Discovery
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Access our curated database of high-paying affiliate programs.
            Automate your income streams with proven partners.
          </p>

          {/* Tier Selector for Demo */}
          <div className="mt-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm inline-block border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 mb-2 font-medium">Preview as Tier:</p>
            <div className="flex gap-2 justify-center">
              {(["BASIC", "PREMIUM", "ENTERPRISE"] as Tier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setCurrentTier(tier)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    currentTier === tier
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex overflow-x-auto gap-2 mb-8 pb-2 justify-center flex-wrap">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === category
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrograms.map((program) => {
            const locked = isLocked(program.tier);

            return (
              <motion.div
                key={program.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`relative group bg-white dark:bg-gray-800 rounded-2xl border ${
                  locked ? "border-gray-200 dark:border-gray-700" : "border-gray-200 dark:border-gray-700 hover:border-blue-500/50 hover:shadow-lg"
                } transition-all overflow-hidden flex flex-col h-full`}
              >
                {/* Header */}
                <div className="p-6 pb-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-1">
                        {program.name}
                      </h3>
                      <div className="flex gap-2">
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {program.category}
                        </Badge>
                        {program.tier && program.tier !== "BASIC" && (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" /> {program.tier}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Commission</p>
                      <p className="font-bold text-gray-900 dark:text-white">{locked ? "???" : program.commission}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">EPC</p>
                      <p className="font-bold text-gray-900 dark:text-white">{locked ? "???" : `$${program.epc}`}</p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 pt-0 flex-grow">
                  <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2">
                    {program.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {program.tags?.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer / Action */}
                <div className="p-6 pt-0 mt-auto">
                  {locked ? (
                    <Button disabled className="w-full flex items-center justify-center gap-2 bg-gray-200 text-gray-500 cursor-not-allowed hover:bg-gray-200">
                      <Lock className="w-4 h-4" />
                      Unlock {program.tier}
                    </Button>
                  ) : (
                    <a href={program.link} target="_blank" rel="noopener noreferrer" className="block w-full">
                      <Button className="w-full flex items-center justify-center gap-2">
                        Apply Now
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>

                {/* Lock Overlay */}
                {locked && (
                  <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 text-center max-w-[80%]">
                      <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-white mb-2">
                        {program.tier} Only
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        Upgrade your plan to access premium affiliate partners with higher EPC.
                      </p>
                      <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                        Upgrade Plan
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
