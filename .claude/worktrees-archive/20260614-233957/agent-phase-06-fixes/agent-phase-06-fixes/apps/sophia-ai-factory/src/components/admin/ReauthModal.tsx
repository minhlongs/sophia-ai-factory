"use client";

/**
 * ReauthModal — Admin re-authentication challenge (ASVS V3.5.1 / SG-003).
 *
 * Displays a password prompt before admin destructive mutations. On success the
 * server mints an `admin_challenge_token` HttpOnly cookie (5-min TTL) which is
 * then sent automatically with subsequent same-origin requests.
 *
 * Usage:
 *   const { confirmed, ReauthModalElement } = useReauth();
 *   // render ReauthModalElement somewhere in JSX
 *   // call confirmed() before any destructive API call — shows modal if no
 *   // valid challenge token exists, resolves true on success or false on cancel.
 */

import { useState, useCallback, useRef } from "react";
import { Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/seed/components/ui/dialog";

type ResolveRef = ((ok: boolean) => void) | null;

interface ReauthState {
  open: boolean;
  error: string | null;
  loading: boolean;
  showPassword: boolean;
}

const INITIAL_STATE: ReauthState = {
  open: false,
  error: null,
  loading: false,
  showPassword: false,
};

/**
 * useReauth — hook that provides an imperative `confirmed()` gate.
 *
 * Returns:
 *   confirmed() — async function; shows the modal and resolves true/false.
 *   ReauthModalElement — JSX element to render in the host component.
 */
export function useReauth() {
  const [state, setState] = useState<ReauthState>(INITIAL_STATE);
  const resolveRef = useRef<ResolveRef>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  /** Show the modal and return a promise that resolves when the user submits or cancels. */
  const confirmed = useCallback((): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...INITIAL_STATE, open: true });
      // Focus the password field after the dialog animates in.
      setTimeout(() => passwordRef.current?.focus(), 150);
    });
  }, []);

  const handleCancel = useCallback(() => {
    setState(INITIAL_STATE);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = passwordRef.current?.value ?? "";
    if (!password) {
      setState((s) => ({ ...s, error: "Password is required." }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const resp = await fetch("/api/auth/admin-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "same-origin",
      });

      if (resp.ok) {
        // Cookie set by server — resolve and close.
        setState(INITIAL_STATE);
        resolveRef.current?.(true);
        resolveRef.current = null;
        return;
      }

      const body = (await resp.json().catch(() => null)) as { reason?: string } | null;
      const reason = body?.reason;
      const msg =
        reason === "wrong_password"
          ? "Incorrect password. Please try again."
          : reason === "missing_input"
          ? "Password is required."
          : reason === "no_session"
          ? "Session expired. Please reload the page."
          : "Authentication failed. Please try again.";
      setState((s) => ({ ...s, loading: false, error: msg }));
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Network error. Please try again." }));
    }
  }, []);

  const ReauthModalElement = (
    <Dialog open={state.open} onOpenChange={(open) => { if (!open) handleCancel(); }}>
      <DialogContent className="max-w-sm bg-background border-border text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <ShieldCheck className="w-5 h-5 text-accent-400" />
            Confirm Your Identity
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This action requires re-authentication. Enter your admin password to continue.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="relative">
            <input
              ref={passwordRef}
              id="reauth-password"
              type={state.showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Admin password"
              disabled={state.loading}
              className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-md text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, showPassword: !s.showPassword }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
              tabIndex={-1}
              aria-label={state.showPassword ? "Hide password" : "Show password"}
            >
              {state.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {state.error && (
            <p className="text-sm text-rose-400">{state.error}</p>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={state.loading}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-white disabled:opacity-50 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={state.loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background font-medium rounded-md transition text-sm"
            >
              {state.loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {state.loading ? "Verifying…" : "Confirm"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { confirmed, ReauthModalElement };
}
