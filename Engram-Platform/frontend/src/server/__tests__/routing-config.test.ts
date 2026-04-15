// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../../../../');
const platformRoot = path.join(repoRoot, 'Engram-Platform');
const landingRoot = path.join(
  repoRoot,
  'Engram-AiMemory',
  '04_branding',
  'MarketingDev',
  'engram-landing',
);

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readLanding(relativePath: string) {
  return readFileSync(path.join(landingRoot, relativePath), 'utf8');
}

describe('deployment routing config', () => {
  it('defines a dedicated landing service in docker compose', () => {
    const compose = read('Engram-Platform/docker-compose.yml');

    expect(compose).toMatch(/\n {2}engram-landing:\n/);
    expect(compose).toContain('Engram-AiMemory/04_branding/MarketingDev/engram-landing/Dockerfile');
  });

  it('splits the memory host between marketing, platform dashboard, and isolated landing assets', () => {
    const nginx = read('Engram-Platform/nginx/nginx.conf');
    const memoryHost = nginx.match(
      /server \{[\s\S]*?server_name memory\.velocitydigi\.com[\s\S]*?\n\}\n/,
    )?.[0];

    expect(memoryHost).toBeTruthy();
    expect(memoryHost).toContain('location ^~ /dashboard/');
    expect(memoryHost).toContain('location = /dashboard');
    expect(memoryHost).toContain('location ^~ /_next/');
    expect(memoryHost).toContain('location ^~ /marketing-static/');
    expect(memoryHost).toContain('proxy_pass http://platform_frontend');
    expect(memoryHost).toContain('proxy_pass http://engram_landing');
  });

  it('keeps landing assets off the shared /_next path and serves it as a static site', () => {
    const nextConfig = readLanding('next.config.ts');
    const dockerfile = readLanding('Dockerfile');

    expect(nextConfig).toMatch(/assetPrefix:\s*['"]\/marketing-static['"]/);
    expect(nextConfig).toMatch(/output:\s*['"]export['"]/);
    expect(dockerfile).toContain('COPY --from=builder /app/out');
    expect(dockerfile).not.toContain('next start');
  });

  it('sends dashboard CTAs to /dashboard instead of back to the landing root', () => {
    const navigation = readLanding('app/components/Navigation.tsx');
    const hero = readLanding('app/components/Hero.tsx');
    const home = readLanding('app/page.tsx');

    expect(navigation).toContain('href="/dashboard"');
    expect(navigation).not.toContain("href: 'https://memory.velocitydigi.com'");
    expect(hero).toContain('href="/dashboard"');
    expect(home).toContain('href="/dashboard"');
  });

  it('includes the missing marketing routes needed for the revised navigation flow', () => {
    expect(existsSync(path.join(landingRoot, 'app', 'solutions', 'page.tsx'))).toBe(true);
    expect(existsSync(path.join(landingRoot, 'app', 'security', 'page.tsx'))).toBe(true);
    expect(existsSync(path.join(landingRoot, 'app', 'contact', 'page.tsx'))).toBe(true);
  });

  it('keeps platform operations aware of the landing service', () => {
    const systemAdmin = read('Engram-Platform/frontend/src/server/system-admin.ts');

    expect(systemAdmin).toContain("'engram-landing'");
  });

  it('reads files from the expected monorepo roots', () => {
    expect(existsSync(path.join(platformRoot, 'docker-compose.yml'))).toBe(true);
    expect(existsSync(path.join(landingRoot, 'app', 'page.tsx'))).toBe(true);
  });
});
