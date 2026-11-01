import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildSubmitCliArgs,
  detectStoreTargets,
  extractAmoMetadataFromChangelog,
  generateAmoMetadataFile,
  getArtifactPaths,
  parseEnvContent,
  parseSubmitArgs,
} from '../../scripts/submit';

describe('Submit Script Helpers', () => {
  describe('parseSubmitArgs', () => {
    it('correctly parses CLI arguments', () => {
      expect(parseSubmitArgs(['--dry-run'])).toEqual({
        dryRun: true,
        chromeOnly: false,
        firefoxOnly: false,
        skipZip: false,
      });

      expect(parseSubmitArgs(['--chrome-only', '--skip-zip'])).toEqual({
        dryRun: false,
        chromeOnly: true,
        firefoxOnly: false,
        skipZip: true,
      });

      expect(parseSubmitArgs(['--firefox-only', '--dry-run'])).toEqual({
        dryRun: true,
        chromeOnly: false,
        firefoxOnly: true,
        skipZip: false,
      });
    });
  });

  describe('parseEnvContent', () => {
    it('parses standard KEY=VALUE lines and ignores comments', () => {
      const content = `
# Comment
KEY1=value1
KEY2="value2"
KEY3='value3'
`;
      const result = parseEnvContent(content);
      expect(result).toEqual({
        KEY1: 'value1',
        KEY2: 'value2',
        KEY3: 'value3',
      });
    });

    it('correctly parses escaped newlines and multiline private keys', () => {
      const content = `
CHROME_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7\\n-----END PRIVATE KEY-----\\n"
`;
      const result = parseEnvContent(content);
      expect(result.CHROME_SERVICE_ACCOUNT_PRIVATE_KEY).toContain('-----BEGIN PRIVATE KEY-----\n');
      expect(result.CHROME_SERVICE_ACCOUNT_PRIVATE_KEY).toContain('\n-----END PRIVATE KEY-----\n');
    });

    it('handles multiline values without escaped newlines', () => {
      const content = `
KEY="line1
line2
line3"
`;
      const result = parseEnvContent(content);
      expect(result.KEY).toBe('line1\nline2\nline3');
    });
  });

  describe('detectStoreTargets', () => {
    it('enables both stores when both sets of credentials are provided', () => {
      const env = {
        CHROME_PUBLISHER_ID: 'pub123',
        CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL: 'acc@example.com',
        CHROME_SERVICE_ACCOUNT_PRIVATE_KEY: 'key',
        FIREFOX_JWT_ISSUER: 'issuer',
        FIREFOX_JWT_SECRET: 'secret',
      };
      const targets = detectStoreTargets({ dryRun: false, chromeOnly: false, firefoxOnly: false, skipZip: false }, env);
      expect(targets).toEqual({
        submitChrome: true,
        submitFirefox: true,
      });
    });

    it('enables only Chrome when only Chrome credentials are provided', () => {
      const env = {
        CHROME_PUBLISHER_ID: 'pub123',
        CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL: 'acc@example.com',
        CHROME_SERVICE_ACCOUNT_PRIVATE_KEY: 'key',
      };
      const targets = detectStoreTargets({ dryRun: false, chromeOnly: false, firefoxOnly: false, skipZip: false }, env);
      expect(targets).toEqual({
        submitChrome: true,
        submitFirefox: false,
      });
    });

    it('enables only Firefox when only Firefox credentials are provided', () => {
      const env = {
        FIREFOX_JWT_ISSUER: 'issuer',
        FIREFOX_JWT_SECRET: 'secret',
      };
      const targets = detectStoreTargets({ dryRun: false, chromeOnly: false, firefoxOnly: false, skipZip: false }, env);
      expect(targets).toEqual({
        submitChrome: false,
        submitFirefox: true,
      });
    });

    it('honors --chrome-only flag even if both credentials exist', () => {
      const env = {
        CHROME_PUBLISHER_ID: 'pub123',
        CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL: 'acc@example.com',
        CHROME_SERVICE_ACCOUNT_PRIVATE_KEY: 'key',
        FIREFOX_JWT_ISSUER: 'issuer',
        FIREFOX_JWT_SECRET: 'secret',
      };
      const targets = detectStoreTargets({ dryRun: false, chromeOnly: true, firefoxOnly: false, skipZip: false }, env);
      expect(targets).toEqual({
        submitChrome: true,
        submitFirefox: false,
      });
    });

    it('honors --firefox-only flag even if both credentials exist', () => {
      const env = {
        CHROME_PUBLISHER_ID: 'pub123',
        CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL: 'acc@example.com',
        CHROME_SERVICE_ACCOUNT_PRIVATE_KEY: 'key',
        FIREFOX_JWT_ISSUER: 'issuer',
        FIREFOX_JWT_SECRET: 'secret',
      };
      const targets = detectStoreTargets({ dryRun: false, chromeOnly: false, firefoxOnly: true, skipZip: false }, env);
      expect(targets).toEqual({
        submitChrome: false,
        submitFirefox: true,
      });
    });
  });

  describe('getArtifactPaths', () => {
    it('returns expected zip paths based on package.json', () => {
      const artifacts = getArtifactPaths();
      expect(artifacts.chromeZip).toMatch(/packtabs-extension-.*-chrome\.zip$/);
      expect(artifacts.firefoxZip).toMatch(/packtabs-extension-.*-firefox\.zip$/);
      expect(artifacts.firefoxSourcesZip).toMatch(/packtabs-extension-.*-sources\.zip$/);
    });
  });

  describe('buildSubmitCliArgs', () => {
    it('builds CLI args with --dry-run and specified zip files', () => {
      const options = { dryRun: true, chromeOnly: false, firefoxOnly: false, skipZip: false };
      const targets = { submitChrome: true, submitFirefox: true };
      const artifacts = {
        chromeZip: '/path/chrome.zip',
        firefoxZip: '/path/firefox.zip',
        firefoxSourcesZip: '/path/sources.zip',
      };

      const args = buildSubmitCliArgs(options, targets, artifacts);
      expect(args).toContain('--dry-run');
      expect(args).toContain('--chrome-zip');
      expect(args).toContain('/path/chrome.zip');
      expect(args).toContain('--firefox-zip');
      expect(args).toContain('/path/firefox.zip');
    });

    it('includes --firefox-amo-metadata-file when valid metadata path is passed and file exists', () => {
      const options = { dryRun: false, chromeOnly: false, firefoxOnly: false, skipZip: false };
      const targets = { submitChrome: false, submitFirefox: true };
      const artifacts = {
        chromeZip: '/path/chrome.zip',
        firefoxZip: '/path/firefox.zip',
        firefoxSourcesZip: '/path/sources.zip',
      };
      // Use existing package.json as dummy existing file for path check
      const dummyPath = path.resolve(__dirname, '../../package.json');
      const args = buildSubmitCliArgs(options, targets, artifacts, dummyPath);
      expect(args).toContain('--firefox-amo-metadata-file');
      expect(args).toContain(dummyPath);
    });
  });

  describe('extractAmoMetadataFromChangelog', () => {
    it('extracts English and Chinese release notes from changelog section', () => {
      const mockChangelog = `
# Changelog

## [1.2.0] - 2026-11-01

### 📦 Chrome Web Store & Firefox AMO Release Notes (For Store Submission)

#### English (en-US):
\`\`\`text
What's new in PackTabs:
- Added fast release script.
\`\`\`

#### 简体中文 (zh-CN):
\`\`\`text
PackTabs 本次更新：
- 增加了快速发版脚本。
\`\`\`

---
`;
      const result = extractAmoMetadataFromChangelog(mockChangelog);
      expect(result).not.toBeNull();
      expect(result?.release_notes?.['en-US']).toContain("What's new in PackTabs:");
      expect(result?.release_notes?.['zh-CN']).toContain('PackTabs 本次更新：');
    });

    it('returns null if release notes section is missing', () => {
      const mockChangelog = `
# Changelog
## [1.0.0] - 2026-10-06
### Added
- First release
`;
      expect(extractAmoMetadataFromChangelog(mockChangelog)).toBeNull();
    });
  });

  describe('generateAmoMetadataFile', () => {
    it('generates amo-metadata.json from actual CHANGELOG.md', () => {
      const generatedPath = generateAmoMetadataFile();
      expect(generatedPath).not.toBeNull();
      if (generatedPath) {
        expect(fs.existsSync(generatedPath)).toBe(true);
        const parsed = JSON.parse(fs.readFileSync(generatedPath, 'utf-8'));
        expect(parsed.release_notes).toBeDefined();
        expect(parsed.release_notes['en-US']).toBeDefined();
      }
    });
  });
});
