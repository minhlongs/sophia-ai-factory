"use client";

import { useState, useMemo } from "react";
import { DocumentSection } from "./document-section";

type DocumentCategory = "corporate" | "financial" | "legal" | "team" | "product" | "market";

const DOCUMENT_GROUPS: Record<DocumentCategory, { label: string; icon: string; docs: { name: string; description: string; path: string; access: "restricted" | "nda" | "public" }[] }> = {
  corporate: {
    label: "Corporate",
    icon: "🏢",
    docs: [
      { name: "Business Plan", description: "Full strategic plan and milestones", path: "/docs/investors/business-plan.pdf", access: "restricted" },
      { name: "Cap Table", description: "Current cap table with shareholder breakdown", path: "/docs/investors/cap-table.pdf", access: "restricted" },
      { name: "Shareholder Agreements", description: "Agreements and voting rights", path: "/docs/investors/shareholder-agreements.pdf", access: "restricted" },
      { name: "Investor Deck (12 slides)", description: "Pitch deck for fundraising", path: "/docs/investors/investor-deck.pdf", access: "nda" },
    ],
  },
  financial: {
    label: "Financial",
    icon: "📊",
    docs: [
      { name: "P&L Statement (last 12 mo)", description: "Income statement summary", path: "/docs/investors/pnl.pdf", access: "restricted" },
      { name: "Balance Sheet", description: "Assets, liabilities, equity", path: "/docs/investors/balance-sheet.pdf", access: "restricted" },
      { name: "Unit Economics", description: "CAC, LTV, churn analysis", path: "/docs/investors/unit-economics.pdf", access: "nda" },
      { name: "Audit Trail (SOX-compliant)", description: "Transaction logs with hash chain", path: "/docs/investors/audit-trail.pdf", access: "restricted" },
    ],
  },
  legal: {
    label: "Legal",
    icon: "⚖️",
    docs: [
      { name: "Certificate of Incorporation", description: "Entity registration", path: "/docs/investors/certificate-of-incorporation.pdf", access: "restricted" },
      { name: "IP Assignment Agreements", description: "Founder and employee IP assignments", path: "/docs/investors/ip-assignments.pdf", access: "restricted" },
      { name: "SOC 2 Readiness Report", description: "Current compliance posture", path: "/docs/investors/soc2-readiness.pdf", access: "nda" },
      { name: "Term Sheet Template", description: "Series A term sheet (draft)", path: "/docs/investors/term-sheet-template.pdf", access: "restricted" },
    ],
  },
  team: {
    label: "Team",
    icon: "👥",
    docs: [
      { name: "Org Chart", description: "Current organizational structure", path: "/docs/investors/org-chart.pdf", access: "public" },
      { name: "Founder Bios", description: "Background of founding team", path: "/docs/investors/founder-bios.pdf", access: "nda" },
      { name: "Board Advisors (track)", description: "Track of industry veterans", path: "/docs/investors/board-advisors.pdf", access: "nda" },
    ],
  },
  product: {
    label: "Product",
    icon: "📦",
    docs: [
      { name: "Product Roadmap", description: "Next 12-month roadmap", path: "/docs/investors/product-roadmap.pdf", access: "nda" },
      { name: "Technical Architecture", description: "System overview and tech stack", path: "/docs/investors/tech-architecture.pdf", access: "restricted" },
      { name: "MASTER Enterprise Features", description: "Enterprise tier feature spec", path: "/docs/investors/master-enterprise.pdf", access: "restricted" },
      { name: "SOP Marketplace Demo", description: "Public-facing marketplace walkthrough", path: "/docs/investors/sop-marketplace-demo.pdf", access: "public" },
    ],
  },
  market: {
    label: "Market",
    icon: "🌏",
    docs: [
      { name: "TAM/SAM/SOM Analysis", description: "Total addressable market sizing", path: "/docs/investors/tam-sam-som.pdf", access: "nda" },
      { name: "Multi-language Expansion Plan", description: "ES/TH market entry strategy", path: "/docs/investors/multi-lang-expansion.pdf", access: "nda" },
      { name: "Channel Testing Results", description: "YouTube/TikTok performance data", path: "/docs/investors/channel-testing.pdf", access: "restricted" },
    ],
  },
};

type TabKey = DocumentCategory;

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "corporate", label: "Corporate", icon: "🏢" },
  { key: "financial", label: "Financial", icon: "📊" },
  { key: "legal", label: "Legal", icon: "⚖️" },
  { key: "team", label: "Team", icon: "👥" },
  { key: "product", label: "Product", icon: "📦" },
  { key: "market", label: "Market", icon: "🌏" },
];

export default function DataRoom() {
  const [activeTab, setActiveTab] = useState<TabKey>("corporate");
  const [searchQuery, setSearchQuery] = useState("");

  const visibleTabs = useMemo(() => {
    if (!searchQuery.trim()) return TABS;
    const q = searchQuery.toLowerCase();
    return TABS.filter((t) => {
      const group = DOCUMENT_GROUPS[t.key];
      return (
        t.label.toLowerCase().includes(q) ||
        group.docs.some((d) => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q))
      );
    });
  }, [searchQuery]);

  const activeGroup = DOCUMENT_GROUPS[activeTab];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold tracking-tight">Investor Data Room</h1>
        <p className="mt-2 text-slate-300">
          Restricted access — all documents are confidential and intended for qualified investors only.
          Downloading implies acceptance of our NDA terms.
        </p>
      </div>
      <div className="mb-6">
        <input
          type="search"
          placeholder="Search documents…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      <DocumentSection group={activeGroup} />
    </div>
  );
}
