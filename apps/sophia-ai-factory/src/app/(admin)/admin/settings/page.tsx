"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export default function SettingsPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Platform configuration and preferences</p>
      </div>

      {/* Environment Info */}
      <Card glass className="mb-6">
        <CardHeader>
          <CardTitle>Environment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-white/10">
              <span className="text-gray-400">Mode</span>
              <span className="text-white font-medium">Development</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/10">
              <span className="text-gray-400">Build</span>
              <span className="text-white font-medium">Static Export</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">Auth</span>
              <span className="text-white font-medium">Basic Auth (Middleware)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys (Mock) */}
      <Card glass className="mb-6">
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                Admin Username
              </label>
              <input
                type="text"
                value={process.env.NEXT_PUBLIC_ADMIN_USER || "admin"}
                disabled
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">
                Mock Tier Override
              </label>
              <select className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white">
                <option value="BASIC">BASIC</option>
                <option value="PREMIUM">PREMIUM</option>
                <option value="ENTERPRISE" selected>ENTERPRISE</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Set NEXT_PUBLIC_MOCK_TIER in .env to change default tier
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card glass>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button variant="secondary" className="w-full">
              Clear Cache
            </Button>
            <Button variant="secondary" className="w-full">
              Export Data (JSON)
            </Button>
            <Button variant="secondary" className="w-full text-red-400 hover:text-red-300">
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
