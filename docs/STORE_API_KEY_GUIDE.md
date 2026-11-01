# 浏览器扩展商店 API 凭据申请与自动化发布配置指南

本文档提供 **Chrome Web Store** 与 **Firefox Add-ons (AMO)** 自动化发布 API 凭据的手把手申请、配置与本地/云端发布教程。

---

## 目录
- [一、准备工作：重命名配置文件](#一准备工作重命名配置文件)
- [二、Chrome Web Store API 凭据申请与配置](#二chrome-web-store-api-凭据申请与配置)
  - [1. 为什么要使用 API v2（服务账号鉴权）](#1-为什么要使用-api-v2服务账号鉴权)
  - [2. 步骤 1：在 Google Cloud 中启用 Chrome Web Store API](#2-步骤-1在-google-cloud-中启用-chrome-web-store-api)
  - [3. 步骤 2：创建服务账号并下载 JSON 密钥](#3-步骤-2创建服务账号并下载-json-密钥)
  - [4. 步骤 3：在 Chrome 开发者控制台中授权服务账号](#4-步骤-3在-chrome-开发者控制台中授权服务账号)
  - [5. 步骤 4：提取凭据并填入配置文件](#5-步骤-4提取凭据并填入配置文件)
- [三、Firefox Add-ons (AMO) API 凭据申请与配置](#三firefox-add-ons-amo-api-凭据申请与配置)
  - [1. 步骤 1：进入 Mozilla AMO API 密钥页面](#1-步骤-1进入-mozilla-amo-api-密钥页面)
  - [2. 步骤 2：生成并提取 JWT 凭据](#2-步骤-2生成并提取-jwt-凭据)
  - [3. 步骤 3：填入配置文件](#3-步骤-3填入配置文件)
- [四、本地运行与验证](#四本地运行与验证)
- [五、配置 GitHub Actions 云端全自动流水线](#五配置-github-actions-云端全自动流水线)
- [六、常见问题排查 (FAQ)](#六常见问题排查-faq)

---

## 一、准备工作：重命名配置文件

在项目根目录下，我们提供了配置模板文件 [`.env.submit.example`](file:///.env.submit.example)。你需要将其复制并重命名为 `.env.submit`。

> [!IMPORTANT]
> `.env.submit` 包含高度敏感的商店发布私钥与令牌。代码库的 [`.gitignore`](file:///.gitignore) 已自动配置规则将其忽略，**切勿将包含真实密钥的文件提交到 Git 仓库**。

### 重命名方法

#### 方法 A：使用终端命令行（推荐）

- **Windows PowerShell**:
  ```powershell
  Copy-Item .env.submit.example .env.submit
  ```
- **macOS / Linux / Git Bash**:
  ```bash
  cp .env.submit.example .env.submit
  ```

#### 方法 B：使用图形界面（文件资源管理器）
1. 在项目根目录下找到 `.env.submit.example` 文件。
2. 鼠标右键点击文件，选择 **复制**，然后在当前目录下 **粘贴**。
3. 将新生成的文件重命名为 `.env.submit`（注意前面的英文句号 `.`）。
   > 若 Windows 提示“键入文件名”，请确保在重命名输入框中完整输入 `.env.submit`。

---

## 二、Chrome Web Store API 凭据申请与配置

### 1. 为什么要使用 API v2（服务账号鉴权）
- **旧版 API v1.1 缺陷**：基于 OAuth 2.0 用户授权，如果项目处于“测试”状态，Refresh Token 会在 **7 天后自动失效**，导致 CI/CD 定期断流。
- **推荐 API v2 优势**：基于 Google Cloud 服务账号 (Service Account) 的 RSA 密钥对鉴权，**永久稳定有效**，适合长效 CI/CD 自动化部署。

---

### 2. 步骤 1：在 Google Cloud 中启用 Chrome Web Store API
1. 打开浏览器并登录 [Google Cloud Console](https://console.cloud.google.com/)。
2. 点击顶部导航栏的项目下拉菜单，选择现有项目或点击 **“新建项目 (New Project)”**（例如命名为 `packtabs-deployment`）。
3. 在左侧菜单点击 **“API 和服务 (APIs & Services)” -> “库 (Library)”**。
4. 在搜索框中输入 `Chrome Web Store API` 并点击搜索结果。
5. 点击 **“启用 (Enable)”** 按钮。

---

### 3. 步骤 2：创建服务账号并下载 JSON 密钥
1. 在 Google Cloud Console 左侧导航栏中，点击 **“IAM 与管理 (IAM & Admin)” -> “服务账号 (Service Accounts)”**。
2. 点击顶部的 **“创建服务账号 (Create Service Account)”**。
3. 填写基本信息：
   - **服务账号名称**：例如 `packtabs-publisher`
   - **服务账号 ID**：会自动生成（例如 `packtabs-publisher@packtabs-deployment.iam.gserviceaccount.com`）
   - 点击 **“完成 (Done)”**（角色无需选择 GCP 内部角色，权限将在 Chrome 控制台授予）。
4. 在服务账号列表中，找到刚刚创建的服务账号，点击右侧的 **操作 (Actions) -> 管理密钥 (Manage keys)**（或直接点击账号名称进入“密钥”标签页）。
5. 点击 **“添加密钥 (Add Key)” -> “创建新密钥 (Create new key)”**。
6. 密钥类型选择 **JSON**，点击 **“创建 (Create)”**。
7. 此时浏览器会自动下载一个 `.json` 格式的私钥文件，请妥善保存在本地安全路径（**切勿上传或泄露给他人**）。

---

### 4. 步骤 3：在 Chrome 开发者控制台中授权服务账号
1. 打开并登录 [Chrome 开发者信息中心 (Chrome Web Store Developer Dashboard)](https://chrome.google.com/webstore/devconsole/)。
2. 点击左侧菜单底部的 **“账号 (Account)”**。
3. 在账号设置页面找到并点击 **“API 访问权限 (API Access)”** 标签。
4. 如果此前未关联项目，请点击 **“关联 Google Cloud 项目 (Associate a Google Cloud Project)”** 并选择步骤 1 中创建的项目。
5. 关联成功后，页面下方的“服务账号”列表中会出现你在步骤 2 中创建的服务账号邮箱。
6. 在该服务账号右侧，点击 **“授予权限 (Grant Access)”**，勾选具有权限发布扩展并确认保存。
7. 返回“账号 (Account)”主页面，在页面上方记录你的 **发布者 ID (Publisher ID)**（通常为形如 `pub-xxxxxxxxxxxx` 或一串数字字母编号）。

---

### 5. 步骤 4：提取凭据并填入配置文件

打开你刚刚下载的 `.json` 密钥文件，里面包含类似以下字段：
```json
{
  "type": "service_account",
  "project_id": "packtabs-deployment",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7...\n-----END PRIVATE KEY-----\n",
  "client_email": "packtabs-publisher@packtabs-deployment.iam.gserviceaccount.com",
  ...
}
```

打开项目根目录下的 `.env.submit`，对应填写：

```env
# 1. 固定使用 v2
CHROME_API_VERSION=v2

# 2. PackTabs 在 Chrome 应用商店的扩展 ID（无需修改）
CHROME_EXTENSION_ID=mpjjbfgjjbphemiklfoojlogcmjdkjjp

# 3. 步骤 3 中查到的发布者 ID
CHROME_PUBLISHER_ID=你的_Publisher_ID

# 4. 从 JSON 文件复制 "client_email" 字段值
CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL=packtabs-publisher@packtabs-deployment.iam.gserviceaccount.com

# 5. 从 JSON 文件复制 "private_key" 字段值（包含整个双引号、BEGIN/END 标识与 \n 换行符）
CHROME_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7...\n-----END PRIVATE KEY-----\n"
```

> [!TIP]
> 我们的发布脚本 `scripts/submit.ts` 原生支持解析带有 `\n` 转义字符的单行私钥，也支持粘贴为多行文本。最保险的方式是**直接完整复制 JSON 中的 `"private_key"` 内容（保留两端双引号）**。

---

## 三、Firefox Add-ons (AMO) API 凭据申请与配置

Mozilla 的 API 凭据申请极其简单，仅需 1 分钟即可完成。

### 1. 步骤 1：进入 Mozilla AMO API 密钥页面
1. 访问 [Mozilla 附加组件开发者中心 (Add-on Developer Hub)](https://addons.mozilla.org/developers/) 并登录你的开发者账号。
2. 点击右上角个人头像，选择 **API 密钥 (API Keys)**，或者直接访问：
   [https://addons.mozilla.org/developers/addon/api/key/](https://addons.mozilla.org/developers/addon/api/key/)

### 2. 步骤 2：生成并提取 JWT 凭据
1. 在页面中点击 **“生成新凭据 (Generate new credentials)”**。
2. 页面将生成一对凭据：
   - **JWT issuer**：形如 `user:12345678:xxx`
   - **JWT secret**：一串 64 位哈希字符串私钥
3. 复制这两个值。

### 3. 步骤 3：填入配置文件
在 `.env.submit` 中填入：

```env
# 扩展在 AMO 的 Gecko ID（对应 wxt.config.ts 中的配置，无需修改）
FIREFOX_EXTENSION_ID=packtabs@topos-lab.github.io

# 步骤 2 复制的 JWT Issuer
FIREFOX_JWT_ISSUER=user:12345678:xxx

# 步骤 2 复制的 JWT Secret
FIREFOX_JWT_SECRET=你的_64位_JWT_Secret

# 默认上架公开发布
FIREFOX_CHANNEL=listed
```

> [!NOTE]
> Mozilla AMO 要求使用打包工具（如 Vite / Webpack / TypeScript）构建的扩展必须上传未经混淆的源码包供人工安全审查。我们的发布流水线已集成 `--sources`，会在发布时自动生成 `packtabs-extension-<version>-sources.zip` 一并上传，无需手动打源码包。

---

## 四、本地运行与验证

在配置好 `.env.submit` 之后，可以在本地终端进行验证：

### 1. 运行预检检查 (Dry-Run)
Dry-Run 模式会检查你的 API Key 格式、与各商店服务器进行身份认证握手，并构建扩展 ZIP 包，但**不会真正上传文件或提交审核**：

```powershell
bun run submit:dry
```

如果输出如下提示，则表明凭据配置完全正确：
```text
🎯 Target Stores for Submission:
  ✓ Chrome Web Store (ID: mpjjbfgjjbphemiklfoojlogcmjdkjjp)
  ✓ Firefox Add-ons AMO (ID: packtabs@topos-lab.github.io)
...
🎉 Store submission completed successfully!
```

### 2. 本地一键正式提交审核
当你准备好提交新版本时，执行：
```powershell
bun run submit
```

若只想单独更新某一家商店：
```powershell
# 仅提交 Chrome Web Store
bun run submit --chrome-only

# 仅提交 Firefox AMO
bun run submit --firefox-only
```

---

## 五、配置 GitHub Actions 云端全自动流水线

如果你希望在本地发布新版本后，代码推送即可自动触发 GitHub 远程打包并提交各商店审核，请配置 GitHub Secrets：

1. 进入 GitHub 仓库页面：  
   `https://github.com/你的组织或用户名/packtabs-extension`
2. 点击顶部的 **Settings (设置)** -> 左侧侧边栏 **Secrets and variables** -> **Actions**。
3. 点击 **New repository secret**，依次添加以下 5 个密钥：

| Secret 名称 (Name) | 对应值 (Value) |
|---|---|
| `CHROME_PUBLISHER_ID` | 你的 Chrome Publisher ID |
| `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` | Google Cloud 服务账号邮箱 |
| `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` | 服务账号私钥内容（包含 `-----BEGIN PRIVATE KEY-----`） |
| `FIREFOX_JWT_ISSUER` | Mozilla JWT Issuer |
| `FIREFOX_JWT_SECRET` | Mozilla JWT Secret |

### 云端全自动发版日常工作流：
```powershell
# 1. 本地执行自动发版脚本（自动升级版本号、更新 CHANGELOG 并打 Git 标签）
bun run release

# 2. 推送代码和 Tag 到 GitHub
git push origin main --follow-tags
```
推送后，GitHub Actions 会自动触发 [`.github/workflows/release.yml`](file:///.github/workflows/release.yml)，全自动完成：
- ✅ 类型校验与单元测试
- ✅ 生产环境打包（Chrome MV3、Firefox MV3、AMO 源码压缩包）
- ✅ 提取 CHANGELOG 创建 GitHub Release
- ✅ 自动调用 Chrome Web Store API 与 Firefox AMO API 提交审核！

---

## 六、常见问题排查 (FAQ)

### Q1: Chrome 提示 `Invalid credentials` 或 `Publisher not found`？
- **原因**：服务账号在 Chrome Web Store 控制台中未关联或未授予发布权限。
- **解决方法**：前往 [Chrome Developer Dashboard -> Account -> API Access](https://chrome.google.com/webstore/devconsole/)，确保关联了正确的 Google Cloud 项目，并在服务账号行点击了“授予权限 (Grant Access)”。授权可能有 5-10 分钟缓存延迟，请稍后重试。

### Q2: 提示 `Private key format error`？
- **原因**：私钥中的换行符丢失或引号未闭合。
- **解决方法**：在 `.env.submit` 中，确保私钥用双引号包裹 `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY="..."`，且保留 `\n` 或直接完整复制 JSON 中的 `private_key` 字段。

### Q3: Firefox AMO 提示 `Version already exists`？
- **原因**：当前 `package.json` 中的版本号已经在 AMO 上提交过。
- **解决方法**：请使用 `bun run release` 晋升到新的版本号（如偶数发布版本），确保版本号递增。

### Q4: 忘记将 `.env.submit` 加入忽略规则会有泄露风险吗？
- **解答**：项目的 `.gitignore` 已对 `.env*` 进行了全局忽略，同时特意放行了模板文件 `!.env.submit.example`。你可以随时运行 `git status` 确认 `.env.submit` 绝不会出现在未跟踪文件列表中。
