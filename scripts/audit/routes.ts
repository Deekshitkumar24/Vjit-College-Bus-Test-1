import * as fs from 'fs';
import * as path from 'path';

export interface RouteInventoryItem {
  method: string;
  path: string;
  isPublic: boolean;
  roles: string[];
  hasIdentifier: boolean;
  identifierParam?: string;
  file: string;
  handler: string;
}

const GLOBAL_PREFIX = '/api/v1';

function findRepoRoot(): string {
  let cur = process.cwd();
  while (cur) {
    if (fs.existsSync(path.join(cur, 'pnpm-workspace.yaml'))) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return process.cwd();
}

export function extractRoutes(): RouteInventoryItem[] {
  const repoRoot = findRepoRoot();
  const controllersDir = path.resolve(repoRoot, 'services/api/src/modules');
  const routes: RouteInventoryItem[] = [];

  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.controller.ts')) {
        parseController(fullPath);
      }
    }
  }

  function parseController(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);

    // Split by @Controller
    const classBlocks = content.split(/@Controller\(\s*(?:['"]([^'"]*)['"])?\s*\)/);
    let i = 1;
    while (i < classBlocks.length) {
      const basePrefix = (classBlocks[i] || '').trim().replace(/^\/|\/$/g, '');
      const body = classBlocks[i + 1] || '';

      const methodRegex =
        /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"]([^'"]*)['"])?\s*\)([\s\S]*?)(?:async\s+)?([a-zA-Z0-9_]+)\s*\(/g;
      let match;

      while ((match = methodRegex.exec(body)) !== null) {
        const httpMethod = match[1].toUpperCase();
        const subPath = (match[2] || '').trim().replace(/^\/|\/$/g, '');
        const decoratorsBlock = match[3];
        const handlerName = match[4];

        let fullPath = GLOBAL_PREFIX;
        if (basePrefix) fullPath += `/${basePrefix}`;
        if (subPath) fullPath += `/${subPath}`;
        fullPath = fullPath.replace(/\/+/g, '/');

        const isPublic =
          decoratorsBlock.includes('@Public(') ||
          fullPath.includes('/health') ||
          fullPath.includes('/telemetry') ||
          fullPath.includes('/heartbeat') ||
          fullPath.includes('/events') ||
          fullPath === '/api/v1/auth/sso/start' ||
          fullPath === '/api/v1/auth/sso/callback' ||
          fullPath === '/api/v1/auth/otp/request' ||
          fullPath === '/api/v1/auth/otp/verify' ||
          fullPath === '/api/v1/auth/refresh';

        const rolesMatch = decoratorsBlock.match(/@Roles\(([^)]+)\)/);
        let roles: string[] = [];
        if (rolesMatch) {
          roles = rolesMatch[1]
            .split(',')
            .map((r) => r.trim().replace(/['"]/g, ''))
            .filter(Boolean);
        } else if (!isPublic) {
          if (basePrefix === 'driver') {
            roles = ['DRV'];
          } else if (basePrefix === 'shifts') {
            roles = ['DRV'];
          } else if (fullPath.includes('/snapshot')) {
            roles = ['STU', 'FAC', 'DRV', 'SEC', 'COR', 'TEC', 'MGT', 'SAD'];
          }
        }

        const paramMatch = fullPath.match(/:([a-zA-Z0-9_]+)/);
        const hasIdentifier = Boolean(paramMatch);
        const identifierParam = paramMatch ? paramMatch[1] : undefined;

        routes.push({
          method: httpMethod,
          path: fullPath,
          isPublic,
          roles,
          hasIdentifier,
          identifierParam,
          file: fileName,
          handler: handlerName,
        });
      }
      i += 2;
    }
  }

  scanDir(controllersDir);

  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

if (process.argv[1] && process.argv[1].endsWith('routes.ts')) {
  const routes = extractRoutes();
  console.log(`Discovered ${routes.length} routes from NestJS controllers:\n`);
  for (const r of routes) {
    const authDesc = r.isPublic ? '@Public()' : `@Roles(${r.roles.join(', ') || 'AUTHENTICATED'})`;
    const idDesc = r.hasIdentifier ? `[ID: :${r.identifierParam}]` : '';
    console.log(`  ${r.method.padEnd(6)} ${r.path.padEnd(42)} ${authDesc.padEnd(30)} ${idDesc}`);
  }

  const idorRoutes = routes.filter((r) => r.hasIdentifier);
  console.log(`\nTotal Routes with Identifier: ${idorRoutes.length}`);
}
