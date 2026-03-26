"use client";

import { useState } from "react";

interface ProvisionedClient {
  org_id: string;
  email: string;
  org_name: string;
  api_key: string;
  mcu_balance: number;
}

interface ExistingClient {
  id: string;
  name: string;
  email: string;
  plan: string;
  created_at: string;
}

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [mcuCredits, setMcuCredits] = useState(200);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProvisionedClient | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ProvisionedClient[]>([]);
  const [clients, setClients] = useState<ExistingClient[]>([]);
  const [showClients, setShowClients] = useState(false);

  const provision = async () => {
    if (!email.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/admin/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          org_name: orgName || undefined,
          mcu_credits: mcuCredits,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setResult(data);
      setHistory((prev) => [data, ...prev]);
      setEmail("");
      setOrgName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const res = await fetch("/api/admin/provision");
      const data = await res.json();
      setClients(data.clients || []);
      setShowClients(true);
    } catch {
      setError("Failed to load clients");
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-600 mt-1">
            Provision client accounts — enter email, get API key instantly
          </p>
        </div>

        {/* Provision Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Create Client Account
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@company.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                onKeyDown={(e) => e.key === "Enter" && provision()}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Org Name (optional)
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Auto from email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  MCU Credits
                </label>
                <input
                  type="number"
                  value={mcuCredits}
                  onChange={(e) => setMcuCredits(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              onClick={provision}
              disabled={loading || !email}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating..." : "Create Account & Get Key"}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-semibold text-green-800 mb-2">
                Account created for {result.email}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">API Key:</span>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-2 py-1 rounded border text-xs font-mono">
                      {result.api_key}
                    </code>
                    <button
                      onClick={() => copyKey(result.api_key)}
                      className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs hover:bg-indigo-200"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Org:</span>
                  <span>{result.org_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">MCU Balance:</span>
                  <span>{result.mcu_balance}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Login:</span>
                  <span className="text-xs">sophia.agencyos.network/login (magic link)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Session History */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Created This Session ({history.length})
            </h2>
            <div className="space-y-3">
              {history.map((client, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{client.email}</p>
                    <p className="text-xs text-gray-500">{client.org_name} — {client.mcu_balance} MCU</p>
                  </div>
                  <button
                    onClick={() => copyKey(client.api_key)}
                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-xs hover:bg-indigo-200"
                  >
                    Copy Key
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Clients */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              All Clients
            </h2>
            <button
              onClick={loadClients}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              {showClients ? "Refresh" : "Load"}
            </button>
          </div>

          {showClients && (
            <div className="space-y-2">
              {clients.length === 0 ? (
                <p className="text-sm text-gray-500">No clients yet</p>
              ) : (
                clients.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{c.email}</p>
                      <p className="text-xs text-gray-500">
                        {c.name} — {c.plan} — {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <p className="text-xs text-gray-400 mt-2">
                Showing up to 100 clients
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
