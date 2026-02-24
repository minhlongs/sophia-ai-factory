"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Platform configuration and preferences</p>
      </div>

      {/* Environment Info */}
      <Card glass className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle>Environment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Mode</span>
              <span className="text-foreground font-medium">Development</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Build</span>
              <span className="text-foreground font-medium">Static Export</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Auth</span>
              <span className="text-foreground font-medium">Basic Auth (Middleware)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrations Link */}
      <Link href="/admin/settings/integrations" className="block mb-6">
        <Card glass className="bg-card border-border hover:bg-muted/50 transition-colors cursor-pointer">
        <CardHeader>
          <CardTitle className="flex justify-between items-center text-foreground">
            <span>Affiliate Integrations</span>
            <span className="text-sm text-primary">Manage Keys →</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Connect ClickBank, ShareASale, and Amazon Associates to sync your sales data.
          </p>
        </CardContent>
      </Card>
      </Link>

      {/* API Keys (Mock) */}
      <Card glass className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="admin-username" className="text-sm text-muted-foreground mb-2 block">
                Admin Username
              </label>
              <input
                id="admin-username"
                type="text"
                value={process.env.NEXT_PUBLIC_ADMIN_USER || "admin"}
                disabled
                className="w-full px-4 py-2 bg-muted border border-input rounded-lg text-foreground disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="mock-tier" className="text-sm text-muted-foreground mb-2 block">
                Mock Tier Override
              </label>
              <select id="mock-tier" className="w-full px-4 py-2 bg-muted border border-input rounded-lg text-foreground">
                <option value="BASIC">BASIC</option>
                <option value="PREMIUM">PREMIUM</option>
                <option value="ENTERPRISE" selected>ENTERPRISE</option>
              </select>
              <p className="text-xs text-muted-foreground mt-2">
                Set NEXT_PUBLIC_MOCK_TIER in .env to change default tier
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card glass className="bg-card border-border">
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
            <Button variant="secondary" className="w-full text-destructive hover:text-destructive/80">
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
