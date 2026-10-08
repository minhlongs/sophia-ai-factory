import React from 'react';

export interface MatrixNode {
  id: string;
  platform: string;
  accountName: string;
  zScore: number;
  shadowbanRisk: number; // 0 to 1
}

export interface GhostMatrixCockpitProps {
  title?: string;
  nodes: MatrixNode[];
  className?: string;
}

export function GhostMatrixCockpit({ title = 'Ghost Matrix Z-Score Analysis', nodes, className = '' }: GhostMatrixCockpitProps) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900 p-6 text-white shadow-xl ${className}`}>
      <div className="mb-6 flex items-center justify-between border-b border-gray-800 pb-4">
        <h2 className="text-xl font-semibold tracking-tight text-cyan-500">{title}</h2>
        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">Monitoring</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-gray-800/50 text-xs uppercase text-gray-300">
            <tr>
              <th scope="col" className="px-4 py-3 rounded-tl-lg">Account</th>
              <th scope="col" className="px-4 py-3">Platform</th>
              <th scope="col" className="px-4 py-3">Z-Score</th>
              <th scope="col" className="px-4 py-3 rounded-tr-lg">Shadowban Risk</th>
            </tr>
          </thead>
          <tbody>
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No nodes reporting.</td>
              </tr>
            ) : (
              nodes.map((node) => (
                <tr key={node.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium text-gray-300">{node.accountName}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-gray-800 px-2 py-1 text-xs font-medium text-gray-300 ring-1 ring-inset ring-gray-700">
                      {node.platform}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <span className={`${node.zScore > 2 ? 'text-red-400' : node.zScore > 1 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {node.zScore > 0 ? '+' : ''}{node.zScore.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-full max-w-[100px] overflow-hidden rounded-full bg-gray-800">
                        <div
                          className={`h-full rounded-full ${
                            node.shadowbanRisk > 0.7 ? 'bg-red-500' :
                            node.shadowbanRisk > 0.4 ? 'bg-yellow-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, node.shadowbanRisk * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono">{(node.shadowbanRisk * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
