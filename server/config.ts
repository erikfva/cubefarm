import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A .env in the working folder fills in SWARM_* variables for local runs (real environment wins).
// Optional: no file is fine. SWARM_ENV_FILE points at another file.
try {
  process.loadEnvFile(process.env.SWARM_ENV_FILE ?? path.join(process.cwd(), '.env'));
} catch {
  // no .env: the environment alone is enough
}

export const PORT = Number(process.env.SWARM_PORT ?? 4317);
// package.json sits one folder up both from server/ and from the published dist-server/.
export const VERSION: string = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'package.json'), 'utf8')).version;

// Everything the swarm writes lives outside this project so that agents working in
// cloned repos never pick up this project's CLAUDE.md or settings by walking up the tree.
export const HOME_DIR = process.env.SWARM_HOME ?? path.join(os.homedir(), '.cubefarm');
export const WORKSPACE_ROOT = path.join(HOME_DIR, 'workspaces');
export const DEMO = process.argv.includes('--demo') || process.env.SWARM_DEMO === '1' || process.env.SWARM_DEMO === 'true';
export const STATE_FILE = path.join(HOME_DIR, DEMO ? 'demo-state.json' : 'state.json');

// A custom Anthropic-compatible endpoint for agents (e.g. a LiteLLM gateway on a VPS), instead of the Claude
// subscription login. Set SWARM_ANTHROPIC_BASE_URL + SWARM_ANTHROPIC_AUTH_TOKEN before starting the office; see
// docs/how-it-works.md ("Models and usage"). Unset: agents run on the subscription, as before. Read per call (not
// once at import) so tests can set and clear them.
const swarmVar = (name: string) => (process.env[name] ?? '').trim();
export const hasGateway = () => swarmVar('SWARM_ANTHROPIC_BASE_URL') !== '' && swarmVar('SWARM_ANTHROPIC_AUTH_TOKEN') !== '';
/** Half of a gateway pair without the other: a setup mistake worth warning about at startup. */
export const hasPartialGateway = () => !hasGateway() && (swarmVar('SWARM_ANTHROPIC_BASE_URL') !== '' || swarmVar('SWARM_ANTHROPIC_AUTH_TOKEN') !== '');

/**
 * Env vars injected into every agent's Claude Code after the office strips inherited ANTHROPIC_* / CLAUDE_*, so the
 * agent talks to the gateway instead of the subscription. Empty when no gateway is configured.
 */
export function gatewayEnv(): Record<string, string> {
  if (!hasGateway()) return {};
  return {
    ANTHROPIC_BASE_URL: swarmVar('SWARM_ANTHROPIC_BASE_URL'),
    ANTHROPIC_AUTH_TOKEN: swarmVar('SWARM_ANTHROPIC_AUTH_TOKEN'),
    ANTHROPIC_DEFAULT_SONNET_MODEL: swarmVar('SWARM_ANTHROPIC_DEFAULT_SONNET_MODEL') || 'claude-sonnet',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: swarmVar('SWARM_ANTHROPIC_DEFAULT_HAIKU_MODEL') || 'claude-haiku',
    ANTHROPIC_DEFAULT_OPUS_MODEL: swarmVar('SWARM_ANTHROPIC_DEFAULT_OPUS_MODEL') || 'claude-opus',
    // Gateway aliases aren't real Claude models, so there's no fixed context window to declare client-side.
    CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT: '1',
  };
}

/** The model agents ask for. SWARM_DEFAULT_MODEL overrides the built-in default (it must exist on the gateway). */
export const defaultModel = () => swarmVar('SWARM_DEFAULT_MODEL') || 'claude-opus-5-5';

// How often each connected repo's issues and PRs are refreshed from GitHub.
export const SYNC_INTERVAL_MS = 45_000;
// How often idle agents on auto-assign floors look for new work.
export const SCHEDULER_INTERVAL_MS = 8_000;
// Terminal lines kept per agent.
export const LOG_BUFFER = 600;

/**
 * Where new projects go unless the manager picks another folder. Run from a checkout, that's the folder the app sits
 * in (C:\Projects\cubefarm → C:\Projects). Installed from npm the app lives in node_modules, so it's the usual
 * projects folder in your home instead.
 */
export function defaultProjectsDir(appDir: string, home = os.homedir()): string {
  if (!appDir.split(/[\\/]/).includes('node_modules')) return path.resolve(appDir, '..');
  const names = ['Projects', 'projects', 'code', 'Code', 'dev', 'Developer', 'src', 'repos', 'git', 'GitHub'];
  return names.map((n) => path.join(home, n)).find((d) => fs.existsSync(d)) ?? path.join(home, 'Projects');
}
