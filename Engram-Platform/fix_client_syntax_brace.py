content = open("frontend/src/lib/memory-client.ts").read()

bad_block = """    return this.fetch<{ status: string; message: string }>(
      `/memories/confidence-maintenance${params.toString() ? `?${params.toString()}` : ''}`,
      { method: 'POST' },
      signal,
    );
  }
  }

  /**
   * POST /memories/consolidate"""

good_block = """    return this.fetch<{ status: string; message: string }>(
      `/memories/confidence-maintenance${params.toString() ? `?${params.toString()}` : ''}`,
      { method: 'POST' },
      signal,
    );
  }

  /**
   * POST /memories/consolidate"""

content = content.replace(bad_block, good_block)
open("frontend/src/lib/memory-client.ts", "w").write(content)
print("Fixed stray brace in client.ts")
