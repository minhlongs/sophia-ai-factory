"use client";

import React, { useState } from "react";
import { ScriptRecord } from "@/types";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Play, Loader2, RefreshCw } from "lucide-react";
import { renderVideo } from "@/app/actions/automation";
import { useRouter } from "next/navigation";

interface ProjectCardProps {
  project: ScriptRecord;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    generated: "default", // Ready for review/render
    video_queued: "secondary",
    video_ready: "default", // Success
    published: "outline",
  };

  const handleRender = async () => {
    if (!project.id) return;
    setLoading(true);
    try {
      await renderVideo(project.id);
      router.refresh();
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg font-semibold line-clamp-1 text-foreground" title={project.topic}>
            {project.topic}
          </CardTitle>
          <Badge variant={statusColors[project.status] || "outline"}>
            {project.status.replace("_", " ")}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Created {new Date(project.createdAt).toLocaleDateString()}
        </p>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        <div className="text-sm text-muted-foreground line-clamp-3 bg-muted p-3 rounded-md min-h-[4.5rem]">
          {project.content || "Generating content..."}
        </div>
      </CardContent>

      <CardFooter className="pt-0 flex gap-2">
        {project.status === "generated" && (
          <Button
            size="sm"
            className="w-full"
            onClick={handleRender}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
            ) : (
              <Video className="w-3 h-3 mr-2" />
            )}
            Render Video
          </Button>
        )}

        {project.videoUrl && (
          <a
            href={project.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
          >
            <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white">
              <Play className="w-3 h-3 mr-2" />
              Watch Video
            </Button>
          </a>
        )}

        {["draft", "video_queued", "voice_generating"].includes(project.status) && (
          <Button size="sm" variant="outline" className="w-full" disabled>
            <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
            Processing
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
