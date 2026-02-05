import React from "react";
import { CreateProjectForm } from "../components/create-project-form";

export default function CreateProjectPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
        <p className="text-gray-500">Tell us what you want to create</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <CreateProjectForm />
      </div>
    </div>
  );
}
