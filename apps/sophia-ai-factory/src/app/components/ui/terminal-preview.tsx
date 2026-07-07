"use client";

/** Animated terminal window showing API usage example */
const lines = [
  { type: "comment", text: "# Tạo video AI với Sophia Factory" },
  { type: "command", text: "curl -X POST https://sophia.agencyos.network/api/v1/missions \\" },
  { type: "flag", text: '  -H "Authorization: Bearer sk_live_..." \\' },
  { type: "flag", text: '  -H "Content-Type: application/json" \\' },
  { type: "flag", text: "  -d '{\"command\": \"video:create\"," },
  { type: "flag", text: '       "params": {"topic": "AI Marketing 2026"}}\''},
  { type: "empty", text: "" },
  { type: "response", text: '{"id": "msn_7f3k9x", "status": "running",' },
  { type: "response", text: ' "credits_used": 5, "eta_seconds": 12}' },
];

const colorMap: Record<string, string> = {
  comment: "text-muted-foreground",
  command: "text-green-400",
  flag: "text-primary",
  response: "text-amber-300",
  empty: "",
};

export function TerminalPreview() {
  return (
    <div className="w-full max-w-2xl mx-auto mt-14">
      {/* Window chrome */}
      <div
        className="rounded-t-xl px-4 py-3 flex items-center gap-2"
        style={{ background: "#0d1117" }}
      >
        <div className="w-3 h-3 rounded-full bg-red-400/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
        <div className="w-3 h-3 rounded-full bg-green-400/80" />
        <span className="ml-3 text-xs text-muted-foreground font-mono">terminal</span>
      </div>
      {/* Code block */}
      <div
        className="rounded-b-xl p-5 font-mono text-[13px] leading-6 overflow-x-auto border border-t-0"
        style={{ background: "#0a0f1a", borderColor: "rgba(255,255,255,0.08)" }}
      >
        {lines.map((line, i) => (
          <div key={i} className={colorMap[line.type]}>
            {line.type === "command" && (
              <span className="text-muted-foreground mr-2 select-none">$</span>
            )}
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
