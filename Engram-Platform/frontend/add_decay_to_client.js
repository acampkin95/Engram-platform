const fs = require('node:fs');
const file = 'src/lib/memory-client.ts';
let code = fs.readFileSync(file, 'utf8');

const newMethod = `  /**
   * DELETE /memories/{id}
   * Delete a memory.
   */
  async deleteMemory(
    id: string,
    signal?: AbortSignal,
  ): Promise<{ data: { message: string } | null; error: string | null }> {
    return this.fetch<{ message: string }>(
      \`/memories/\${encodeURIComponent(id)}\`,
      {
        method: 'DELETE',
      },
      signal,
    );
  }

  /**
   * POST /memories/decay
   * Manually trigger decay process for all memories
   */
  async runDecay(
    tenant_id?: string,
    signal?: AbortSignal,
  ): Promise<{ data: { processed: number } | null; error: string | null }> {
    const params = new URLSearchParams();
    if (tenant_id) params.append('tenant_id', tenant_id);

    return this.fetch<{ processed: number }>(
      \`/memories/decay\${params.toString() ? \`?\${params.toString()}\` : ''}\`,
      { method: 'POST' },
      signal,
    );
  }

  /**
   * POST /memories/consolidate
   * Trigger memory consolidation
   */
  async consolidateMemories(
    filters?: { tenant_id?: string; project_id?: string },
    signal?: AbortSignal,
  ): Promise<{ data: { processed: number } | null; error: string | null }> {
    const params = new URLSearchParams();
    if (filters?.tenant_id) params.append('tenant_id', filters.tenant_id);
    if (filters?.project_id) params.append('project_id', filters.project_id);

    return this.fetch<{ processed: number }>(
      \`/memories/consolidate\${params.toString() ? \`?\${params.toString()}\` : ''}\`,
      { method: 'POST' },
      signal,
    );
  }

  /**
   * POST /memories/cleanup
   * Remove expired memories
   */
  async cleanupExpired(
    tenant_id?: string,
    signal?: AbortSignal,
  ): Promise<{ data: { removed: number } | null; error: string | null }> {
    const params = new URLSearchParams();
    if (tenant_id) params.append('tenant_id', tenant_id);

    return this.fetch<{ removed: number }>(
      \`/memories/cleanup\${params.toString() ? \`?\${params.toString()}\` : ''}\`,
      { method: 'POST' },
      signal,
    );
  }`;

code = code.replace(
  / {2}\/\*\*\n {3}\* DELETE \/memories\/\{id\}.*?return this\.fetch<\{ message: string \}>\(\n {6}`\/memories\/\$\{encodeURIComponent\(id\)\}`,\n {6}\{\n {8}method: 'DELETE',\n {6}\},\n {6}signal,\n {4}\);\n {2}\}/s,
  newMethod,
);
fs.writeFileSync(file, code);
console.log('Added methods to memory-client.ts');
