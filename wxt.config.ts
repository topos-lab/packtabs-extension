import fs from 'node:fs';

import { defineConfig } from 'wxt';

const firefoxWindowsBinary = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const hasFirefoxBinary = process.platform === 'win32' && fs.existsSync(firefoxWindowsBinary);

const firefoxProfileDir = './.wxt/firefox-data';
if (!fs.existsSync(firefoxProfileDir)) {
  fs.mkdirSync(firefoxProfileDir, { recursive: true });
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  webExt: {
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
    firefoxProfile: firefoxProfileDir,
    keepProfileChanges: true,
    firefoxPref: {
      'browser.startup.page': 1,
    },
    ...(hasFirefoxBinary
      ? {
          binaries: {
            firefox: firefoxWindowsBinary,
          },
        }
      : {}),
  },
  manifest: ({ browser: targetBrowser }) => {
    const isFirefox = targetBrowser === 'firefox';

    return {
      default_locale: 'en',
      name: '__MSG_extName__',
      description: '__MSG_extDescription__',
      version: '1.0.0',
      permissions: [
        'tabs', // Required for capturing, querying, and restoring tabs
        'storage', // Required for persisting tab groups to local storage
        ...(isFirefox ? [] : ['favicon']), // Chrome MV3 _favicon protocol
      ],
      ...(isFirefox
        ? {
            browser_specific_settings: {
              gecko: {
                id: 'packtabs@topos-lab.github.io',
                strict_min_version: '109.0',
                data_collection_permissions: {
                  required: ['none'],
                },
              },
            },
          }
        : {}),
      action: {
        default_title: '__MSG_actionTitle__',
        default_icon: {
          '16': '/icon/16.png',
          '32': '/icon/32.png',
          '48': '/icon/48.png',
          '96': '/icon/96.png',
          '128': '/icon/128.png',
        },
      },
      icons: {
        '16': '/icon/16.png',
        '32': '/icon/32.png',
        '48': '/icon/48.png',
        '96': '/icon/96.png',
        '128': '/icon/128.png',
      },
      commands: {
        open_dashboard: {
          suggested_key: {
            default: 'Alt+Shift+K',
            mac: 'Command+Shift+K',
          },
          description: '__MSG_commandOpenDashboard__',
        },
      },
    };
  },
});
