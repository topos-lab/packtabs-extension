# Release Process, Versioning & CI/CD

> Maintainer guide for PackTabs versioning, automated releases, browser store publishing, and GitHub Actions workflows.  
> For end-user overview and local development setup, see [README.md](../README.md).

---

## 🚀 Release Process & Versioning Strategy

PackTabs follows the **Even/Odd Versioning Scheme** alongside a fully automated release pipeline:

- **Odd Minor Versions** (`1.1.0`, `1.3.0`, `1.5.0`): Active in-progress development cycles on `main` (never published to public extension stores).
- **Even Minor Versions** (`1.0.0`, `1.2.0`, `1.4.0`): Stable milestone production releases verified and submitted to Chrome Web Store and Firefox AMO. Hotfix patches use `MAJOR.EVEN_MINOR.PATCH` (e.g. `1.4.1`).

### 1. One-Command Automated Release

When you are ready to promote the current development version to a production release:

```bash
# Step A: Simulate release flow (Dry-Run mode: no file or git modifications)
bun run release:dry

# Step B: Execute the automated release
bun run release
```

**What [`scripts/release.ts`](../scripts/release.ts) does automatically:**
1. **Version Promotion**: Promotes active dev version (e.g. `1.3.0`) to the next stable release version (e.g. `1.4.0`).
2. **File Synchronization**: Synchronizes version across `package.json` and `wxt.config.ts`.
3. **CHANGELOG Archival**: Formats and dates the release section in [`CHANGELOG.md`](../CHANGELOG.md).
4. **Automated Quality Gate**: Runs `bun run check` (TypeScript compilation + ESLint + 300+ Vitest tests).
5. **Git Tagging**: Creates a release commit (`chore(release): v1.4.0`) and an annotated Git tag (`v1.4.0`).
6. **Release Bundle Packaging**: Packages stable Chrome, Firefox, and Firefox source archives (`bun run zip` & `bun run zip:firefox`) before bumping the dev version.
7. **Cycle Advancement**: Automatically advances codebase to the next development cycle (e.g. `1.5.0`), injects a fresh [`CHANGELOG.md`](../CHANGELOG.md) template, and commits.

### 2. Publishing to GitHub & Extension Stores

Push the release commits and tag to GitHub:

```bash
git push origin main --follow-tags
```

Once pushed:
- **GitHub Actions (`release.yml`)**: Automatically triggers upon new tag push (`v*`), compiles packages for Chrome MV3, Firefox MV3, and source zip archives, extracts release notes from [`CHANGELOG.md`](../CHANGELOG.md), creates a GitHub Release, and **automatically submits packages to Chrome Web Store & Firefox AMO** if secrets are configured.
- **Local Submission Script**: You can also verify or submit directly from your local terminal:
  ```bash
  # Step A: Dry-run check (verifies credentials and packages without uploading)
  bun run submit:dry

  # Step B: Publish and submit to Chrome Web Store & Firefox AMO
  bun run submit
  ```

#### Configuring Store API Credentials

> 📖 **详细配置教程**：完整的申请、授权步骤与故障排查说明，请参阅 [**浏览器扩展商店 API 凭据申请指南**](STORE_API_KEY_GUIDE.md)。

##### Option A: GitHub Actions Secrets (Recommended for Full CI/CD Automation)
Configure the following Repository Secrets in **GitHub Settings -> Secrets and variables -> Actions**:

| Secret Name | Description | Source |
|---|---|---|
| `CHROME_PUBLISHER_ID` | Your Chrome Web Store Publisher ID | Chrome Web Store Developer Console -> Account |
| `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` | Google Cloud Service Account Email | Google Cloud Console (IAM & Admin -> Service Accounts) |
| `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` | Google Cloud Service Account Private Key | JSON key downloaded from Google Cloud Service Account |
| `FIREFOX_JWT_ISSUER` | Mozilla AMO API JWT Issuer | [AMO API Keys](https://addons.mozilla.org/developers/addon/api/key/) |
| `FIREFOX_JWT_SECRET` | Mozilla AMO API JWT Secret | [AMO API Keys](https://addons.mozilla.org/developers/addon/api/key/) |

##### Option B: Local `.env.submit` Configuration
Copy the template [`.env.submit.example`](../.env.submit.example) to `.env.submit` in the project root:

```bash
# PowerShell
Copy-Item .env.submit.example .env.submit

# Bash / Zsh
cp .env.submit.example .env.submit
```

Fill in your store credentials in `.env.submit` (ignored by `.gitignore`):
```env
# Chrome Web Store (API v2)
CHROME_API_VERSION=v2
CHROME_EXTENSION_ID=mpjjbfgjjbphemiklfoojlogcmjdkjjp
CHROME_PUBLISHER_ID=your_publisher_id
CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL=your_service_account@project.iam.gserviceaccount.com
CHROME_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firefox Add-ons (AMO)
FIREFOX_EXTENSION_ID=packtabs@topos-lab.github.io
FIREFOX_JWT_ISSUER=your_jwt_issuer
FIREFOX_JWT_SECRET=your_jwt_secret
FIREFOX_CHANNEL=listed
```
*Tip: Run `bunx wxt submit init` to launch the interactive configuration wizard.*

---

## CI/CD & Automation

This project uses **GitHub Actions** for continuous integration, automated testing, dependency management, and releases:

- **Continuous Integration ([`ci.yml`](../.github/workflows/ci.yml))**:
  - Automatically triggered whenever code is pushed to `main` or upon creating a Pull Request.
  - Installs Bun environment and frozen dependencies.
  - Runs strict TypeScript compilation (`vue-tsc --noEmit`), the complete test suite (300+ unit & property-based tests via `vitest`), and builds both Chrome MV3 and Firefox extensions to prevent regressions.
- **Release Pipeline ([`release.yml`](../.github/workflows/release.yml))**:
  - Automatically triggered on release tag push (`v*`) or manually via GitHub's **Actions** tab (`Run workflow`).
  - Packages production builds for Chrome MV3, Firefox MV3, and source zip archives.
  - Automatically extracts release notes from [`CHANGELOG.md`](../CHANGELOG.md), creates a GitHub Release, and submits updates directly to Chrome Web Store and Firefox AMO.
- **Dependency Management & Security ([`dependabot.yml`](../.github/dependabot.yml))**:
  - Automatically scans npm/bun dependencies weekly and GitHub Actions monthly.
  - Opens automated Pull Requests for security patches and library upgrades.
