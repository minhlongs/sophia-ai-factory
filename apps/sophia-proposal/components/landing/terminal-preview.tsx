"use client";

const lines = [
  { type: "comment", text: "# Launch an AI mission via the Sophia API" },
  { type: "command", text: 'curl -X POST https://api.sophia.ai/v1/missions \\' },
  { type: "flag", text: '  -H "Authorization: Bearer sk_live_..." \\' },
  { type: "flag", text: '  -H "Content-Type: application/json" \\' },
  { type: "flag", text: '  -d \'{"command": "proposal:create",' },
  { type: "flag", text: '       "params": {"client": "Acme Corp"}}\'' },
  { type: "empty", text: "" },
  { type: "response", text: '{"id": "msn_7f3k9x", "status": "running",' },
  { type: "response", text: ' "credits_used": 5, "eta_seconds": 12}' },
];

const colorMap: Record<string, string> = {
  comment: "text-gray-500",
  command: "text-green-400",
  flag: "text-blue-300",
  response: "text-amber-300",
  empty: "",
};

export function TerminalPreview() {
  return (
    <div className="w-full max-w-2xl mx-auto mt-14">
      {/* Window chrome */}
      <div className="bg-[#1e1e2e] rounded-t-xl px-4 py-3 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-400/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
        <div className="w-3 h-3 rounded-full bg-green-400/80" />
        <span className="ml-3 text-xs text-gray-500 font-mono">terminal</span>
      </div>
      {/* Code */}
      <div className="bg-[#11111b] rounded-b-xl p-5 font-mono text-[13px] leading-6 overflow-x-auto border border-gray-800/50 border-t-0">
        {lines.map((line, i) => (
          <div key={i} className={colorMap[line.type]}>
            {line.type === "command" && <span className="text-gray-500 mr-2 select-none">$</span>}
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
