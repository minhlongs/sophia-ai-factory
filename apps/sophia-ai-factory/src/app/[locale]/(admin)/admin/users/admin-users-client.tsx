"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export interface AdminUserRow {
  id: string;
  email: string;
  tier: string;
  status: "active" | "invited";
  createdAt: string;
}

interface AdminUsersClientProps {
  initialUsers: AdminUserRow[];
}

/**
 * Client-side admin user management with invite modal.
 */
export function AdminUsersClient({ initialUsers }: AdminUsersClientProps) {
  const t = useTranslations("admin.users");
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTier, setInviteTier] = useState("BASIC");
  const [inviting, setInviting] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setFeedback("");

    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " + btoa(`${prompt("Admin user") || ""}:${prompt("Admin password") || ""}`),
        },
        body: JSON.stringify({ email: inviteEmail, tier: inviteTier }),
      });

      const data = await res.json();

      if (data.success) {
        setFeedback(data.message);
        setUsers((prev) => [
          ...prev,
          {
            id: data.userId || "pending",
            email: inviteEmail,
            tier: inviteTier,
            status: "invited",
            createdAt: new Date().toISOString(),
          },
        ]);
        setInviteEmail("");
        setShowInvite(false);
      } else {
        setFeedback(data.message || "Failed to invite");
      }
    } catch {
      setFeedback("Network error");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("invite")}
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <p className="text-sm text-muted-foreground bg-muted rounded-lg px-4 py-2">
          {feedback}
        </p>
      )}

      {/* Invite Form */}
      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="rounded-xl border border-border bg-card p-6 space-y-4"
        >
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-foreground mb-1">
              {t("email")}
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="invite-tier" className="block text-sm font-medium text-foreground mb-1">
              {t("tier")}
            </label>
            <select
              id="invite-tier"
              value={inviteTier}
              onChange={(e) => setInviteTier(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="BASIC">BASIC</option>
              <option value="PREMIUM">PREMIUM</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {inviting ? "..." : t("invite")}
          </button>
        </form>
      )}

      {/* Users Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                {t("email")}
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                {t("tier")}
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                {t("status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-8 text-center text-muted-foreground"
                >
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-6 py-4 text-foreground">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                      {user.tier}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.status === "active"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-yellow-500/10 text-yellow-600"
                      }`}
                    >
                      {user.status === "active" ? t("active") : t("invited")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
