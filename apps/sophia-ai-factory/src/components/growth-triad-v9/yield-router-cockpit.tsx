import React from 'react';

export interface RouteHop {
  id: string;
  name: string;
  latency: number;
  cost: number;
  status: 'active' | 'degraded' | 'offline';
}

export interface YieldRouterCockpitProps {
  title?: string;
  routes: RouteHop[];
  activeRouteId?: string;
  className?: string;
}

export function YieldRouterCockpit({ title = 'Yield Routing Topology', routes, activeRouteId, className = '' }: YieldRouterCockpitProps) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900 p-6 text-white shadow-xl ${className}`}>
      <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-4">
        <h2 className="text-xl font-semibold tracking-tight text-amber-500">{title}</h2>
        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500">Live</span>
      </div>

      <div className="space-y-4">
        {routes.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">No routing data available.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {routes.map((route) => (
              <div
                key={route.id}
                className={`relative overflow-hidden rounded-lg border p-4 transition-all duration-300 ${
                  activeRouteId === route.id
                    ? 'border-amber-500 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    : 'border-gray-800 bg-gray-950 hover:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-200">{route.name}</h3>
                  <div className={`h-2.5 w-2.5 rounded-full ${
                    route.status === 'active' ? 'bg-emerald-500' :
                    route.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs">Latency</span>
                    <span className="font-mono text-gray-300">{route.latency}ms</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs">Cost/Req</span>
                    <span className="font-mono text-gray-300">${route.cost.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
