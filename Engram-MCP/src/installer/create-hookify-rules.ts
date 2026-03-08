import { access, copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve package root from compiled dist/installer/ location
// dist/installer/<file>.js → ../../ → project root
const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Copy all hookify rule files from the package's hookify/ directory
 * into the target .claude/ directory.
 *
 * @param targetDir - Absolute path to the .claude/ directory in the project
 * @returns List of copied file names
 */
export async function createHookifyRules(targetDir: string): Promise<string[]> {
	const sourceDir = join(PACKAGE_ROOT, "hookify");

	// Ensure target directory exists
	await mkdir(targetDir, { recursive: true });

	// Get all .md files from hookify/
	const entries = await readdir(sourceDir, { withFileTypes: true });
	const mdFiles = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => entry.name);

	// Copy each file to the target directory
	const copied: string[] = [];
	for (const fileName of mdFiles) {
		const src = join(sourceDir, fileName);
		const dest = join(targetDir, fileName);
		// Skip if destination already exists to avoid overwriting user customisations
		try {
			await access(dest);
			continue; // file exists - skip
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code !== "ENOENT") throw err;
			// file does not exist - safe to copy
		}
		await copyFile(src, dest);
		copied.push(fileName);
	}

	return copied;
}
