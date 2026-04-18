# Claude Code Marketplace

Local Claude Code marketplace content for this repo.

## Install

Add this marketplace to `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "engram-local": {
      "source": {
        "source": "directory",
        "path": "/Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/claude-code-marketplace"
      }
    }
  },
  "enabledPlugins": {
    "engram-memory-helper@engram-local": true
  }
}
```

Then open Claude Code and enable the plugin with `/plugin` if needed.
