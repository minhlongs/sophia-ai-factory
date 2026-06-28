/**
 * Simple toast notification hook
 * Uses browser alert for now - can be upgraded to a proper toast library later
 */

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function useToast() {
  const toast = ({ title, description, variant }: ToastOptions) => {
    const message = description ? `${title}\n${description}` : title;

    if (variant === "destructive") {
      alert(`❌ ${message}`);
    } else {
      alert(`✅ ${message}`);
    }
  };

  return { toast };
}
