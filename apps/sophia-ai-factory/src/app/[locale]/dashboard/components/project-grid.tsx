"use client";

import React, { useEffect } from "react";
import { ScriptRecord } from "@/seed/types";
import { ProjectCard } from "./project-card";
import { useRouter } from "next/navigation";

interface ProjectGridProps {
  projects: ScriptRecord[];
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  const router = useRouter();

  // Check if any project is in a processing state
  const hasActiveJobs = projects.some((p) =>
    ["draft", "voice_generating", "video_queued", "video_generating"].includes(p.status)
  );

  useEffect(() => {
    if (!hasActiveJobs) return;

    // Poll every 10 seconds if there are active jobs
    const interval = setInterval(() => {
      router.refresh();
    }, 10000);

    return () => clearInterval(interval);
  }, [hasActiveJobs, router]);

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
