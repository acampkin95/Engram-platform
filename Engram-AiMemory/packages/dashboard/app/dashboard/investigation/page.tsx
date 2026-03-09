"use client";

import { useState } from "react";
import useSWR from "swr";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Matter {
  id: string;
  title: string;
  matter_type: string;
  status: string;
  tenant_id: string;
  created_at: string;
  subject_count?: number;
  evidence_count?: number;
}

const fetcher = (url: string) =>
  fetch(`${API_URL}${url}`, {
    headers: {
      Authorization: `Bearer ${typeof window !== "undefined" ? (localStorage.getItem("auth_token") ?? "") : ""}`,
    },
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export default function InvestigationPage() {
  const [selectedMatter, setSelectedMatter] = useState<string | null>(null);

  const { data, error, isLoading } = useSWR<Matter[]>("/matters/", fetcher, {
    onErrorRetry: (_err, _key, _config, revalidate, { retryCount }) => {
      if (retryCount >= 3) return;
      setTimeout(() => revalidate({ retryCount }), 5000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2 justify-center">
          <span>⚠</span>
          <span>Failed to load investigation matters: {error.message}</span>
        </div>
      </div>
    );
  }

  const matters = data ?? [];

  const toggleMatter = (id: string) => {
    setSelectedMatter(selectedMatter === id ? null : id);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Investigation Matters</h1>
          <p className="text-slate-400">Browse and manage investigation matters</p>
        </div>
        <span className="text-sm text-slate-500">{matters.length} total</span>
      </div>

      {matters.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-lg font-medium text-slate-400">No investigation matters found</p>
          <p className="text-sm mt-1">Create a matter to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {matters.map((matter) => (
            <button
              key={matter.id}
              type="button"
              onClick={() => toggleMatter(matter.id)}
              className="w-full text-left bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-cyan-500/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-100">{matter.title}</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {matter.matter_type} · {matter.tenant_id}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium ${
                    matter.status === "active"
                      ? "bg-green-500/20 text-green-400"
                      : matter.status === "closed"
                        ? "bg-slate-600/50 text-slate-400"
                        : "bg-yellow-500/20 text-yellow-400"
                  }`}
                >
                  {matter.status}
                </span>
              </div>

              {selectedMatter === matter.id && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500 text-xs uppercase tracking-wider">ID</span>
                    <p className="font-mono text-xs text-slate-300 truncate mt-0.5">{matter.id}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs uppercase tracking-wider">Type</span>
                    <p className="text-slate-300 mt-0.5">{matter.matter_type}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs uppercase tracking-wider">Created</span>
                    <p className="text-slate-300 mt-0.5">
                      {new Date(matter.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
