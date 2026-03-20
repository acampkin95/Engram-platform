import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

export async function execShell(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; maxBuffer?: number },
) {
  return execFile(command, args, options);
}
