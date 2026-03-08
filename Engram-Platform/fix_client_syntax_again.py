content = open("frontend/src/lib/memory-client.ts").read()

bad_block = """  }
    const params = new URLSearchParams();
    if (tenant_id) params.append('tenant_id', tenant_id);

    return this.fetch<{ processed: number }>(
      `/memories/decay${params.toString() ? `?${params.toString()}` : ''}`,
      { method: 'POST' },
      signal,
    );
"""

content = content.replace(bad_block, "  }\n")
open("frontend/src/lib/memory-client.ts", "w").write(content)
print("Fixed client syntax again")
