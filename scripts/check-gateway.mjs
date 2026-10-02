// Validates the LiteLLM gateway cubefarm agents use (SWARM_ANTHROPIC_* in .env):
// sends one tiny Anthropic-style message through claude-code-router and prints the reply.
// Real environment wins over .env; exit 0 on a reply, 1 on a gateway error, 2 when unconfigured.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.loadEnvFile(process.env.SWARM_ENV_FILE ?? path.join(process.cwd(), '.env'));
  } catch {
    // no .env: the environment alone is enough
  }
}

/** The router's /v1/messages endpoint, whatever shape SWARM_ANTHROPIC_BASE_URL has. */
export function messagesUrl(base) {
  const b = base.replace(/\/+$/, '');
  if (b.endsWith('/v1/messages')) return b;
  if (b.endsWith('/v1')) return `${b}/messages`;
  return `${b}/v1/messages`;
}

/** The text of an Anthropic Messages reply, or '' when it has none. */
export function replyText(json) {
  if (!json || !Array.isArray(json.content)) return '';
  return json.content
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}

/** Sends one tiny prompt through the router; returns { ok, status, text, secs, raw } for tests. */
export async function checkGateway({ base, token, model }) {
  const url = messagesUrl(base);
  const started = Date.now();
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with exactly: ok' }], max_tokens: 50, temperature: 0 }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    return { ok: false, status: 0, text: '', secs: (Date.now() - started) / 1000, error: err.cause?.message ?? err.message };
  }
  const body = await res.text();
  let text = '';
  try {
    text = replyText(JSON.parse(body));
  } catch {
    // not JSON: reported raw below
  }
  return { ok: res.ok, status: res.status, text: text.slice(0, 200), secs: (Date.now() - started) / 1000, raw: body.slice(0, 500) };
}

if (isMain) {
  const base = (process.env.SWARM_ANTHROPIC_BASE_URL ?? '').trim();
  const token = (process.env.SWARM_ANTHROPIC_AUTH_TOKEN ?? '').trim();
  const model = (process.env.SWARM_DEFAULT_MODEL ?? '').trim() || 'claude-sonnet';

  if (!base || !token) {
    console.error('Set both SWARM_ANTHROPIC_BASE_URL and SWARM_ANTHROPIC_AUTH_TOKEN (in .env or the environment).');
    process.exit(2);
  }

  console.log(`Checking ${messagesUrl(base)} with model ${model}…`);
  const r = await checkGateway({ base, token, model });
  if (!r.ok && r.status === 0) {
    console.error(`No reply in ${r.secs.toFixed(1)}s: ${r.error}`);
    console.error('Is the tunnel/VPS reachable from here, and is the stack up (`./stack up`)?');
    process.exit(1);
  }
  if (!r.ok) {
    console.error(`HTTP ${r.status} in ${r.secs.toFixed(1)}s: ${r.raw}`);
    process.exit(1);
  }
  console.log(`OK in ${r.secs.toFixed(1)}s: ${JSON.stringify(r.text)}`);
}
