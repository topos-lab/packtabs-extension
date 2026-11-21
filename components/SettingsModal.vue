<script lang="ts" setup>
  import { AlertCircle, Copy, ExternalLink, Moon, Sun, SunMoon } from 'lucide-vue-next';
  import { computed, onMounted, ref, watch } from 'vue';

  import Modal from '~/components/ui/dialog/Modal.vue';
  import { Tooltip } from '~/components/ui/tooltip';
  import { useI18n } from '~/composables/useI18n';
  import { useSettings } from '~/composables/useSettings';
  import { useTheme } from '~/composables/useTheme';
  import { useToast } from '~/composables/useToast';
  import { getBrowserType } from '~/lib/utils';
  import type { LocaleMode, ThemeMode } from '~/types/Storage';

  const props = defineProps<{
    open: boolean;
  }>();

  const emit = defineEmits<{
    'update:open': [value: boolean];
  }>();

  const { t, localeMode, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const {
    openOnStartup: openOnStartupRef,
    maxHistoryGroups,
    initSettings,
    loadSettings,
    setOpenOnStartup,
    setMaxHistoryGroups,
  } = useSettings();

  const openOnStartup = computed({
    get: () => openOnStartupRef.value,
    set: (val: boolean) => {
      void setOpenOnStartup(val);
    },
  });

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent);
  const currentShortcut = ref(isMac ? 'Command + Shift + K' : 'Alt + Shift + K');

  const themeOptions: { mode: ThemeMode; labelKey: 'themeLight' | 'themeDark' | 'themeSystem' }[] = [
    { mode: 'light', labelKey: 'themeLight' },
    { mode: 'dark', labelKey: 'themeDark' },
    { mode: 'system', labelKey: 'themeSystem' },
  ];

  const localeOptions: { mode: LocaleMode; labelKey: 'langSystem' | 'langZhCN' | 'langZhTW' | 'langEn' }[] = [
    { mode: 'system', labelKey: 'langSystem' },
    { mode: 'zh_CN', labelKey: 'langZhCN' },
    { mode: 'zh_TW', labelKey: 'langZhTW' },
    { mode: 'en', labelKey: 'langEn' },
  ];

  const historyLimitOptions = [10, 25, 50, 100];

  async function loadShortcut() {
    try {
      if (typeof browser !== 'undefined' && browser.commands?.getAll) {
        const commands = await browser.commands.getAll();
        const targetCmd =
          commands.find((c) => c.name === 'open_dashboard') || commands.find((c) => c.name === '_execute_action');
        if (targetCmd?.shortcut) {
          currentShortcut.value = targetCmd.shortcut.split('+').join(' + ');
        } else if (targetCmd?.shortcut === '') {
          currentShortcut.value = isMac ? t('shortcutNotSetMac') : t('shortcutNotSet');
        }
      }
    } catch (err) {
      if (!String(err).includes('MockNotImplementedError')) {
        console.error('Failed to query extension commands:', err);
      }
    }
  }

  watch(
    () => props.open,
    (isOpen) => {
      if (isOpen) {
        void loadSettings();
        void loadShortcut();
      }
    }
  );

  onMounted(() => {
    void initSettings();
    void loadShortcut();
  });

  const toast = useToast();
  const browserType = computed(() => getBrowserType());

  const startupButtonLabel = computed(() => {
    if (browserType.value === 'firefox') {
      return t('openFirefoxStartupSettings');
    }
    if (browserType.value === 'edge') {
      return t('openEdgeStartupSettings');
    }
    return t('openChromeStartupSettings');
  });

  const startupTipDesc = computed(() => {
    if (browserType.value === 'firefox') {
      return t('startupSettingTipDescFirefox');
    }
    if (browserType.value === 'edge') {
      return t('startupSettingTipDescEdge');
    }
    return t('startupSettingTipDescChrome');
  });

  async function openShortcutSettings() {
    if (browserType.value === 'firefox') {
      try {
        await navigator.clipboard.writeText('about:addons');
        toast.add({
          severity: 'info',
          summary: t('firefoxSettingsCopiedTitle'),
          detail: t('firefoxShortcutSettingsCopiedDesc'),
          life: 6000,
        });
      } catch {
        toast.add({
          severity: 'info',
          summary: t('firefoxSettingsCopiedTitle'),
          detail: t('firefoxShortcutSettingsManualDesc'),
          life: 6000,
        });
      }
      return;
    }

    const url = browserType.value === 'edge' ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts';
    try {
      await browser.tabs.create({ url });
    } catch (err) {
      console.error('Failed to open shortcuts settings:', err);
    }
  }

  async function openOnStartupSettings() {
    if (browserType.value === 'firefox') {
      try {
        await navigator.clipboard.writeText('about:preferences#home');
        toast.add({
          severity: 'info',
          summary: t('firefoxSettingsCopiedTitle'),
          detail: t('firefoxStartupSettingsCopiedDesc'),
          life: 6000,
        });
      } catch {
        toast.add({
          severity: 'info',
          summary: t('firefoxSettingsCopiedTitle'),
          detail: t('firefoxStartupSettingsManualDesc'),
          life: 6000,
        });
      }
      return;
    }

    const url = browserType.value === 'edge' ? 'edge://settings/startHomeNTP' : 'chrome://settings/onStartup';
    try {
      await browser.tabs.create({ url });
    } catch (err) {
      console.error('Failed to open onStartup settings:', err);
    }
  }
</script>

<template>
  <Modal
    :open="open"
    :title="t('settings')"
    content-class="max-w-lg p-5"
    @update:open="emit('update:open', $event)">
    <div class="divide-y divide-zinc-100 dark:divide-zinc-700/50 text-xs text-zinc-600 dark:text-zinc-300">
      <!-- 1. Appearance / Theme Segmented Control -->
      <div class="flex items-center justify-between gap-3 py-2.5">
        <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ t('themeLabel') }}</span>
        <div
          class="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200/60 dark:border-zinc-700/60 text-xs shrink-0">
          <button
            v-for="opt in themeOptions"
            :key="opt.mode"
            type="button"
            :aria-pressed="theme === opt.mode"
            class="flex items-center gap-1 px-2 py-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all font-medium cursor-pointer"
            :class="
              theme === opt.mode
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            "
            @click="setTheme(opt.mode)">
            <Sun v-if="opt.mode === 'light'" class="h-3 w-3 text-amber-500" />
            <Moon v-else-if="opt.mode === 'dark'" class="h-3 w-3 text-zinc-600 dark:text-zinc-200" />
            <SunMoon v-else class="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span>{{ t(opt.labelKey) }}</span>
          </button>
        </div>
      </div>

      <!-- 2. Display Language -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 py-2.5">
        <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ t('languageLabel') }}</span>
        <div
          class="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200/60 dark:border-zinc-700/60 text-xs shrink-0">
          <button
            v-for="opt in localeOptions"
            :key="opt.mode"
            type="button"
            :aria-pressed="localeMode === opt.mode"
            class="px-2 py-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all font-medium cursor-pointer whitespace-nowrap"
            :class="
              localeMode === opt.mode
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            "
            @click="setLocale(opt.mode)">
            <span>{{ t(opt.labelKey) }}</span>
          </button>
        </div>
      </div>

      <!-- 3. Restore on Startup Toggle + Compact Prerequisite Banner -->
      <div class="py-2.5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ t('startupSettingLabel') }}</span>
            <p class="text-[10px] text-zinc-500 dark:text-zinc-400">
              {{ t('startupSettingDesc') }}
            </p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              v-model="openOnStartup"
              type="checkbox"
              role="switch"
              :aria-checked="openOnStartup"
              :aria-label="t('startupSettingLabel')"
              class="sr-only peer"
            >
            <div
              class="w-8 h-4.5 bg-zinc-200 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-[#222226] rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-3.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all motion-reduce:after:transition-none dark:border-zinc-600 peer-checked:bg-indigo-600" />
          </label>
        </div>

        <!-- Contextual tip when openOnStartup is enabled: compact horizontal strip -->
        <div
          v-if="openOnStartup"
          class="mt-2 px-3 py-2 rounded-lg bg-amber-50/70 dark:bg-zinc-900/60 border border-amber-200/80 dark:border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[11px]">
          <div class="flex items-start gap-2 min-w-0">
            <AlertCircle class="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p class="text-amber-900/85 dark:text-zinc-300 leading-snug">
              {{ startupTipDesc }}
            </p>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:text-amber-300 dark:border dark:border-amber-500/30 font-medium text-[11px] shadow-2xs transition-colors shrink-0 self-start sm:self-center cursor-pointer"
            @click="openOnStartupSettings">
            <span>{{ startupButtonLabel }}</span>
            <Copy v-if="browserType === 'firefox'" class="h-3 w-3" />
            <ExternalLink v-else class="h-3 w-3" />
          </button>
        </div>
      </div>

      <!-- 4. Max History Snapshots Retention Limit -->
      <div class="flex items-center justify-between gap-3 py-2.5">
        <div>
          <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ t('maxHistoryLabel') }}</span>
          <p class="text-[10px] text-zinc-500 dark:text-zinc-400">
            {{ t('maxHistoryDesc') }}
          </p>
        </div>
        <div
          class="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200/60 dark:border-zinc-700/60 text-xs shrink-0">
          <button
            v-for="limit in historyLimitOptions"
            :key="limit"
            type="button"
            :aria-pressed="maxHistoryGroups === limit"
            class="px-2 py-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all font-medium cursor-pointer tabular-nums"
            :class="
              maxHistoryGroups === limit
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            "
            @click="setMaxHistoryGroups(limit)">
            {{ limit }}
          </button>
        </div>
      </div>

      <!-- 6. Keyboard Shortcut -->
      <div class="flex items-center justify-between gap-3 pt-2.5 pb-0.5">
        <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ t('shortcutLabel') }}</span>
        <div class="flex items-center gap-2 shrink-0">
          <span
            class="font-mono text-[11px] bg-zinc-100 dark:bg-zinc-900/80 px-2 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200/60 dark:border-zinc-700/60">
            {{ currentShortcut }}
          </span>
          <Tooltip :content="browserType === 'firefox' ? t('copyFirefoxAddonsTitle') : t('openShortcutSettingsTitle')">
            <button
              type="button"
              class="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded font-medium cursor-pointer"
              @click="openShortcutSettings">
              {{ t('change') }}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  </Modal>
</template>
