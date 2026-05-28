"use client";

import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { 
  Activity, 
  Brain, 
  CheckCircle2, 
  Zap, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Columns,
  ListFilter
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
interface OptimizationRow {
  id: string;
  sopId: string;
  stepIndex: number;
  originalPrompt: string;
  suggestedPrompt: string;
  improvementScore: number;
  createdAt: number;
}

interface AutonomousFeedbackLoopWidgetProps {
  pendingCount: number;
  completedCount: number;
  recentOptimizations: OptimizationRow[];
  isVi: boolean;
}

interface FeedbackLoopContextValue {
  isVi: boolean;
  activeTab: "overview" | "logs" | "explorer";
  setActiveTab: (tab: "overview" | "logs" | "explorer") => void;
  expandedLogId: string | null;
  toggleExpandLog: (id: string) => void;
  selectedLogId: string | null;
  setSelectedLogId: (id: string | null) => void;
  copiedId: string | null;
  handleCopy: (text: string, id: string) => void;
}

// --- Context & Provider ---
const FeedbackLoopContext = createContext<FeedbackLoopContextValue | undefined>(undefined);

function useFeedbackLoop() {
  const context = useContext(FeedbackLoopContext);
  if (!context) {
    throw new Error("useFeedbackLoop must be used within FeedbackLoopProvider");
  }
  return context;
}

// --- Helper for simple diff highlighting ---
function renderSimpleDiff(original: string, suggested: string) {
  const origWords = original.split(/\s+/);
  const suggWords = suggested.split(/\s+/);
  
  // A simple word-level highlight helper (not full Myers diff but great for visual wow)
  return suggWords.map((word, idx) => {
    const isNew = !origWords.includes(word);
    if (isNew) {
      return (
        <span key={idx} className="bg-emerald-950/40 text-emerald-300 font-bold px-1 rounded mx-0.5 border border-emerald-500/20">
          {word}
        </span>
      );
    }
    return <span key={idx} className="mx-0.5">{word}</span>;
  });
}

// --- Compound Components ---

// 1. Root Container
export function AutonomousFeedbackLoopWidget({
  pendingCount,
  completedCount,
  recentOptimizations,
  isVi,
}: AutonomousFeedbackLoopWidgetProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "explorer">("overview");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(
    recentOptimizations.length > 0 ? recentOptimizations[0].id : null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(isVi ? "Đã sao chép vào bộ nhớ tạm!" : "Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  }, [isVi]);

  const toggleExpandLog = useCallback((id: string) => {
    setExpandedLogId(prev => (prev === id ? null : id));
  }, []);

  const value = useMemo(() => ({
    isVi,
    activeTab,
    setActiveTab,
    expandedLogId,
    toggleExpandLog,
    selectedLogId,
    setSelectedLogId,
    copiedId,
    handleCopy
  }), [isVi, activeTab, expandedLogId, toggleExpandLog, selectedLogId, copiedId, handleCopy]);

  const sortedOptimizations = useMemo(() => {
    return [...recentOptimizations].sort((a, b) => b.createdAt - a.createdAt);
  }, [recentOptimizations]);

  return (
    <FeedbackLoopContext.Provider value={value}>
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 p-6 backdrop-blur-xl transition-all duration-300 hover:border-cyan-500/30">
        {/* Decorative background glow mesh */}
        <div className="absolute -right-20 -top-20 -z-10 h-60 w-60 rounded-full bg-cyan-500/5 blur-[80px]" />
        <div className="absolute -bottom-20 -left-20 -z-10 h-60 w-60 rounded-full bg-purple-500/5 blur-[80px]" />

        <FeedbackLoopHeader />
        <FeedbackLoopStats pendingCount={pendingCount} completedCount={completedCount} totalOptimizations={recentOptimizations.length} />
        
        {recentOptimizations.length > 0 && <FeedbackLoopTabs />}
        
        <FeedbackLoopContent optimizations={sortedOptimizations} />
      </div>
    </FeedbackLoopContext.Provider>
  );
}

// 2. Header Component
function FeedbackLoopHeader() {
  const { isVi } = useFeedbackLoop();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950/30 border border-cyan-800/30 transition-transform duration-500 hover:rotate-12">
          <Brain className="h-5 w-5 text-cyan-400 animate-pulse" />
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
            {isVi ? "Vòng Lặp Phản Hồi Tự Trị" : "Autonomous Feedback Loop"}
          </h2>
          <p className="text-xs text-slate-500">
            {isVi 
              ? "Hệ thống tự động đánh giá và tối ưu hóa prompt qua LLM" 
              : "Continuous performance evaluation & prompt optimization"}
          </p>
        </div>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-1 text-xs font-semibold text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </span>
        {isVi ? "ĐANG HOẠT ĐỘNG" : "ACTIVE"}
      </div>
    </div>
  );
}

// 3. Stats Grid Component
interface StatsProps {
  pendingCount: number;
  completedCount: number;
  totalOptimizations: number;
}
function FeedbackLoopStats({ pendingCount, completedCount, totalOptimizations }: StatsProps) {
  const { isVi } = useFeedbackLoop();
  return (
    <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
      <div className="group rounded-xl border border-slate-900 bg-slate-900/10 p-4 transition-all duration-300 hover:bg-slate-900/30 hover:border-cyan-500/10">
        <div className="flex items-center gap-2 text-slate-400">
          <Activity className="h-4 w-4 text-cyan-400 transition-transform duration-300 group-hover:scale-110" />
          <span className="text-xs font-medium">{isVi ? "Chu Kỳ Đợi Đánh Giá" : "Pending Cycles"}</span>
        </div>
        <p className="mt-2 text-2xl font-bold font-mono text-cyan-400">{pendingCount}</p>
      </div>

      <div className="group rounded-xl border border-slate-900 bg-slate-900/10 p-4 transition-all duration-300 hover:bg-slate-900/30 hover:border-purple-500/10">
        <div className="flex items-center gap-2 text-slate-400">
          <CheckCircle2 className="h-4 w-4 text-purple-400 transition-transform duration-300 group-hover:scale-110" />
          <span className="text-xs font-medium">{isVi ? "Chu Kỳ Hoàn Thành" : "Completed Cycles"}</span>
        </div>
        <p className="mt-2 text-2xl font-bold font-mono text-purple-400">{completedCount}</p>
      </div>

      <div className="group col-span-2 md:col-span-1 rounded-xl border border-slate-900 bg-slate-900/10 p-4 transition-all duration-300 hover:bg-slate-900/30 hover:border-amber-500/10">
        <div className="flex items-center gap-2 text-slate-400">
          <Zap className="h-4 w-4 text-amber-400 transition-transform duration-300 group-hover:scale-110" />
          <span className="text-xs font-medium">{isVi ? "Đã Tối Ưu Hóa" : "Optimizations Applied"}</span>
        </div>
        <p className="mt-2 text-2xl font-bold font-mono text-amber-400">{totalOptimizations}</p>
      </div>
    </div>
  );
}

// 4. Tabs navigation
function FeedbackLoopTabs() {
  const { activeTab, setActiveTab, isVi } = useFeedbackLoop();
  
  return (
    <div className="mt-6 flex border-b border-slate-900/60 pb-px">
      <div className="flex space-x-1 rounded-lg bg-slate-950/60 p-1 border border-slate-900">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
            activeTab === "overview"
              ? "bg-slate-900 text-cyan-400 border border-slate-800 shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          {isVi ? "Tổng Quan" : "Overview"}
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
            activeTab === "logs"
              ? "bg-slate-900 text-cyan-400 border border-slate-800 shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ListFilter className="h-3.5 w-3.5" />
          {isVi ? "Nhật Ký Tối Ưu" : "Optimization Log"}
        </button>
        <button
          onClick={() => setActiveTab("explorer")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
            activeTab === "explorer"
              ? "bg-slate-900 text-cyan-400 border border-slate-800 shadow"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Columns className="h-3.5 w-3.5" />
          {isVi ? "So Sánh Trực Quan" : "Diff Explorer"}
        </button>
      </div>
    </div>
  );
}

// 5. Content Selector based on active tab
interface ContentProps {
  optimizations: OptimizationRow[];
}
function FeedbackLoopContent({ optimizations }: ContentProps) {
  const { activeTab, isVi } = useFeedbackLoop();

  if (optimizations.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-slate-900 py-8 text-center bg-slate-950/20">
        <p className="text-xs text-slate-500 max-w-md mx-auto px-4">
          {isVi
            ? "Chưa có đề xuất tối ưu. Chu kỳ phản hồi tự trị sẽ tự động bắt đầu sau khi video đầu tiên được xuất bản và đồng bộ analytics."
            : "No optimizations logged yet. The autonomous feedback loop triggers after a video is published and analytics sync."}
        </p>
      </div>
    );
  }

  switch (activeTab) {
    case "logs":
      return <FeedbackLoopList optimizations={optimizations} />;
    case "explorer":
      return <FeedbackLoopExplorer optimizations={optimizations} />;
    case "overview":
    default:
      return <FeedbackLoopOverview optimizations={optimizations} />;
  }
}

// Tab 1: Overview (Mini summary & single latest log)
function FeedbackLoopOverview({ optimizations }: ContentProps) {
  const { isVi } = useFeedbackLoop();
  const latestOpt = optimizations[0];

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-slate-900 bg-slate-900/5 p-4 flex items-start gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-950/40 border border-cyan-500/10">
          <Zap className="h-4 w-4 text-cyan-400" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
            {isVi ? "Trạng Thái Gần Nhất" : "Latest Status"}
          </h4>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            {isVi 
              ? `Vòng lặp đã tối ưu hóa thành công cấu hình prompt cho SOP. Đề xuất mới nhất giúp cải thiện ${Math.round(latestOpt.improvementScore * 100)}% hiệu quả.`
              : `Successfully optimized prompt configuration. The latest suggestion yields a ${Math.round(latestOpt.improvementScore * 100)}% estimated performance gain.`}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {isVi ? "Đề Xuất Mới Nhất" : "Latest Optimization"}
        </h3>
        <OptimizationCard opt={latestOpt} />
      </div>
    </div>
  );
}

// Tab 2: Full Logs List
function FeedbackLoopList({ optimizations }: ContentProps) {
  const { isVi } = useFeedbackLoop();
  return (
    <div className="mt-6 space-y-4 max-h-[500px] overflow-y-auto pr-1">
      {optimizations.map((opt) => (
        <OptimizationCard key={opt.id} opt={opt} />
      ))}
    </div>
  );
}

// Tab 3: Interactive Diff Explorer
function FeedbackLoopExplorer({ optimizations }: ContentProps) {
  const { isVi, selectedLogId, setSelectedLogId } = useFeedbackLoop();
  
  const selectedOpt = useMemo(() => {
    return optimizations.find(o => o.id === selectedLogId) || optimizations[0];
  }, [optimizations, selectedLogId]);

  if (!selectedOpt) return null;

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar: Log Selector */}
      <div className="lg:col-span-1 space-y-2 max-h-[400px] overflow-y-auto pr-1 border-r border-slate-900 lg:pr-4">
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-2">
          {isVi ? "Chọn Phiên Bản" : "Select Version"}
        </span>
        {optimizations.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelectedLogId(opt.id)}
            className={`w-full text-left p-3 rounded-lg border text-xs font-mono transition-all duration-200 ${
              selectedLogId === opt.id
                ? "bg-cyan-950/20 border-cyan-500/30 text-cyan-400"
                : "bg-slate-950/20 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200"
            }`}
          >
            <div className="font-semibold mb-1">Step {opt.stepIndex}</div>
            <div className="text-[10px] text-slate-500">
              {new Date(opt.createdAt * 1000).toLocaleDateString()}
            </div>
            <div className="mt-1 text-[10px] text-emerald-400">
              +{Math.round(opt.improvementScore * 100)}% Gain
            </div>
          </button>
        ))}
      </div>

      {/* Main Panel: Interactive Side-by-Side Comparison */}
      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
          <div>
            <span className="text-xs font-bold text-cyan-400 font-mono">
              Step {selectedOpt.stepIndex} Prompt Comparison
            </span>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Optimized on {new Date(selectedOpt.createdAt * 1000).toLocaleString()}
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-500/20 shadow-sm">
            +{Math.round(selectedOpt.improvementScore * 100)}% Improvement
          </span>
        </div>

        {/* Diff view */}
        <div className="space-y-4">
          {/* Side-by-Side cards */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-red-950/20 bg-red-950/5 p-4 space-y-2">
              <span className="text-[10px] uppercase font-bold text-red-400/80 tracking-wider">
                {isVi ? "Prompt Gốc" : "Original Prompt"}
              </span>
              <div className="text-xs font-mono text-slate-300 leading-relaxed max-h-[220px] overflow-y-auto bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                {selectedOpt.originalPrompt}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-950/20 bg-emerald-950/5 p-4 space-y-2">
              <span className="text-[10px] uppercase font-bold text-emerald-400/80 tracking-wider">
                {isVi ? "Prompt Đã Tối Ưu" : "Optimized Prompt"}
              </span>
              <div className="text-xs font-mono text-slate-300 leading-relaxed max-h-[220px] overflow-y-auto bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                {selectedOpt.suggestedPrompt}
              </div>
            </div>
          </div>

          {/* Visual diff section */}
          <div className="rounded-xl border border-slate-900 bg-slate-950/40 p-4 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              {isVi ? "Phân Tích Thay Đổi (Word Diff Highlight)" : "Word Highlight Analysis"}
            </span>
            <div className="text-xs font-mono text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-lg border border-slate-900 max-h-[160px] overflow-y-auto">
              {renderSimpleDiff(selectedOpt.originalPrompt, selectedOpt.suggestedPrompt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Card Component for List & Overview
interface OptimizationCardProps {
  opt: OptimizationRow;
}
function OptimizationCard({ opt }: OptimizationCardProps) {
  const { isVi, expandedLogId, toggleExpandLog, copiedId, handleCopy } = useFeedbackLoop();
  const isExpanded = expandedLogId === opt.id;

  return (
    <div className="group rounded-xl border border-slate-900 bg-slate-900/10 p-4 transition-all duration-200 hover:border-slate-800 hover:bg-slate-900/20">
      {/* Row Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-950 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 font-mono">
            Step {opt.stepIndex} Optimization
          </span>
          <span className="text-[10px] text-slate-500">
            • {new Date(opt.createdAt * 1000).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/10 font-mono">
            +{Math.round(opt.improvementScore * 100)}% Gain
          </span>
          <button 
            onClick={() => toggleExpandLog(opt.id)}
            className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded hover:bg-slate-950/50"
            aria-label="Expand prompt details"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Prompts Layout */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Original prompt */}
        <div className="space-y-1 relative group/card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              {isVi ? "Prompt Gốc" : "Original Prompt"}
            </span>
            <button
              onClick={() => handleCopy(opt.originalPrompt, `${opt.id}-orig`)}
              className="opacity-0 group-hover/card:opacity-100 text-slate-500 hover:text-slate-300 transition-all duration-200 p-0.5 rounded"
              title={isVi ? "Sao chép Prompt Gốc" : "Copy Original Prompt"}
            >
              {copiedId === `${opt.id}-orig` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className={`rounded bg-red-950/5 border border-red-950/10 p-2.5 text-[11px] font-mono text-red-400/90 leading-relaxed transition-all duration-300 ${
            isExpanded ? "max-h-[300px] overflow-y-auto" : "line-clamp-3"
          }`}>
            {opt.originalPrompt}
          </div>
        </div>

        {/* Optimized prompt */}
        <div className="space-y-1 relative group/card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              {isVi ? "Prompt Đã Tối Ưu" : "Optimized Prompt"}
            </span>
            <button
              onClick={() => handleCopy(opt.suggestedPrompt, `${opt.id}-sugg`)}
              className="opacity-0 group-hover/card:opacity-100 text-slate-500 hover:text-slate-300 transition-all duration-200 p-0.5 rounded"
              title={isVi ? "Sao chép Prompt Tối Ưu" : "Copy Optimized Prompt"}
            >
              {copiedId === `${opt.id}-sugg` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className={`rounded bg-emerald-950/5 border border-emerald-950/10 p-2.5 text-[11px] font-mono text-emerald-400/90 leading-relaxed transition-all duration-300 ${
            isExpanded ? "max-h-[300px] overflow-y-auto" : "line-clamp-3"
          }`}>
            {opt.suggestedPrompt}
          </div>
        </div>
      </div>
    </div>
  );
}
