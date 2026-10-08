import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * PackTabs Automated Release Script
 *
 * Implements the Even/Odd Versioning Scheme:
 * 1. Promotes the current development version (odd minor, e.g. 1.1.0) to a stable release version (even minor, e.g. 1.2.0).
 * 2. Synchronizes version across `package.json` and `wxt.config.ts`.
 * 3. Archives the current section in `CHANGELOG.md` with today's date.
 * 4. Runs automated quality gate (`bun run check`).
 * 5. Commits and creates an annotated Git Tag (`v1.2.0`).
 * 6. Automatically advances codebase to the next development cycle (odd minor, e.g. 1.3.0) and commits.
 *
 * Usage:
 *   bun scripts/release.ts                 # Interactive / Auto-推导
 *   bun scripts/release.ts --dry-run       # Simulate without disk or git changes
 *   bun scripts/release.ts --target 1.2.0 --next 1.3.0
 */

const rootDir = path.resolve(import.meta.dirname ?? '.', '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const wxtConfigPath = path.join(rootDir, 'wxt.config.ts');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

interface ReleaseOptions {
  dryRun: boolean;
  skipCheck: boolean;
  targetVersion?: string;
  nextDevVersion?: string;
  noBump: boolean;
}

function parseCliArgs(): ReleaseOptions {
  const args = process.argv.slice(2);
  const options: ReleaseOptions = {
    dryRun: args.includes('--dry-run'),
    skipCheck: args.includes('--skip-check'),
    noBump: args.includes('--no-bump'),
  };

  const targetIdx = args.findIndex((a) => a === '--target' || a === '-t');
  if (targetIdx !== -1 && args[targetIdx + 1]) {
    options.targetVersion = args[targetIdx + 1];
  }

  const nextIdx = args.findIndex((a) => a === '--next' || a === '-n');
  if (nextIdx !== -1 && args[nextIdx + 1]) {
    options.nextDevVersion = args[nextIdx + 1];
  }

  return options;
}

/**
 * Computes next stable version from a development version.
 * e.g. 1.1.0 -> 1.2.0, 1.3.0 -> 1.4.0
 */
export function computeStableReleaseVersion(currentVersion: string): string {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    throw new Error(`Invalid version format: ${currentVersion}. Expected X.Y.Z`);
  }

  // If already even (e.g. 1.2.0), bump patch to 1.2.1
  if (minor % 2 === 0) {
    return `${major}.${minor}.${patch + 1}`;
  }

  // If odd (e.g. 1.1.0), promote to next even minor: 1.2.0
  return `${major}.${minor + 1}.0`;
}

/**
 * Computes next odd development version from a stable release version.
 * e.g. 1.2.0 -> 1.3.0, 1.4.0 -> 1.5.0
 */
export function computeNextDevVersion(stableVersion: string): string {
  const [major, minor] = stableVersion.split('.').map(Number);
  if (isNaN(major) || isNaN(minor)) {
    throw new Error(`Invalid version format: ${stableVersion}. Expected X.Y.Z`);
  }

  // If minor is even (e.g. 1.2.0), advance to next odd: 1.3.0
  if (minor % 2 === 0) {
    return `${major}.${minor + 1}.0`;
  }

  // If minor is odd, bump major or minor appropriately
  return `${major}.${minor + 2}.0`;
}

function updateFile(filePath: string, updater: (content: string) => string, dryRun: boolean) {
  const oldContent = fs.readFileSync(filePath, 'utf-8');
  const newContent = updater(oldContent);
  if (oldContent === newContent) {
    console.warn(`  ⚠️ Warning: No changes detected in ${path.basename(filePath)}`);
    return;
  }
  if (!dryRun) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }
  console.log(`  ✓ Updated ${path.basename(filePath)}`);
}

function updateVersionInPackageJson(version: string, dryRun: boolean) {
  updateFile(
    packageJsonPath,
    (content) => content.replace(/"version":\s*"[^"]+"/, `"version": "${version}"`),
    dryRun
  );
}

function updateVersionInWxtConfig(version: string, dryRun: boolean) {
  updateFile(
    wxtConfigPath,
    (content) => content.replace(/version:\s*'[^']+'/, `version: '${version}'`),
    dryRun
  );
}

function archiveChangelogForRelease(devVersion: string, releaseVersion: string, dryRun: boolean) {
  const today = new Date().toISOString().split('T')[0];
  updateFile(
    changelogPath,
    (content) => {
      // Look for ## [1.1.0] - In Development or ## [Unreleased]
      const devHeaderPattern = new RegExp(`##\\s*\\[(?:${devVersion}|Unreleased)\\]\\s*-\\s*(?:In Development|未发布)`, 'i');
      if (!devHeaderPattern.test(content)) {
        console.warn(`  ⚠️ Could not find "## [${devVersion}] - In Development" header in CHANGELOG.md`);
        return content;
      }
      return content.replace(devHeaderPattern, `## [${releaseVersion}] - ${today}`);
    },
    dryRun
  );
}

function injectNextDevChangelogHeader(nextDevVersion: string, dryRun: boolean) {
  updateFile(
    changelogPath,
    (content) => {
      const template = `## [${nextDevVersion}] - In Development\n\n### Added\n- \n\n### Fixed\n- \n\n---\n\n`;
      // Insert right after the top separator '---'
      const separatorIdx = content.indexOf('---');
      if (separatorIdx === -1) {
        return `${template}${content}`;
      }
      const before = content.slice(0, separatorIdx + 3);
      const after = content.slice(separatorIdx + 3);
      return `${before}\n\n${template}${after.trimStart()}`;
    },
    dryRun
  );
}

function runCommand(cmd: string, dryRun: boolean) {
  console.log(`  $ ${cmd}`);
  if (!dryRun) {
    execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
  }
}

export function runRelease(options: ReleaseOptions = parseCliArgs()) {
  console.log('\n🚀 PackTabs Automated Release Assistant');
  console.log('=======================================');
  if (options.dryRun) {
    console.log('🔍 DRY-RUN MODE: No files will be modified, no git commits will be made.\n');
  }

  // 1. Read current version
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as { version?: string };
  const currentVersion: string = pkg.version ?? '1.1.0';
  console.log(`📌 Current codebase version: ${currentVersion}`);

  // 2. Compute Target Stable Release Version
  const targetReleaseVersion = options.targetVersion ?? computeStableReleaseVersion(currentVersion);
  const nextDevVersion = options.nextDevVersion ?? computeNextDevVersion(targetReleaseVersion);

  console.log(`🎯 Target Release Version : ${targetReleaseVersion} (Stable Milestone)`);
  if (!options.noBump) {
    console.log(`🔄 Next Dev Cycle Version : ${nextDevVersion} (Active Development)`);
  }
  console.log('---------------------------------------');

  // 3. Verify clean Git status
  try {
    const gitStatus = execSync('git status --porcelain', { cwd: rootDir }).toString().trim();
    if (gitStatus && !options.dryRun) {
      console.error('❌ Error: Working tree contains uncommitted changes. Please stash or commit before releasing.');
      console.error(gitStatus);
      process.exit(1);
    }
  } catch (err) {
    console.error('Failed to check git status:', err);
  }

  // 4. Update files to stable release version
  console.log(`\n📦 Step 1: Promoting version to ${targetReleaseVersion}...`);
  updateVersionInPackageJson(targetReleaseVersion, options.dryRun);
  updateVersionInWxtConfig(targetReleaseVersion, options.dryRun);
  archiveChangelogForRelease(currentVersion, targetReleaseVersion, options.dryRun);

  // 5. Run Quality Check
  if (!options.skipCheck) {
    console.log('\n🧪 Step 2: Running full quality gate (compile + lint + test)...');
    runCommand('bun run check', options.dryRun);
  } else {
    console.log('\n⏩ Skipping quality check (--skip-check passed)');
  }

  // 6. Commit release and tag
  console.log(`\n🏷️ Step 3: Creating release commit and Git tag v${targetReleaseVersion}...`);
  runCommand(`git commit -am "chore(release): v${targetReleaseVersion}"`, options.dryRun);
  runCommand(`git tag -a "v${targetReleaseVersion}" -m "Release v${targetReleaseVersion}"`, options.dryRun);

  // 7. Bump to next development cycle
  if (!options.noBump) {
    console.log(`\n🌱 Step 4: Advancing to next development cycle (v${nextDevVersion})...`);
    updateVersionInPackageJson(nextDevVersion, options.dryRun);
    updateVersionInWxtConfig(nextDevVersion, options.dryRun);
    injectNextDevChangelogHeader(nextDevVersion, options.dryRun);
    runCommand(`git commit -am "chore: prepare for next development cycle v${nextDevVersion}"`, options.dryRun);
  }

  console.log('\n=======================================');
  console.log(`🎉 Release v${targetReleaseVersion} prepared successfully!`);
  console.log(`📌 Active codebase is now set to development version v${nextDevVersion}.`);
  console.log('\n👉 Next steps to publish to GitHub:');
  console.log('   git push origin main --follow-tags');
  console.log('=======================================\n');
}

// Only execute when run directly as a script
if (import.meta.main || process.argv[1]?.endsWith('release.ts')) {
  runRelease();
}
