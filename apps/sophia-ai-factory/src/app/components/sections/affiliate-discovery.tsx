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
  const tierLevels: Record<Tier, number> = { BASIC: 0, PREMIUM: 1, ENTERPRISE: 2, MASTER: 3 };

  const isLocked = (programTier?: Tier) => {
    if (!programTier) return false;
    return tierLevels[currentTier] < tierLevels[programTier];
  };

  return (
    <section className="py-24 bg-secondary/50" id="affiliate-discovery">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            High-Ticket Affiliate Discovery
          </h2>
          <p className="text-muted-foreground text-lg">
            Access our curated database of high-paying affiliate programs.
            Automate your income streams with proven partners.
          </p>

          {/* Tier Selector for Demo */}
          <div className="mt-8 p-4 bg-card rounded-xl shadow-sm inline-block border border-border">
            <p className="text-sm text-muted-foreground mb-2 font-medium">Preview as Tier:</p>
            <div className="flex gap-2 justify-center">
              {(["BASIC", "PREMIUM", "ENTERPRISE"] as Tier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setCurrentTier(tier)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    currentTier === tier
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
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
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border hover:bg-muted"
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
                className={`relative group bg-card rounded-2xl border ${
                  locked ? "border-border" : "border-border hover:border-blue-500/50 hover:shadow-lg"
                } transition-all overflow-hidden flex flex-col h-full`}
              >
                {/* Header */}
                <div className="p-6 pb-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-xl text-foreground mb-1">
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
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Commission</p>
                      <p className="font-bold text-foreground">{locked ? "???" : program.commission}</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">EPC</p>
                      <p className="font-bold text-foreground">{locked ? "???" : `$${program.epc}`}</p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 pt-0 flex-grow">
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {program.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {program.tags?.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer / Action */}
                <div className="p-6 pt-0 mt-auto">
                  {locked ? (
                    <Button disabled className="w-full flex items-center justify-center gap-2 bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted">
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
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <div className="bg-card p-6 rounded-xl shadow-xl border border-border text-center max-w-[80%]">
                      <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h4 className="font-bold text-foreground mb-2">
                        {program.tier} Only
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
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
