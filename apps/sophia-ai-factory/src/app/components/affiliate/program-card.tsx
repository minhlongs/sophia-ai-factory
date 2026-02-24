"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AffiliateProgram } from "@/types";
import { ExternalLink, TrendingUp, DollarSign } from "lucide-react";
import { FadeInView } from "@/components/ui/fade-in-view";

interface ProgramCardProps {
  program: AffiliateProgram;
  isLocked?: boolean;
}

export function ProgramCard({ program, isLocked = false }: ProgramCardProps) {
  return (
    <FadeInView direction="up" distance={20} duration={400}>
      <Card glass className="h-full hover:shadow-[0_0_30px_rgba(0,240,255,0.15)] transition-all">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-2">{program.name}</h3>
              <Badge variant={program.tier === "ENTERPRISE" ? "enterprise" : "default"}>
                {program.category}
              </Badge>
            </div>
            {program.tier === "ENTERPRISE" && (
              <Badge variant="enterprise" className="ml-2">
                Enterprise
              </Badge>
            )}
          </div>

          {/* Commission */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-5 h-5 text-[var(--neon-cyan)]" />
              <span className="text-2xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent">
                {program.commission}
              </span>
            </div>
            <p className="text-sm text-gray-400">Commission Rate</p>
          </div>

          {/* EPC */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-[var(--neon-purple)]" />
              <span className="text-xl font-bold text-white">
                ${program.epc.toFixed(2)}
              </span>
            </div>
            <p className="text-sm text-gray-400">EPC (Earnings Per Click)</p>
          </div>

          {/* Description */}
          <p className="text-gray-300 text-sm mb-4 line-clamp-2">
            {program.description}
          </p>

          {/* CTA */}
          {isLocked ? (
            <Button variant="secondary" className="w-full" disabled>
              Upgrade to Unlock
            </Button>
          ) : (
            <Button
              variant="primary"
              className="w-full group"
              onClick={() => window.open(program.link, "_blank")}
            >
              <span>View Program</span>
              <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          )}
        </CardContent>
      </Card>
    </FadeInView>
  );
}
