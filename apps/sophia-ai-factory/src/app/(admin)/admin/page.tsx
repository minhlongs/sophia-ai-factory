import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getAdminStats } from "@/app/actions/admin";
import { Users, Package, TrendingUp, DollarSign } from "lucide-react";

export default async function AdminDashboard() {
  const stats = await getAdminStats();

  // Map server stats to UI format
  const statCards = [
    {
      label: "Total Users",
      value: stats.activeUsers.toString(),
      icon: Users,
      color: "text-[var(--neon-cyan)]",
      bg: "bg-[var(--neon-cyan)]/10",
    },
    {
      label: "Total Scripts",
      value: stats.totalScripts.toString(),
      icon: Package,
      color: "text-[var(--neon-purple)]",
      bg: "bg-[var(--neon-purple)]/10",
    },
    {
      label: "Published Videos",
      value: stats.publishedVideos.toString(),
      icon: TrendingUp,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      label: "Revenue",
      value: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.revenue),
      icon: DollarSign,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Platform overview and key metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between py-3 border-b border-white/10 last:border-0"
              >
                <div>
                  <p className="text-sm text-white">{activity.action}</p>
                  <p className="text-xs text-gray-400 mt-1">{activity.user}</p>
                </div>
                <span className="text-xs text-gray-500">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
