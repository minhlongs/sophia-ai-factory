import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Clock, Loader2, FileText } from "lucide-react";

export function getStatusIcon(status: string) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'failed': return <AlertCircle className="w-5 h-5 text-destructive" />;
    case 'queued': return <Clock className="w-5 h-5 text-muted-foreground" />;
    case 'draft': return <FileText className="w-5 h-5 text-muted-foreground" />;
    default: return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
  }
}

export function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    queued: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    processing_script: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    processing_video: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    failed: "bg-destructive/10 text-destructive"
  };
  return <Badge className={styles[status] || "bg-muted"}>{status.replace('_', ' ')}</Badge>;
}
