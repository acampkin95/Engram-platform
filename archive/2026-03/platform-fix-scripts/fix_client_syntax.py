content = open("frontend/src/lib/memory-client.ts").read()

bad_block = """  async runDecay(
    tenant_id?: string,
    signal?: AbortSignal,
  ): Promise<{ data: { processed: number } | null; error: string | null }> {
    const params = new URLSearchParams();
    if (tenant_id) params.append('tenant_id', tenant_id);

    return this.fetch<{ processed: number }>(
      `/memories/decay${params.toString() ? `?${params.toString()}` : ''}`,
      { method: 'POST' },
      signal,
    );
  }
    const params = new URLSearchParams();
    if (tenant_id) params.append('tenant_id', tenant_id);

    return this.fetch<{ processed: number }>(
"""

good_block = """  async runDecay(
    tenant_id?: string,
    signal?: AbortSignal,
  ): Promise<{ data: { processed: number } | null; error: string | null }> {
    const params = new URLSearchParams();
    if (tenant_id) params.append('tenant_id', tenant_id);

    return this.fetch<{ processed: number }>(
      `/memories/decay${params.toString() ? `?${params.toString()}` : ''}`,
      { method: 'POST' },
      signal,
    );
  }
"""

content = content.replace(bad_block, good_block)
open("frontend/src/lib/memory-client.ts", "w").write(content)
print("Fixed client syntax")
