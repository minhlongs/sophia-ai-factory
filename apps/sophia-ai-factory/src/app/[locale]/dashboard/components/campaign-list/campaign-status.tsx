import { Badge } from "@/seed/components/ui/badge";
import { CheckCircle2, AlertCircle, Clock, Loader2, FileText } from "lucide-react";

export function getStatusIcon(status: string) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-500" aria-hidden="true" />;
    case 'failed': return <AlertCircle className="w-5 h-5 text-destructive" aria-hidden="true" />;
    case 'queued': return <Clock className="w-5 h-5 text-muted-foreground" aria-hidden="true" />;
    case 'draft': return <FileText className="w-5 h-5 text-muted-foreground" aria-hidden="true" />;
    default: return <Loader2 className="w-5 h-5 text-primary motion-safe:animate-spin" aria-hidden="true" />;
  }
}

export function getStatusBadge(status: string, label?: string) {
  const styles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    queued: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    processing_script: "bg-primary/10 text-primary dark:bg-primary/10/30 dark:text-primary",
    processing_video: "bg-primary/10 text-primary dark:bg-primary/10/30 dark:text-primary",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    failed: "bg-destructive/10 text-destructive"
  };
  return <Badge className={styles[status] || "bg-muted"}>{label || status.replace(/_/g, ' ')}</Badge>;
}
