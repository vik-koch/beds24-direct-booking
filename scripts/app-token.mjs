#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const origin = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' });
export const repo = origin.match(/github\.com[:/](.+?)(\.git)?\s*$/)[1];

export async function appToken(appId, keyPath) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (part) => Buffer.from(JSON.stringify(part)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 540, iss: appId })}`;
  const jwt = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(readFileSync(keyPath), 'base64url')}`;
  const call = async (path, method) => {
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: { authorization: `Bearer ${jwt}` },
    });
    if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
    return response.json();
  };
  const installation = await call(`/repos/${repo}/installation`, 'GET');
  return (await call(`/app/installations/${installation.id}/access_tokens`, 'POST')).token;
}

if (import.meta.main)
  console.log(await appToken(process.env.DEVELOPER_APP_ID, process.env.DEVELOPER_APP_KEY));
