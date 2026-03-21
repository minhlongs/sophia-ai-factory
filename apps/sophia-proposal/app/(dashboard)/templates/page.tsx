"use client";

import React from "react";
import { getAllSystemTemplates } from "@/lib/ai/proposal-templates";

const templates = getAllSystemTemplates();

export default function TemplatesPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Proposal Templates</h1>
        <p className="text-gray-600 mt-1">
          Choose from pre-built templates or create custom ones
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-primary-container rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl">
                  description
                </span>
              </div>
              {template.isSystem && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                  System
                </span>
              )}
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{template.description}</p>

            <div className="mb-4">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {template.industry}
              </span>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Sections included:</p>
              <div className="flex flex-wrap gap-1">
                {template.sections.slice(0, 4).map((section) => (
                  <span
                    key={section.key}
                    className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded"
                  >
                    {section.title}
                  </span>
                ))}
                {template.sections.length > 4 && (
                  <span className="px-2 py-1 bg-gray-50 text-gray-500 text-xs rounded">
                    +{template.sections.length - 4} more
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Custom Template CTA */}
      <div className="mt-8 bg-gradient-to-r from-primary-container to-primary-container/50 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Need a custom template?</h3>
            <p className="text-gray-600 mt-1">
              Create a template tailored to your specific industry and use case
            </p>
          </div>
          <button className="px-4 py-2 bg-white text-primary rounded-lg hover:bg-gray-50 font-medium">
            Create Custom Template
          </button>
        </div>
      </div>
    </div>
  );
}
