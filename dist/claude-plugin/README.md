# Engram Claude Plugin Marketplace

Standalone Claude Code marketplace metadata for the Engram Memory Helper plugin.

## Local directory install

Add this marketplace directory to `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "engram-local": {
      "source": {
        "source": "directory",
        "path": "/Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/dist/claude-plugin"
      }
    }
  },
  "enabledPlugins": {
    "engram-memory-helper@engram-local": true
  }
}
```

## GitHub marketplace source

If this repository is available on GitHub, the marketplace package points plugin installs and updates at:

- `https://github.com/acampkin95/Engram-platform.git`
- subdirectory: `claude-code-marketplace/plugins/engram-memory-helper`

That allows the Claude Code plugin manager to install and update the plugin from GitHub while this directory acts as the marketplace manifest.
