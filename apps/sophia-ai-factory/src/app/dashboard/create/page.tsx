import React from "react";
import { CreateProjectFormWithTemplates } from "../components/campaign-creation-form-with-template-selector";

export default function CreateProjectPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create New Campaign</h1>
        <p className="text-gray-500">Choose a template and customize your campaign</p>
      </div>

      <CreateProjectFormWithTemplates />
    </div>
  );
}
