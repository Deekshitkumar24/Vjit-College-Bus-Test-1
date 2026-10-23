import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawnSync, execSync } from 'child_process';

// Usage: pnpm evidence -- <ID> -- <command...>
// e.g.: pnpm evidence -- P0-T1 -- turbo run lint
// Or tsx scripts/evidence/run.ts <ID> -- <command...>

function parseArgs(): { id: string; command: string; commandArgs: string[] } {
  const rawArgs = process.argv.slice(2);
  const filtered = rawArgs.filter((arg) => arg !== '--');

  if (filtered.length < 2) {
    console.error('Usage: pnpm evidence -- <ID> -- <command...>');
    process.exit(1);
  }

  const id = filtered[0];
  const command = filtered[1];
  const commandArgs = filtered.slice(2);

  return { id, command, commandArgs };
}

function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

function main() {
  const { id, command, commandArgs } = parseArgs();
  const evidenceDir = path.resolve('docs/progress/evidence');
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const fullCommandLine = [command, ...commandArgs].join(' ');
  const gitSha = getGitSha();
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  console.log(`[EVIDENCE RUNNER] ID: ${id}`);
  console.log(`[EVIDENCE RUNNER] Git SHA: ${gitSha}`);
  console.log(`[EVIDENCE RUNNER] Command: ${fullCommandLine}`);
  console.log(`----------------------------------------------------------------`);

  const isWindows = process.platform === 'win32';
  const child = spawnSync(fullCommandLine, {
    shell: true,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  const durationMs = Date.now() - startMs;
  const endTime = new Date().toISOString();
  const exitCode = child.status ?? (child.error ? 1 : 0);

  const stdout = child.stdout || '';
  const stderr = child.stderr || '';
  const combinedOutput = stdout + (stderr ? (stdout ? '\n' : '') + stderr : '');

  // Print output to console
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  const logPath = path.join(evidenceDir, `${id}.log`);
  const jsonPath = path.join(evidenceDir, `${id}.json`);

  fs.writeFileSync(logPath, combinedOutput, 'utf-8');

  const evidenceRecord = {
    id,
    command: fullCommandLine,
    gitSha,
    startTime,
    endTime,
    durationMs,
    exitCode,
    stdoutSha256: sha256(stdout),
    stderrSha256: sha256(stderr),
    outputSha256: sha256(combinedOutput),
  };

  fs.writeFileSync(jsonPath, JSON.stringify(evidenceRecord, null, 2), 'utf-8');

  console.log(`----------------------------------------------------------------`);
  console.log(`[EVIDENCE RUNNER] Finished in ${durationMs}ms with exit code ${exitCode}`);
  console.log(`[EVIDENCE RUNNER] Saved log: ${logPath}`);
  console.log(`[EVIDENCE RUNNER] Saved json: ${jsonPath}`);

  process.exit(exitCode);
}

main();
