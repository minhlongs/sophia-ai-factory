import React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { getUserProjects } from "@/app/actions/automation";
import { ProjectGrid } from "./components/project-grid";

export default async function DashboardPage() {
  const projects = await getUserProjects();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Manage your AI video projects</p>
        </div>
        <Link href="/dashboard/create">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <h3 className="text-lg font-medium text-gray-900">No projects yet</h3>
          <p className="text-gray-500 mt-1 mb-6">Start creating your first AI video</p>
          <Link href="/dashboard/create">
            <Button variant="outline">Create Project</Button>
          </Link>
        </div>
      ) : (
        <ProjectGrid projects={projects} />
      )}
    </div>
  );
}
