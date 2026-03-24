"use client";

import React from "react";

export default function ProposalsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Coming soon banner */}
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <span className="material-symbols-outlined text-amber-500">construction</span>
        <p className="text-sm font-medium text-amber-800">
          Proposals feature coming soon — this section is under active development.
        </p>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
          <p className="text-gray-600 mt-1">Manage and track your proposal pipeline</p>
        </div>
        <button
          disabled
          className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-400 rounded-lg cursor-not-allowed"
          title="Coming soon"
        >
          <span className="material-symbols-outlined mr-2">add</span>
          New Proposal
        </button>
      </div>

      {/* Empty state — data will load once feature is live */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-16 text-center">
        <span className="material-symbols-outlined text-5xl text-gray-300 mb-4 block">description</span>
        <p className="text-gray-500 text-sm">Proposal management will be available here soon.</p>
      </div>
    </div>
  );
}
