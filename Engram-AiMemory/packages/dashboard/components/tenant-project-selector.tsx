"use client";

import useSWR from "swr";
import { authHeaders } from "@/lib/auth";

const fetcher = (url: string) => fetch(url, { headers: authHeaders() }).then((r) => r.json());

interface TenantListResponse {
  tenants: string[];
  total: number;
}

export interface TenantProjectContext {
  tenantId: string;
  projectId: string;
}

interface Props {
  apiUrl: string;
  value: TenantProjectContext;
  onChange: (ctx: TenantProjectContext) => void;
}

export function TenantProjectSelector({ apiUrl, value, onChange }: Props) {
  const { data } = useSWR<TenantListResponse>(`${apiUrl}/tenants`, fetcher, {
    revalidateOnFocus: false,
  });

  const tenants = data?.tenants ?? ["default"];

  return (
    <div className="flex items-center gap-2 text-sm">
      <label
        htmlFor="tps-tenant"
        className="text-[#5C5878] shrink-0 font-mono text-xs uppercase tracking-wider"
      >
        Tenant
      </label>
      <select
        id="tps-tenant"
        value={value.tenantId}
        onChange={(e) => onChange({ ...value, tenantId: e.target.value })}
        className="px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[#A09BB8] text-sm focus:outline-none focus:border-amber-500/50"
      >
        {tenants.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <label
        htmlFor="tps-project"
        className="text-[#5C5878] shrink-0 ml-2 font-mono text-xs uppercase tracking-wider"
      >
        Project
      </label>
      <input
        id="tps-project"
        type="text"
        value={value.projectId}
        onChange={(e) => onChange({ ...value, projectId: e.target.value })}
        placeholder="default"
        className="w-32 px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[#A09BB8] text-sm focus:outline-none focus:border-amber-500/50"
      />
    </div>
  );
}

/** Returns default context from env vars or hardcoded fallback. */
export function defaultTenantProjectContext(): TenantProjectContext {
  return {
    tenantId: process.env.NEXT_PUBLIC_DEFAULT_TENANT ?? "default",
    projectId: process.env.NEXT_PUBLIC_DEFAULT_PROJECT ?? "default",
  };
}
