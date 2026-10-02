import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultModel, defaultProjectsDir, gatewayEnv, hasGateway, hasPartialGateway } from './config.ts';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cubefarm-config-'));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('defaultProjectsDir', () => {
  it('is the folder a checkout sits in', () => {
    expect(defaultProjectsDir(path.join(tmp, 'Projects', 'cubefarm'), tmp)).toBe(path.join(tmp, 'Projects'));
  });

  it('is a projects folder in your home when installed from npm', () => {
    const installed = path.join(tmp, 'npm', 'node_modules', 'cubefarm');
    expect(defaultProjectsDir(installed, tmp)).toBe(path.join(tmp, 'Projects'));
    fs.mkdirSync(path.join(tmp, 'code'));
    expect(defaultProjectsDir(installed, tmp)).toBe(path.join(tmp, 'code'));
  });
});

describe('gateway', () => {
  const VARS = ['SWARM_ANTHROPIC_BASE_URL', 'SWARM_ANTHROPIC_AUTH_TOKEN', 'SWARM_ANTHROPIC_DEFAULT_SONNET_MODEL', 'SWARM_ANTHROPIC_DEFAULT_HAIKU_MODEL', 'SWARM_ANTHROPIC_DEFAULT_OPUS_MODEL', 'SWARM_DEFAULT_MODEL'];
  const saved = Object.fromEntries(VARS.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  const clear = () => VARS.forEach((k) => delete process.env[k]);

  it('is off without the pair, so agents keep the subscription login', () => {
    clear();
    expect(hasGateway()).toBe(false);
    expect(hasPartialGateway()).toBe(false);
    expect(gatewayEnv()).toEqual({});
  });

  it('needs both halves of the pair', () => {
    clear();
    process.env.SWARM_ANTHROPIC_BASE_URL = 'http://vps:3456';
    expect(hasGateway()).toBe(false);
    expect(hasPartialGateway()).toBe(true);
    expect(gatewayEnv()).toEqual({});
  });

  it('points agents at the endpoint with the gateway aliases', () => {
    clear();
    process.env.SWARM_ANTHROPIC_BASE_URL = 'http://vps:3456';
    process.env.SWARM_ANTHROPIC_AUTH_TOKEN = 'sk-test';
    expect(hasGateway()).toBe(true);
    expect(hasPartialGateway()).toBe(false);
    expect(gatewayEnv()).toMatchObject({
      ANTHROPIC_BASE_URL: 'http://vps:3456',
      ANTHROPIC_AUTH_TOKEN: 'sk-test',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet',
      CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT: '1',
    });
  });

  it('lets SWARM_DEFAULT_MODEL override the built-in model', () => {
    clear();
    expect(defaultModel()).toBe('claude-opus-5-5');
    process.env.SWARM_DEFAULT_MODEL = 'claude-sonnet';
    expect(defaultModel()).toBe('claude-sonnet');
  });
});
