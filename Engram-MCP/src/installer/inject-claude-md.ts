import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve package root from compiled dist/installer/ location
const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Marker that indicates the memory block has already been injected */
const MARKER = "<!-- AI-MEMORY:START -->";

/**
 * Inject the Engram memory instructions block into a project's CLAUDE.md.
 *
 * @param projectDir - Directory to look for / create CLAUDE.md
 * @returns "created" | "updated" | "skipped"
 */
export async function injectClaudeMd(
	projectDir: string,
): Promise<"created" | "updated" | "skipped"> {
	// Load template content from package
	const templatePath = join(PACKAGE_ROOT, "templates", "claude-md-block.md");
	const templateContent = await readFile(templatePath, "utf-8");

	const claudeMdPath = join(projectDir, "CLAUDE.md");

	// Try to read existing CLAUDE.md
	let existingContent: string | null = null;
	try {
		existingContent = await readFile(claudeMdPath, "utf-8");
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code !== "ENOENT") throw err;
		// File does not exist — will create it
	}

	if (existingContent === null) {
		// Create new file with template content
		await writeFile(claudeMdPath, templateContent, "utf-8");
		return "created";
	}

	if (existingContent.includes(MARKER)) {
		// Memory block already present — skip to avoid duplication
		return "skipped";
	}

	// Append template to existing file
	await writeFile(claudeMdPath, `${existingContent}\n\n${templateContent}`, "utf-8");
	return "updated";
}
