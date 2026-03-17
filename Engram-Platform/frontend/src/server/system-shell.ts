export async function execShell(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; maxBuffer?: number },
) {
  const { execFile } = await import('node:child_process/promises');
  return execFile(command, args, options);
}
