"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isClient, isLoading, isAuthenticated, router]);

  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white border-b border-surface-container-highest">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
              </div>
              <h1 className="text-lg font-semibold text-gray-900">Sophia AI Factory</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a href="/missions" className="text-sm font-medium text-orange-600 hover:text-orange-700">Missions</a>
              <a href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</a>
              <span className="text-sm text-gray-600">{user.email}</span>
              <button className="text-sm text-primary hover:text-primary-hover font-medium">
                Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-primary-container rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            Welcome to Sophia AI Factory
          </h2>
          <p className="text-white/80">
            Start building your AI applications in minutes
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Missions — RaaS entry point */}
          <a
            href="/missions"
            className="bg-white rounded-xl p-6 shadow-sm border border-orange-200 hover:shadow-md hover:border-orange-400 transition-all"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-orange-500 text-2xl">rocket_launch</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Missions</h3>
            <p className="text-sm text-gray-600">Run AI-powered tasks via OpenClaw RaaS</p>
          </a>

          <a
            href="/dashboard/projects"
            className="bg-white rounded-xl p-6 shadow-sm border border-surface-container-highest hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-primary-container rounded-lg flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-2xl">folder</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Projects</h3>
            <p className="text-sm text-gray-600">Create and manage AI applications</p>
          </a>

          <a
            href="/dashboard/templates"
            className="bg-white rounded-xl p-6 shadow-sm border border-surface-container-highest hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-primary-container rounded-lg flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-2xl">dashboard</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Templates</h3>
            <p className="text-sm text-gray-600">Browse pre-built AI templates</p>
          </a>

          <a
            href="/dashboard/docs"
            className="bg-white rounded-xl p-6 shadow-sm border border-surface-container-highest hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-primary-container rounded-lg flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-2xl">menu_book</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Documentation</h3>
            <p className="text-sm text-gray-600">Learn how to build with Sophia</p>
          </a>
        </div>

        {/* Getting Started */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-surface-container-highest">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Getting Started</h3>
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                1
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Create your first project</p>
                <p className="text-sm text-gray-600">Choose a template or start from scratch</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                2
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Configure your AI model</p>
                <p className="text-sm text-gray-600">Connect your preferred LLM provider</p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                3
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Deploy and share</p>
                <p className="text-sm text-gray-600">Push to production with one click</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
