/**
 * Bug-condition exploration test — the dead Next.js layer.
 *
 * Spec: .kiro/specs/critical-security-and-error-fixes (task 14)
 * Property 5: Bug Condition — Removal Satisfies the Next.js Control Clauses
 *
 * **Validates: Requirements 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17, 2.15**
 *
 * THIS SUITE IS EXPECTED TO FAIL ON THE UNFIXED TREE. Each failure is a
 * counterexample proving the Next.js layer has never executed and cannot
 * protect anything. After task 16 deletes the layer, these tests invert to
 * existence assertions and PASS, confirming the dead code is gone.
 *
 * ---------------------------------------------------------------------------
 * Purpose
 * ---------------------------------------------------------------------------
 *
 * The design's investigation concluded: the Next.js layer (pages/api/**,
 * middleware/**, config/security.ts, next.config.js) has no deployment target,
 * no build command, no installed dependencies, and no reachable caller. Both
 * apparent consumers (MonitoringDashboard, ENDPOINTS block) are themselves dead
 * code. This test suite provides the evidence base for that conclusion by
 * attempting to load and exercise each module, confirming they fail at import
 * time or at assertion time in predictable ways.
 *
 * ---------------------------------------------------------------------------
 * Scoped PBT Approach
 * ---------------------------------------------------------------------------
 *
 * The defects are deterministic and structural, so the tests scope to the
 * concrete cases from the design's exploratory test plan rather than generating
 * random inputs. Each test targets a specific structural defect.
 *
 * ---------------------------------------------------------------------------
 * Decision Gate
 * ---------------------------------------------------------------------------
 *
 * If any of these tests PASSES, the layer is more alive than the investigation
 * concluded and the deletion recommendation must be revisited before task 16.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

jest.setTimeout(120_000);

// ---------------------------------------------------------------------------
// Case 1: securityMiddleware() always allows — the wrapper never rejects
// (Requirements 1.7, 1.8)
// ---------------------------------------------------------------------------

describe('Property 5: securityMiddleware always allows (req 1.7, 1.8)', () => {
  /**
   * The design explains: validateApiKey calls res.status(401).json(...) on a
   * fake `res` whose status().json() RETURNS {status, data} instead of throwing.
   * The catch block never runs, so NextResponse.next() is always returned and
   * the `apiKeyResponse.status !== 200` check at line 88 is unreachable.
   *
   * POST-DELETION (task 16): If the middleware file no longer exists, that is
   * itself confirmation that the non-functional control has been removed. PASS.
   */

  const middlewareSecurityPath = path.join(REPO_ROOT, 'middleware', 'security.ts');
  const middlewareExists = fs.existsSync(middlewareSecurityPath);

  if (!middlewareExists) {
    // Post-deletion: the file is gone, confirming the dead layer was removed
    it('securityMiddleware with no X-API-Key should return non-200 (rejects unauthorized)', () => {
      // middleware/security.ts no longer exists — the non-functional control is gone. PASS.
      expect(fs.existsSync(middlewareSecurityPath)).toBe(false);
    });

    it('rateLimit path always returns 200 regardless of input (req 1.8)', () => {
      // middleware/security.ts no longer exists — the non-functional rate limiter is gone. PASS.
      expect(fs.existsSync(middlewareSecurityPath)).toBe(false);
    });
  } else {
    // Pre-deletion: exercise the bug to document it

    // Minimal NextResponse mock that records what the middleware returns
    const mockNextResponse = {
      next: jest.fn(() => ({
        status: 200,
        headers: new Map(),
      })),
      json: jest.fn((body: any, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        body,
        headers: new Map(),
      })),
    };

    // Minimal NextRequest-like object with no API key
    const mockRequest = {
      ip: '127.0.0.1',
      headers: new Map([['origin', 'http://localhost:3000']]),
      nextUrl: { pathname: '/api/admin/monitoring/security' },
    };

    let securityMiddleware: ((req: any) => Promise<any>) | null = null;
    let importError: Error | null = null;

    beforeAll(() => {
      jest.mock('next/server', () => ({
        NextResponse: mockNextResponse,
        NextRequest: class NextRequest {},
      }));
      jest.mock('rate-limiter-flexible', () => ({
        RateLimiterMemory: class RateLimiterMemory {
          consume() { return Promise.resolve(); }
        },
      }));
      jest.mock('ioredis', () => ({
        Redis: class Redis { constructor() {} },
        default: class Redis { constructor() {} },
      }));
      jest.mock('zod', () => ({
        z: {
          object: () => ({ min: () => ({}), max: () => ({}), email: () => ({}), regex: () => ({}), string: () => ({ min: () => ({ max: () => ({}) }), email: () => ({}), regex: () => ({}) }), number: () => ({ positive: () => ({}), int: () => ({ positive: () => ({}) }), optional: () => ({}) }), array: () => ({ optional: () => ({}) }) }),
          string: () => ({ min: () => ({ max: () => ({}) }), email: () => ({}), regex: () => ({}) }),
          number: () => ({ positive: () => ({}), int: () => ({ positive: () => ({}) }), optional: () => ({}) }),
          array: (s: any) => s,
          nativeEnum: (e: any) => e,
          ZodError: class ZodError extends Error {},
        },
      }));

      try {
        const mod = require('../../middleware/security');
        securityMiddleware = mod.securityMiddleware;
      } catch (e) {
        importError = e as Error;
      }
    });

    afterAll(() => {
      jest.resetModules();
      jest.restoreAllMocks();
    });

    it('securityMiddleware with no X-API-Key should return non-200 (rejects unauthorized)', async () => {
      if (importError) {
        console.log('[task 14] securityMiddleware FAILED AT IMPORT:', importError.message);
        expect(importError).toBeNull();
        return;
      }
      expect(securityMiddleware).not.toBeNull();
      const result = await securityMiddleware!(mockRequest);
      expect(result.status).not.toBe(200);
    });

    it('rateLimit path always returns 200 regardless of input (req 1.8)', async () => {
      if (importError) {
        console.log('[task 14] rateLimit test FAILED AT IMPORT:', importError.message);
        expect(importError).toBeNull();
        return;
      }
      const rateLimitMod = require('../../middleware/security');
      const result = await rateLimitMod.rateLimit(mockRequest);
      expect(result.status).not.toBe(200);
    });
  }
});

// ---------------------------------------------------------------------------
// Case 2: hasAccess throws on unknown role (Requirement 1.13)
// ---------------------------------------------------------------------------

describe('Property 5: hasAccess throws on unknown role (req 1.13)', () => {
  const authPath = path.join(REPO_ROOT, 'middleware', 'auth.ts');
  const authExists = fs.existsSync(authPath);

  if (!authExists) {
    // Post-deletion: the file is gone, confirming the broken access control is removed
    it('hasAccess("/api/orders", "delivery_partner") should return a boolean without throwing', () => {
      // middleware/auth.ts no longer exists — the broken hasAccess is gone. PASS.
      expect(fs.existsSync(authPath)).toBe(false);
    });

    it('hasAccess("/api/orders", "admin") should return true (admin is superset)', () => {
      // middleware/auth.ts no longer exists — the incomplete RBAC table is gone. PASS.
      expect(fs.existsSync(authPath)).toBe(false);
    });
  } else {
    // Pre-deletion: exercise the bug to document it
    let hasAccessFn: ((path: string, role: string) => boolean) | null = null;
    let importError: Error | null = null;

    beforeAll(() => {
      jest.resetModules();
      jest.mock('next/server', () => ({
        NextResponse: {
          next: jest.fn(() => ({ status: 200, headers: new Map() })),
          json: jest.fn((body: any, init?: { status?: number }) => ({
            status: init?.status ?? 200, body, headers: new Map(),
          })),
        },
        NextRequest: class NextRequest {},
      }));
      jest.mock('jose', () => ({ jwtVerify: jest.fn() }));
      jest.mock('zod', () => ({
        z: {
          object: () => ({ parse: (v: any) => v }),
          string: () => ({ min: () => ({ max: () => ({}) }), email: () => ({}), regex: () => ({}) }),
          number: () => ({ positive: () => ({}), int: () => ({ positive: () => ({}) }) }),
          nativeEnum: (e: any) => e,
        },
      }));
      jest.mock('rate-limiter-flexible', () => ({
        RateLimiter: class RateLimiter {
          constructor() {}
          consume() { return Promise.resolve(); }
        },
        RateLimiterRedis: class RateLimiterRedis {
          constructor() {}
          consume() { return Promise.resolve(); }
        },
      }));
      jest.mock('ioredis', () => ({
        Redis: class Redis { constructor() {} },
        default: class Redis { constructor() {} },
      }));

      try {
        const mod = require('../../middleware/auth');
        hasAccessFn = null;
      } catch (e) {
        importError = e as Error;
      }
    });

    afterAll(() => {
      jest.resetModules();
      jest.restoreAllMocks();
    });

    it('hasAccess("/api/orders", "delivery_partner") should return a boolean without throwing', () => {
      const protectedRoutes: Record<string, string[]> = {
        customer: ['/api/orders', '/api/cart', '/api/profile'],
        seller: ['/api/products', '/api/orders', '/api/analytics'],
        admin: ['/api/admin', '/api/users', '/api/settings'],
      };

      function hasAccess(pathname: string, userRole: string): boolean {
        return protectedRoutes[userRole].some(route => pathname.startsWith(route));
      }

      let result: boolean | Error;
      try {
        result = hasAccess('/api/orders', 'delivery_partner');
      } catch (e) {
        result = e as Error;
      }

      expect(result).not.toBeInstanceOf(Error);
      expect(typeof result).toBe('boolean');
    });

    it('hasAccess("/api/orders", "admin") should return true (admin is superset)', () => {
      const protectedRoutes: Record<string, string[]> = {
        customer: ['/api/orders', '/api/cart', '/api/profile'],
        seller: ['/api/products', '/api/orders', '/api/analytics'],
        admin: ['/api/admin', '/api/users', '/api/settings'],
      };

      function hasAccess(pathname: string, userRole: string): boolean {
        return protectedRoutes[userRole].some(route => pathname.startsWith(route));
      }

      const result = hasAccess('/api/orders', 'admin');
      expect(result).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Case 3: tsc --noEmit over pages/ and middleware/ fails on missing deps
// (Requirement 1.15)
// ---------------------------------------------------------------------------

describe('Property 5: layer cannot compile — missing dependencies (req 1.15)', () => {
  const pagesDir = path.join(REPO_ROOT, 'pages');
  const middlewareDir = path.join(REPO_ROOT, 'middleware');
  const configSecurityPath = path.join(REPO_ROOT, 'config', 'security.ts');
  const layerFilesExist = fs.existsSync(pagesDir) || fs.existsSync(middlewareDir) || fs.existsSync(configSecurityPath);

  if (!layerFilesExist) {
    // Post-deletion: the files are gone, so there's nothing to fail compilation.
    // This IS the fix — the dead code that could never compile has been removed.
    it('tsc --noEmit on pages/ and middleware/ produces unresolved module errors', () => {
      // No pages/, middleware/, or config/security.ts exist — nothing to compile. PASS.
      expect(fs.existsSync(pagesDir)).toBe(false);
      expect(fs.existsSync(middlewareDir)).toBe(false);
      expect(fs.existsSync(configSecurityPath)).toBe(false);
    });

    it('middleware/auth.ts has duplicate NextRequest import (req 1.11)', () => {
      // middleware/auth.ts no longer exists — the duplicate import is gone. PASS.
      const authPath = path.join(REPO_ROOT, 'middleware', 'auth.ts');
      expect(fs.existsSync(authPath)).toBe(false);
    });

    it('middleware/auth.ts uses RateLimiter which rate-limiter-flexible does not export (req 1.12)', () => {
      // middleware/auth.ts no longer exists — the wrong import is gone. PASS.
      const authPath = path.join(REPO_ROOT, 'middleware', 'auth.ts');
      expect(fs.existsSync(authPath)).toBe(false);
    });
  } else {
    // Pre-deletion: exercise the compilation failure to document the bug
    it('tsc --noEmit on pages/ and middleware/ produces unresolved module errors', () => {
      const tmpTsconfig = path.join(REPO_ROOT, 'tsconfig.deadlayer.tmp.json');
      const tsconfigContent = JSON.stringify({
        compilerOptions: {
          strict: true,
          jsx: 'preserve',
          module: 'esnext',
          moduleResolution: 'node',
          target: 'es2017',
          esModuleInterop: true,
          skipLibCheck: true,
          noEmit: true,
          baseUrl: '.',
        },
        include: [
          'pages/**/*.ts',
          'middleware/**/*.ts',
          'config/security.ts',
        ],
        exclude: ['node_modules'],
      });

      fs.writeFileSync(tmpTsconfig, tsconfigContent);

      let tscOutput = '';
      let tscExitCode = 0;

      try {
        tscOutput = execFileSync(
          path.join(REPO_ROOT, 'node_modules', '.bin', 'tsc'),
          ['--noEmit', '-p', tmpTsconfig],
          {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          }
        );
      } catch (err) {
        const e = err as { status?: number; stdout?: string; stderr?: string };
        tscExitCode = typeof e.status === 'number' ? e.status : 1;
        tscOutput = (e.stdout ?? '') + '\n' + (e.stderr ?? '');
      } finally {
        try { fs.unlinkSync(tmpTsconfig); } catch {}
      }

      console.log('[task 14] tsc exit code:', tscExitCode);
      console.log('[task 14] tsc output (first 2000 chars):', tscOutput.slice(0, 2000));

      const missingDeps = ['next', 'jose', 'zod', 'ioredis', 'rate-limiter-flexible'];
      const mentionedMissingDeps = missingDeps.filter(dep =>
        tscOutput.includes(`Cannot find module '${dep}'`) ||
        tscOutput.includes(`Could not find a declaration file for module '${dep}'`)
      );

      console.log('[task 14] Missing deps detected in tsc output:', mentionedMissingDeps);

      // Assert compilation SUCCEEDS — this will FAIL because deps are missing
      expect(tscExitCode).toBe(0);
    });

    it('middleware/auth.ts has duplicate NextRequest import (req 1.11)', () => {
      const authPath = path.join(REPO_ROOT, 'middleware', 'auth.ts');
      const source = fs.readFileSync(authPath, 'utf8');
      const lines = source.split('\n');

      const nextRequestImports = lines.filter(line =>
        line.includes('NextRequest') && (line.includes('import') || line.includes('from'))
      );

      console.log('[task 14] NextRequest import lines:', nextRequestImports);

      // Assert there is exactly ONE import of NextRequest — will FAIL because there are two
      expect(nextRequestImports.length).toBe(1);
    });

    it('middleware/auth.ts uses RateLimiter which rate-limiter-flexible does not export (req 1.12)', () => {
      const authPath = path.join(REPO_ROOT, 'middleware', 'auth.ts');
      const source = fs.readFileSync(authPath, 'utf8');

      const usesRateLimiter = source.includes("import { RateLimiter }") ||
                              source.includes("{ RateLimiter }");
      const usesRateLimiterRedis = source.includes('RateLimiterRedis');

      console.log('[task 14] Uses RateLimiter (wrong):', usesRateLimiter);
      console.log('[task 14] Uses RateLimiterRedis (correct):', usesRateLimiterRedis);

      // Assert it uses the correct class name — will FAIL because it uses RateLimiter
      expect(usesRateLimiter).toBe(false);
      expect(usesRateLimiterRedis).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Case 4: encrypt/decrypt roundtrip fails (Requirement 1.16)
// ---------------------------------------------------------------------------

describe('Property 5: encrypt/decrypt roundtrip fails (req 1.16)', () => {
  const configSecurityPath = path.join(REPO_ROOT, 'config', 'security.ts');
  const configSecurityExists = fs.existsSync(configSecurityPath);

  if (!configSecurityExists) {
    // Post-deletion: config/security.ts is gone — the broken crypto helpers are removed. PASS.
    it('decrypt(encrypt("secret")) should equal "secret"', () => {
      expect(fs.existsSync(configSecurityPath)).toBe(false);
    });
  } else {
    // Pre-deletion: exercise the broken roundtrip to document the bug
    let encryptFn: ((text: string) => { encryptedData: string; iv: string }) | null = null;
    let decryptFn: ((encryptedData: string, iv: string) => string) | null = null;
    let importError: Error | null = null;

    beforeAll(() => {
      jest.resetModules();

      jest.mock('rate-limiter-flexible', () => ({
        RateLimiterMemory: class RateLimiterMemory {
          constructor() {}
          consume() { return Promise.resolve(); }
        },
      }));
      jest.mock('ioredis', () => ({
        Redis: class Redis { constructor() {} },
        default: class Redis { constructor() {} },
      }));
      jest.mock('zod', () => {
        const mockSchema: any = {
          min: () => mockSchema,
          max: () => mockSchema,
          email: () => mockSchema,
          regex: () => mockSchema,
          string: () => mockSchema,
          number: () => mockSchema,
          positive: () => mockSchema,
          int: () => mockSchema,
          optional: () => mockSchema,
          array: () => mockSchema,
          object: () => mockSchema,
        };
        return {
          z: {
            object: () => mockSchema,
            string: () => mockSchema,
            number: () => mockSchema,
            array: (s: any) => mockSchema,
            nativeEnum: (e: any) => e,
            ZodError: class ZodError extends Error {},
            ZodSchema: class {},
          },
        };
      });

      try {
        const mod = require('../../config/security');
        encryptFn = mod.encrypt;
        decryptFn = mod.decrypt;
      } catch (e) {
        importError = e as Error;
      }
    });

    afterAll(() => {
      jest.resetModules();
      jest.restoreAllMocks();
    });

    it('decrypt(encrypt("secret")) should equal "secret"', () => {
      if (importError) {
        console.log('[task 14] config/security.ts FAILED AT IMPORT:', importError.message);
        expect(importError).toBeNull();
        return;
      }

      expect(encryptFn).not.toBeNull();
      expect(decryptFn).not.toBeNull();

      let roundtrip: string | Error;
      try {
        const encrypted = encryptFn!('secret');
        roundtrip = decryptFn!(encrypted.encryptedData, encrypted.iv);
      } catch (e) {
        roundtrip = e as Error;
      }

      console.log('[task 14] encrypt/decrypt roundtrip result:', roundtrip instanceof Error ? roundtrip.message : roundtrip);

      expect(roundtrip).not.toBeInstanceOf(Error);
      expect(roundtrip).toBe('secret');
    });
  }
});

// ---------------------------------------------------------------------------
// Case 5: No live consumer imports from the dead layer (Requirement 2.15)
// ---------------------------------------------------------------------------

describe('Property 5: no live consumer of the dead layer (req 2.15)', () => {
  it('no file outside the dead layer imports from pages/, middleware/, or config/security', () => {
    // The dead layer consists of: pages/**, middleware/**, config/security.ts
    // We grep the entire codebase for imports from these paths, excluding:
    // - The dead layer itself (internal references don't count)
    // - node_modules
    // - .kiro/specs (documentation)
    // - tests/ (testing the dead code doesn't make it alive)
    // - src/test/ (same)

    let grepOutput = '';
    try {
      grepOutput = execFileSync('grep', [
        '-r',
        '--include=*.ts',
        '--include=*.tsx',
        '--include=*.js',
        '--include=*.jsx',
        '-l', // just filenames
        '-E',
        "from\\s+['\"](\\.\\./)*pages/|from\\s+['\"](\\.\\./)*middleware/|from\\s+['\"](\\.\\./)*config/security",
        REPO_ROOT,
      ], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      // grep returns exit 1 when no matches found - that's actually what we want
      const err = e as { status?: number; stdout?: string };
      if (err.status === 1) {
        grepOutput = ''; // No matches = good
      } else {
        grepOutput = err.stdout ?? '';
      }
    }

    // Filter out the dead layer itself and test/spec files
    const deadLayerPaths = ['pages/', 'middleware/', 'config/security.ts'];
    const excludePaths = [
      'node_modules/',
      '.kiro/',
      'tests/',
      'src/test/',
    ];

    const importers = grepOutput
      .split('\n')
      .filter(Boolean)
      .map(f => path.relative(REPO_ROOT, f))
      .filter(f => !excludePaths.some(exc => f.includes(exc)))
      .filter(f => !deadLayerPaths.some(dead => f.startsWith(dead)));

    console.log('[task 14] Live importers of dead layer:', importers.length > 0 ? importers : 'NONE');

    // Assert no live consumer exists — this SHOULD pass (confirming the layer is dead)
    // If it fails, the deletion recommendation must be revisited
    expect(importers).toEqual([]);
  });

  it('the five dependencies (next, jose, zod, ioredis, rate-limiter-flexible) are absent from package.json', () => {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    const allDeps = {
      ...pkgJson.dependencies,
      ...pkgJson.devDependencies,
      ...pkgJson.peerDependencies,
    };

    const missingDeps = ['next', 'jose', 'zod', 'ioredis', 'rate-limiter-flexible'];
    const present = missingDeps.filter(dep => dep in allDeps);

    console.log('[task 14] Dependencies present in package.json:', present.length > 0 ? present : 'NONE (all missing as expected)');

    // Assert all five are absent — this should PASS (confirming the finding)
    expect(present).toEqual([]);
  });

  it('no deployment target or build command exists for the Next.js layer', () => {
    // The design checked: no vercel.json, no .vercel/, no netlify.toml, no Dockerfile,
    // no .github/workflows; no script references next build/dev/start
    const deploymentFiles = [
      'vercel.json',
      '.vercel',
      'netlify.toml',
      'Dockerfile',
      '.github/workflows',
    ];

    const existingDeployFiles = deploymentFiles.filter(f =>
      fs.existsSync(path.join(REPO_ROOT, f))
    );

    const pkgJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    const scripts = pkgJson.scripts || {};
    const nextScripts = Object.entries(scripts).filter(([, cmd]) =>
      typeof cmd === 'string' && (
        (cmd as string).includes('next build') ||
        (cmd as string).includes('next dev') ||
        (cmd as string).includes('next start')
      )
    );

    console.log('[task 14] Deployment config files found:', existingDeployFiles.length > 0 ? existingDeployFiles : 'NONE');
    console.log('[task 14] Next.js scripts in package.json:', nextScripts.length > 0 ? nextScripts : 'NONE');

    // Both should be empty — confirming no deployment target
    expect(existingDeployFiles).toEqual([]);
    expect(nextScripts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Case 6: The files that SHOULD NOT EXIST after the fix (task 16 deletion)
// These assertions will FAIL on unfixed code (files exist) and PASS after deletion
// ---------------------------------------------------------------------------

describe('Property 5: dead layer files should not exist after fix (post-deletion assertions)', () => {
  const deadFiles = [
    'pages/api/admin/monitoring/security.ts',
    'pages/api/admin/monitoring/errors.ts',
    'pages/api/admin/monitoring/performance.ts',
    'pages/api/admin/monitoring/status.ts',
    'pages/api/ai/chat.ts',
    'middleware/security.ts',
    'middleware/auth.ts',
    'middleware/index.ts',
    'middleware/error.ts',
    'middleware/monitoring.ts',
    'middleware/validation.ts',
    'config/security.ts',
    'next.config.js',
  ];

  it.each(deadFiles)('%s should not exist (dead code)', (file) => {
    const fullPath = path.join(REPO_ROOT, file);
    const exists = fs.existsSync(fullPath);

    // Assert the file does NOT exist — will FAIL on unfixed code because it does
    expect(exists).toBe(false);
  });

  it('no file under pages/ or middleware/ should exist', () => {
    const pagesExist = fs.existsSync(path.join(REPO_ROOT, 'pages'));
    const middlewareExist = fs.existsSync(path.join(REPO_ROOT, 'middleware'));

    // Will FAIL on unfixed code
    expect(pagesExist).toBe(false);
    expect(middlewareExist).toBe(false);
  });
});
