"""
Memory file compatibility layer for .claude and .cursor style files.

Supports:
- CLAUDE.md files (project-level instructions)
- .claude/settings.json (user preferences)
- .cursorrules files (Cursor IDE rules)
- .cursor/rules/ directory (Cursor rule files)

These files can be synced to/from the Weaviate memory system.
"""

import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime  # noqa: F401 — UTC re-exported for 15+ consumers
from enum import StrEnum
from pathlib import Path
from typing import Any

from rich.console import Console

console = Console()


class MemoryFileType(StrEnum):
    """Types of memory files supported."""

    CLAUDE_MD = "claude_md"  # CLAUDE.md project instructions
    CLAUDE_SETTINGS = "claude_settings"  # .claude/settings.json
    CURSOR_RULES = "cursor_rules"  # .cursorrules file
    CURSOR_RULE_DIR = "cursor_rule_dir"  # .cursor/rules/*.mdc


@dataclass
class MemoryFile:
    """Represents a memory file on disk."""

    path: Path
    content: str
    file_type: MemoryFileType
    metadata: dict[str, Any] = field(default_factory=dict)
    last_modified: datetime | None = None

    def to_memories(self) -> list[dict[str, Any]]:
        """Convert file content to memory entries."""
        raise NotImplementedError


@dataclass
class ClaudeMDFile(MemoryFile):
    """CLAUDE.md file parser."""

    file_type: MemoryFileType = MemoryFileType.CLAUDE_MD

    def to_memories(self) -> list[dict[str, Any]]:
        """Parse CLAUDE.md into memory entries."""
        memories = []

        # Split into sections by headers
        sections = re.split(r"\n(?=#{1,3}\s)", self.content)

        for section in sections:
            if not section.strip():
                continue

            # Extract section title
            lines = section.strip().split("\n")
            title_match = re.match(r"^(#{1,3})\s+(.+)$", lines[0]) if lines else None

            if title_match:
                title = title_match.group(2).strip()
                content = "\n".join(lines[1:]).strip()
            else:
                title = "Project Context"
                content = section.strip()

            if content:
                memories.append(
                    {
                        "content": f"{title}\n\n{content}",
                        "memory_type": "document",
                        "source": "claude_md",
                        "project_id": str(self.path.parent),
                        "metadata": {
                            "file_type": "claude_md",
                            "section": title,
                            "file_path": str(self.path),
                        },
                    }
                )

        return memories


@dataclass
class ClaudeSettingsFile(MemoryFile):
    """.claude/settings.json parser."""

    file_type: MemoryFileType = MemoryFileType.CLAUDE_SETTINGS

    def to_memories(self) -> list[dict[str, Any]]:
        """Parse settings.json into memory entries."""
        memories = []

        try:
            settings = json.loads(self.content)
        except json.JSONDecodeError:
            console.print(f"[yellow]Warning: Invalid JSON in {self.path}[/yellow]")
            return memories

        # Extract user preferences as memories
        if "preferences" in settings:
            memories.append(
                {
                    "content": f"User Preferences:\n{json.dumps(settings['preferences'], indent=2)}",
                    "memory_type": "preference",
                    "source": "claude_settings",
                    "metadata": {
                        "file_type": "claude_settings",
                        "file_path": str(self.path),
                    },
                }
            )

        # Extract custom instructions
        if "customInstructions" in settings:
            memories.append(
                {
                    "content": f"Custom Instructions:\n{settings['customInstructions']}",
                    "memory_type": "workflow",
                    "source": "claude_settings",
                    "metadata": {
                        "file_type": "claude_settings",
                        "file_path": str(self.path),
                    },
                }
            )

        # Extract any other significant settings
        for key, value in settings.items():
            if key not in ("preferences", "customInstructions") and isinstance(value, (str, dict)):
                if isinstance(value, dict):
                    value = json.dumps(value, indent=2)
                memories.append(
                    {
                        "content": f"{key}: {value}",
                        "memory_type": "preference",
                        "source": "claude_settings",
                        "metadata": {
                            "file_type": "claude_settings",
                            "setting_key": key,
                            "file_path": str(self.path),
                        },
                    }
                )

        return memories


@dataclass
class CursorRulesFile(MemoryFile):
    """.cursorrules file parser."""

    file_type: MemoryFileType = MemoryFileType.CURSOR_RULES

    def to_memories(self) -> list[dict[str, Any]]:
        """Parse .cursorrules into memory entries."""
        memories = []

        # Split by rule blocks (separated by --- lines)
        blocks = re.split(r"\n\s*---+\s*\n", self.content)

        for i, block in enumerate(blocks):
            block = block.strip()
            if not block:
                continue

            # Try to extract rule name from first line
            lines = block.split("\n")
            first_line = lines[0].strip()

            if first_line.startswith("#"):
                rule_name = first_line.lstrip("# ").strip()
                content = "\n".join(lines[1:]).strip()
            else:
                rule_name = f"Cursor Rule {i + 1}"
                content = block

            if content:
                memories.append(
                    {
                        "content": f"{rule_name}\n\n{content}",
                        "memory_type": "workflow",
                        "source": "cursor_rules",
                        "project_id": str(self.path.parent),
                        "metadata": {
                            "file_type": "cursor_rules",
                            "rule_name": rule_name,
                            "file_path": str(self.path),
                        },
                    }
                )

        return memories


class MemoryFileSync:
    """
    Synchronizes memory files with the Weaviate memory system.

    Usage:
        sync = MemoryFileSync(memory_system)
        await sync.import_from_project("/path/to/project")
        await sync.export_to_claude_md("/path/to/project", memories)
    """

    MEMORY_FILE_PATTERNS = {
        MemoryFileType.CLAUDE_MD: ["CLAUDE.md", "claude.md"],
        MemoryFileType.CLAUDE_SETTINGS: [".claude/settings.json"],
        MemoryFileType.CURSOR_RULES: [".cursorrules"],
        MemoryFileType.CURSOR_RULE_DIR: [".cursor/rules/*.mdc", ".cursor/rules/*.md"],
    }

    def __init__(self, memory_system):
        self.memory_system = memory_system

    async def import_from_project(
        self,
        project_path: str | Path,
        file_types: list[MemoryFileType] | None = None,
        user_id: str | None = None,
        tenant_id: str | None = None,
    ) -> int:
        """
        Import memories from project memory files.

        Args:
            project_path: Path to the project directory
            file_types: Which file types to import (default: all)
            user_id: User ID for the memories
            tenant_id: Tenant ID for multi-tenancy

        Returns:
            Number of memories imported
        """
        project_path = Path(project_path)
        file_types = file_types or list(MemoryFileType)
        total_imported = 0

        for file_type in file_types:
            patterns = self.MEMORY_FILE_PATTERNS.get(file_type, [])

            for pattern in patterns:
                if "*" in pattern:
                    # Glob pattern
                    files = list(project_path.glob(pattern))
                else:
                    # Exact file
                    file_path = project_path / pattern
                    files = [file_path] if file_path.exists() else []

                for file_path in files:
                    if not file_path.exists():
                        continue

                    imported = await self._import_file(
                        file_path, file_type, project_path, user_id, tenant_id
                    )
                    total_imported += imported

        return total_imported

    async def _import_file(
        self,
        file_path: Path,
        file_type: MemoryFileType,
        project_path: Path,
        user_id: str | None,
        tenant_id: str | None,
    ) -> int:
        """Import a single memory file."""
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception as e:
            console.print(f"[yellow]Warning: Could not read {file_path}: {e}[/yellow]")
            return 0

        # Create appropriate parser
        if file_type == MemoryFileType.CLAUDE_MD:
            parser = ClaudeMDFile(path=file_path, content=content)
        elif file_type == MemoryFileType.CLAUDE_SETTINGS:
            parser = ClaudeSettingsFile(path=file_path, content=content)
        elif file_type == MemoryFileType.CURSOR_RULES:
            parser = CursorRulesFile(path=file_path, content=content)
        else:
            return 0

        # Convert to memories
        memory_entries = parser.to_memories()

        # Store in Weaviate
        for entry in memory_entries:
            await self.memory_system.add(
                content=entry["content"],
                tier=1,  # Project tier
                memory_type=entry.get("memory_type", "fact"),
                source=entry.get("source", "file"),
                project_id=str(project_path),
                user_id=user_id,
                tenant_id=tenant_id,
                metadata=entry.get("metadata", {}),
                importance=0.7,  # Memory files are usually important
            )

        console.print(
            f"[green]✓ Imported {len(memory_entries)} memories from {file_path.name}[/green]"
        )
        return len(memory_entries)

    async def export_to_claude_md(
        self,
        project_path: str | Path,
        memories: list[dict[str, Any]],
        output_path: str | Path | None = None,
    ) -> Path:
        """
        Export memories to CLAUDE.md format.

        Args:
            project_path: Path to the project
            memories: List of memory entries to export
            output_path: Custom output path (default: project/CLAUDE.md)

        Returns:
            Path to the created file
        """
        project_path = Path(project_path)
        output_path = Path(output_path) if output_path else project_path / "CLAUDE.md"

        # Build CLAUDE.md content
        sections = {}

        for memory in memories:
            memory_type = memory.get("memory_type", "general")
            section = self._get_section_for_type(memory_type)

            if section not in sections:
                sections[section] = []

            sections[section].append(memory["content"])

        # Generate markdown
        lines = [
            "# Project Memory",
            "",
            "> Auto-generated from AI Memory System",
            "",
        ]

        for section, contents in sections.items():
            lines.append(f"## {section}")
            lines.append("")
            for content in contents:
                lines.append(content)
                lines.append("")
            lines.append("---")
            lines.append("")

        # Write file
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("\n".join(lines), encoding="utf-8")

        console.print(f"[green]✓ Exported {len(memories)} memories to {output_path}[/green]")
        return output_path

    def _get_section_for_type(self, memory_type: str) -> str:
        """Map memory type to CLAUDE.md section."""
        mapping = {
            "code": "Code Patterns",
            "workflow": "Workflows & Processes",
            "preference": "Preferences",
            "insight": "Key Insights",
            "error_solution": "Solutions & Fixes",
            "document": "Documentation",
            "fact": "Important Facts",
            "conversation": "Conversations",
        }
        return mapping.get(memory_type, "General Knowledge")

    async def export_to_cursorrules(
        self,
        project_path: str | Path,
        memories: list[dict[str, Any]],
        output_path: str | Path | None = None,
    ) -> Path:
        """
        Export memories to .cursorrules format.

        Args:
            project_path: Path to the project
            memories: List of memory entries to export
            output_path: Custom output path (default: project/.cursorrules)

        Returns:
            Path to the created file
        """
        project_path = Path(project_path)
        output_path = Path(output_path) if output_path else project_path / ".cursorrules"

        # Build .cursorrules content
        lines = [
            "# Cursor Rules",
            "# Auto-generated from AI Memory System",
            "",
        ]

        for i, memory in enumerate(memories, 1):
            content = memory["content"]
            memory_type = memory.get("memory_type", "rule")

            lines.append(f"# Rule {i}: {memory_type.replace('_', ' ').title()}")
            lines.append(content)
            lines.append("")
            lines.append("---")
            lines.append("")

        # Write file
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("\n".join(lines), encoding="utf-8")

        console.print(f"[green]✓ Exported {len(memories)} memories to {output_path}[/green]")
        return output_path


def scan_project_for_memory_files(project_path: str | Path) -> dict[str, list[Path]]:
    """
    Scan a project for all supported memory files.

    Returns:
        Dict mapping file type to list of found files
    """
    project_path = Path(project_path)
    found_files: dict[str, list[Path]] = {
        "claude_md": [],
        "claude_settings": [],
        "cursor_rules": [],
        "cursor_rule_files": [],
    }

    # Check for CLAUDE.md
    for name in ["CLAUDE.md", "claude.md"]:
        claude_md = project_path / name
        if claude_md.exists():
            found_files["claude_md"].append(claude_md)

    # Check for .claude/settings.json
    settings = project_path / ".claude" / "settings.json"
    if settings.exists():
        found_files["claude_settings"].append(settings)

    # Check for .cursorrules
    cursorrules = project_path / ".cursorrules"
    if cursorrules.exists():
        found_files["cursor_rules"].append(cursorrules)

    # Check for .cursor/rules/*.mdc or *.md
    cursor_rules_dir = project_path / ".cursor" / "rules"
    if cursor_rules_dir.exists():
        for pattern in ["*.mdc", "*.md"]:
            found_files["cursor_rule_files"].extend(cursor_rules_dir.glob(pattern))

    return found_files
