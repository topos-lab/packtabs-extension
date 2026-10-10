import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * PackTabs Extension Submit & Publish Helper
 *
 * Automates extension publishing to Chrome Web Store and Firefox Add-ons (AMO).
 * - Reads credentials from process.env or .env.submit
 * - Automatically ensures zip and source archives are generated
 * - Normalizes private key newlines for Google Cloud Service Accounts
 * - Gracefully skips unconfigured stores in CI environments
 *
 * Usage:
 *   bun scripts/submit.ts               # Submit to configured stores
 *   bun scripts/submit.ts --dry-run     # Test credentials without uploading
 *   bun scripts/submit.ts --chrome-only # Only submit to Chrome Web Store
 *   bun scripts/submit.ts --firefox-only# Only submit to Firefox AMO
 */

const rootDir = path.resolve(import.meta.dirname ?? '.', '..');
const envSubmitPath = path.join(rootDir, '.env.submit');

export interface SubmitOptions {
  dryRun: boolean;
  chromeOnly: boolean;
  firefoxOnly: boolean;
  skipZip: boolean;
}

export function parseSubmitArgs(args: string[] = process.argv.slice(2)): SubmitOptions {
  return {
    dryRun: args.includes('--dry-run'),
    chromeOnly: args.includes('--chrome-only'),
    firefoxOnly: args.includes('--firefox-only'),
    skipZip: args.includes('--skip-zip'),
  };
}

/**
 * Parses .env.submit line by line, handling quoted strings and multiline private keys.
 */
export function parseEnvContent(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  let currentKey = '';
  let currentValue = '';
  let insideQuotes = false;

  for (const line of lines) {
    if (!insideQuotes) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {continue;}
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) {continue;}

      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();

      if (val.startsWith('"') && (!val.endsWith('"') || val.length === 1)) {
        insideQuotes = true;
        currentKey = key;
        currentValue = val.slice(1);
      } else {
        let cleanVal = val;
        if (cleanVal.startsWith('"') && cleanVal.endsWith('"')) {
          cleanVal = cleanVal.slice(1, -1);
        } else if (cleanVal.startsWith("'") && cleanVal.endsWith("'")) {
          cleanVal = cleanVal.slice(1, -1);
        }
        env[key] = cleanVal.replace(/\\n/g, '\n');
      }
    } else {
      if (line.endsWith('"')) {
        currentValue += `\n${  line.slice(0, -1)}`;
        env[currentKey] = currentValue.replace(/\\n/g, '\n');
        insideQuotes = false;
        currentKey = '';
        currentValue = '';
      } else {
        currentValue += `\n${  line}`;
      }
    }
  }

  return env;
}

/**
 * Loads and injects .env.submit into process.env if present.
 */
export function loadEnvSubmit(filePath: string = envSubmitPath): void {
  if (!fs.existsSync(filePath)) {return;}
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseEnvContent(content);
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    console.warn(`⚠️ Warning: Failed to read ${path.basename(filePath)}:`, err);
  }
}

export interface StoreTargets {
  submitChrome: boolean;
  submitFirefox: boolean;
}

export function detectStoreTargets(options: SubmitOptions, env: NodeJS.ProcessEnv = process.env): StoreTargets {
  const hasChromeV2 = Boolean(
    env.CHROME_PUBLISHER_ID &&
    ((env.CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL && env.CHROME_SERVICE_ACCOUNT_PRIVATE_KEY) ||
      env.CHROME_SERVICE_ACCOUNT_ACCESS_TOKEN)
  );
  const hasChromeV1 = Boolean(env.CHROME_CLIENT_ID && env.CHROME_REFRESH_TOKEN);
  const hasChrome = hasChromeV2 || hasChromeV1;

  const hasFirefox = Boolean(env.FIREFOX_JWT_ISSUER && env.FIREFOX_JWT_SECRET);

  let submitChrome = false;
  let submitFirefox = false;

  if (options.chromeOnly) {
    submitChrome = true;
  } else if (options.firefoxOnly) {
    submitFirefox = true;
  } else {
    // If neither explicit flag is passed, enable stores that have credentials
    submitChrome = hasChrome;
    submitFirefox = hasFirefox;
  }

  return { submitChrome, submitFirefox };
}

export interface SubmitArtifacts {
  chromeZip: string;
  firefoxZip: string;
  firefoxSourcesZip: string;
}

export function getArtifactPaths(rootDirPath: string = rootDir): SubmitArtifacts {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDirPath, 'package.json'), 'utf-8')) as {
    name?: string;
    version?: string;
  };
  const name = pkg.name ?? 'packtabs-extension';
  const version = pkg.version ?? '1.0.0';
  const outputDir = path.join(rootDirPath, '.output');

  return {
    chromeZip: path.join(outputDir, `${name}-${version}-chrome.zip`),
    firefoxZip: path.join(outputDir, `${name}-${version}-firefox.zip`),
    firefoxSourcesZip: path.join(outputDir, `${name}-${version}-sources.zip`),
  };
}

export function buildSubmitCliArgs(
  options: SubmitOptions,
  targets: StoreTargets,
  artifacts: SubmitArtifacts
): string[] {
  const cliArgs: string[] = [];

  if (options.dryRun) {
    cliArgs.push('--dry-run');
  }

  if (targets.submitChrome) {
    cliArgs.push('--chrome-zip', artifacts.chromeZip);
  }

  if (targets.submitFirefox) {
    cliArgs.push('--firefox-zip', artifacts.firefoxZip);
    if (fs.existsSync(artifacts.firefoxSourcesZip)) {
      cliArgs.push('--firefox-sources-zip', artifacts.firefoxSourcesZip);
    }
  }

  return cliArgs;
}

export function runSubmit(options: SubmitOptions = parseSubmitArgs()) {
  console.log('\n🏪 PackTabs Extension Submission Assistant');
  console.log('============================================');
  if (options.dryRun) {
    console.log('🔍 DRY-RUN MODE: Authentication will be checked, no files uploaded.\n');
  }

  // 1. Load local .env.submit if present
  loadEnvSubmit();

  // Normalize private key if escaped newlines were provided
  if (process.env.CHROME_SERVICE_ACCOUNT_PRIVATE_KEY) {
    process.env.CHROME_SERVICE_ACCOUNT_PRIVATE_KEY = process.env.CHROME_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n');
  }

  // Set default extension IDs if not overridden
  if (!process.env.CHROME_EXTENSION_ID) {
    process.env.CHROME_EXTENSION_ID = 'mpjjbfgjjbphemiklfoojlogcmjdkjjp';
  }
  if (!process.env.CHROME_API_VERSION) {
    process.env.CHROME_API_VERSION = 'v2';
  }
  if (!process.env.FIREFOX_EXTENSION_ID) {
    process.env.FIREFOX_EXTENSION_ID = 'packtabs@topos-lab.github.io';
  }
  if (!process.env.FIREFOX_CHANNEL) {
    process.env.FIREFOX_CHANNEL = 'listed';
  }

  // 2. Detect configured stores
  const targets = detectStoreTargets(options);
  const isCI = process.env.CI === 'true';

  if (!targets.submitChrome && !targets.submitFirefox) {
    if (isCI) {
      console.log('ℹ️ Notice: No extension store credentials configured in CI environment.');
      console.log('👉 To enable automatic store submissions, configure secrets in GitHub Repository Settings.');
      console.log('   Required secrets: CHROME_PUBLISHER_ID, CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL, CHROME_SERVICE_ACCOUNT_PRIVATE_KEY, FIREFOX_JWT_ISSUER, FIREFOX_JWT_SECRET.');
      console.log('✅ Skipping store submission gracefully.\n');
      return;
    }

    console.error('❌ Error: No store credentials found in process environment or .env.submit.');
    console.error('\nTo configure your credentials:');
    console.error('  1. Run interactive wizard:  bunx wxt submit init');
    console.error('  2. Or create a .env.submit file in the root directory.');
    console.error('     See README.md for the configuration template.\n');
    process.exit(1);
  }

  console.log('🎯 Target Stores for Submission:');
  if (targets.submitChrome) {
    console.log(`  ✓ Chrome Web Store (ID: ${process.env.CHROME_EXTENSION_ID})`);
  } else {
    console.log('  - Chrome Web Store (Skipped: credentials not set)');
  }

  if (targets.submitFirefox) {
    console.log(`  ✓ Firefox Add-ons AMO (ID: ${process.env.FIREFOX_EXTENSION_ID})`);
  } else {
    console.log('  - Firefox Add-ons AMO (Skipped: credentials not set)');
  }
  console.log('--------------------------------------------');

  // 3. Ensure zip artifacts exist
  const artifacts = getArtifactPaths();
  const needChromeZip = targets.submitChrome && !fs.existsSync(artifacts.chromeZip);
  const needFirefoxZip = targets.submitFirefox && (!fs.existsSync(artifacts.firefoxZip) || !fs.existsSync(artifacts.firefoxSourcesZip));

  if (!options.skipZip && (needChromeZip || needFirefoxZip)) {
    console.log('\n📦 Step 1: Building required zip packages...');
    if (needChromeZip) {
      console.log('  $ bun run zip');
      execSync('bun run zip', { cwd: rootDir, stdio: 'inherit' });
    }
    if (needFirefoxZip) {
      console.log('  $ bun run zip:firefox');
      execSync('bun run zip:firefox', { cwd: rootDir, stdio: 'inherit' });
    }
  }

  // Double check that targeted files exist
  if (targets.submitChrome && !fs.existsSync(artifacts.chromeZip)) {
    console.error(`❌ Error: Chrome zip not found at ${artifacts.chromeZip}`);
    process.exit(1);
  }
  if (targets.submitFirefox && !fs.existsSync(artifacts.firefoxZip)) {
    console.error(`❌ Error: Firefox zip not found at ${artifacts.firefoxZip}`);
    process.exit(1);
  }

  // 4. Build command arguments and execute
  const cliArgs = buildSubmitCliArgs(options, targets, artifacts);
  const cmd = `bunx wxt submit ${cliArgs.join(' ')}`;

  console.log(`\n🚀 Step 2: Executing submission command...`);
  console.log(`  $ ${cmd}\n`);

  try {
    execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
    console.log('\n============================================');
    console.log('🎉 Store submission completed successfully!');
    console.log('============================================\n');
  } catch (_err) {
    console.error('\n❌ Submission failed. Check logs above for details.');
    process.exit(1);
  }
}

if (import.meta.main || process.argv[1]?.endsWith('submit.ts')) {
  runSubmit();
}
