<script lang="ts" setup>
  import { AlertCircle, Copy, ExternalLink, Moon, Sun, SunMoon } from 'lucide-vue-next';
  import { computed, onMounted, ref, watch } from 'vue';

  import { Button } from '~/components/ui/button';
  import Modal from '~/components/ui/dialog/Modal.vue';
  import { useI18n } from '~/composables/useI18n';
  import { useTheme } from '~/composables/useTheme';
  import { useToast } from '~/composables/useToast';
  import { getBrowserType } from '~/lib/utils';
  import { settingsStorage } from '~/types/Storage';

  const props = defineProps<{
    open: boolean;
  }>();

  const emit = defineEmits<{
    'update:open': [value: boolean];
  }>();

  const { t, localeMode, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();

  const openOnStartup = ref(false);
  const closeWindowAfterSave = ref(true);
  const currentShortcut = ref('Alt + Shift + K');

  async function loadShortcut() {
    try {
      if (typeof browser !== 'undefined' && browser.commands?.getAll) {
        const commands = await browser.commands.getAll();
        const targetCmd =
          commands.find((c) => c.name === 'open_dashboard') || commands.find((c) => c.name === '_execute_action');
        if (targetCmd?.shortcut) {
          currentShortcut.value = targetCmd.shortcut.split('+').join(' + ');
        } else if (targetCmd?.shortcut === '') {
          currentShortcut.value = t('shortcutNotSet');
        }
      }
    } catch (err) {
      if (!String(err).includes('MockNotImplementedError')) {
        console.error('Failed to query extension commands:', err);
      }
    }
  }

  async function loadSettings() {
    try {
      const settings = await settingsStorage.getValue();
      openOnStartup.value = settings.openOnStartup ?? false;
      closeWindowAfterSave.value = settings.autoCloseAfterSave ?? true;
    } catch (err) {
      console.error('Failed to load settings in SettingsModal:', err);
    }
  }

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
        await navigator.clipboard.writeText('about:preferences#general');
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

  watch(
    () => props.open,
    (isOpen) => {
      if (isOpen) {
        void loadSettings();
        void loadShortcut();
      }
    }
  );

  watch(openOnStartup, async (newVal) => {
    try {
      const current = await settingsStorage.getValue();
      if (current.openOnStartup !== newVal) {
        await settingsStorage.setValue({
          ...current,
          openOnStartup: newVal,
        });
      }
    } catch (err) {
      console.error('Failed to persist openOnStartup:', err);
    }
  });

  watch(closeWindowAfterSave, async (newVal) => {
    try {
      const current = await settingsStorage.getValue();
      if (current.autoCloseAfterSave !== newVal) {
        await settingsStorage.setValue({
          ...current,
          autoCloseAfterSave: newVal,
        });
      }
    } catch (err) {
      console.error('Failed to persist autoCloseAfterSave:', err);
    }
  });

  onMounted(() => {
    void loadSettings();
    void loadShortcut();
  });
</script>

<template>
  <Modal
    :open="open"
    :title="t('settings')"
    :description="t('settingsDesc')"
    @update:open="emit('update:open', $event)">
    <div class="space-y-4 py-1 text-xs text-zinc-600 dark:text-zinc-300">
      <!-- 1. Appearance / Theme Segmented Control -->
      <div class="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ t('themeLabel') }}</span>
          <p class="text-[10px] text-zinc-500 dark:text-zinc-400">
            {{ t('themeDesc') }}
          </p>
        </div>
        <div
          class="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-1 rounded-md transition-all font-medium cursor-pointer"
            :class="
              theme === 'light'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            "
            @click="setTheme('light')">
            <Sun class="h-3 w-3 text-amber-500" />
            <span>{{ t('themeLight') }}</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-1 rounded-md transition-all font-medium cursor-pointer"
            :class="
              theme === 'dark'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            "
            @click="setTheme('dark')">
            <Moon class="h-3 w-3 text-zinc-100" />
            <span>{{ t('themeDark') }}</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-1 rounded-md transition-all font-medium cursor-pointer"
            :class="
              theme === 'system'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            "
            @click="setTheme('system')">
            <SunMoon class="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span>{{ t('themeSystem') }}</span>
          </button>
        </div>
      </div>

      <!-- 2. Display Language -->
      <div class="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ t('languageLabel') }}</span>
          <p class="text-[10px] text-zinc-500 dark:text-zinc-400">
            {{ t('languageDesc') }}
          </p>
        </div>
        <div
          class="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
          <button
            type="button"
            class="px-2 py-1 rounded-md transition-all font-medium cursor-pointer"
            :class="
              localeMode === 'system'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            "
            @click="setLocale('system')">
            <span>{{ t('langSystem') }}</span>
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded-md transition-all font-medium cursor-pointer"
            :class="
              localeMode === 'zh_CN'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            "
            @click="setLocale('zh_CN')">
            <span>{{ t('langZhCN') }}</span>
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded-md transition-all font-medium cursor-pointer"
            :class="
              localeMode === 'zh_TW'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            "
            @click="setLocale('zh_TW')">
            <span>{{ t('langZhTW') }}</span>
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded-md transition-all font-medium cursor-pointer"
            :class="
              localeMode === 'en'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            "
            @click="setLocale('en')">
            <span>{{ t('langEn') }}</span>
          </button>
        </div>
      </div>

      <!-- 3. Restore on Startup Toggle + Deep Link Contextual Guidance -->
      <div class="py-1.5 border-b border-zinc-100 dark:border-zinc-800">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ t('startupSettingLabel') }}</span>
            <p class="text-[10px] text-zinc-500 dark:text-zinc-400">
              {{ t('startupSettingDesc') }}
            </p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input v-model="openOnStartup" type="checkbox" class="sr-only peer">
            <div
              class="w-8 h-4.5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-3.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-zinc-600 peer-checked:bg-indigo-600" />
          </label>
        </div>

        <!-- Contextual tip when openOnStartup is enabled: required prerequisite -->
        <div
          v-if="openOnStartup"
          class="mt-2.5 p-3 rounded-lg bg-amber-50/70 dark:bg-zinc-800/60 border border-amber-200/80 dark:border-zinc-700/80 text-[11px] space-y-2">
          <div class="flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-400">
            <AlertCircle class="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{{ t('startupSettingTipTitle') }}</span>
          </div>
          <p class="text-amber-900/80 dark:text-zinc-400 leading-relaxed text-[11px]">
            {{ t('startupSettingTipDesc') }}
          </p>
          <div class="pt-0.5">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:text-amber-300 dark:border dark:border-amber-500/30 font-medium text-[11px] shadow-2xs transition-colors cursor-pointer"
              @click="openOnStartupSettings">
              <span>{{ startupButtonLabel }}</span>
              <Copy v-if="browserType === 'firefox'" class="h-3 w-3" />
              <ExternalLink v-else class="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <!-- 4. Close Window After Save Toggle -->
      <div class="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ t('closeWindowAfterSave') }}</span>
          <p class="text-[10px] text-zinc-500 dark:text-zinc-400">
            {{ t('closeWindowAfterSaveDesc') }}
          </p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input v-model="closeWindowAfterSave" type="checkbox" class="sr-only peer">
          <div
            class="w-8 h-4.5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-3.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-zinc-600 peer-checked:bg-indigo-600" />
        </label>
      </div>

      <!-- 5. Keyboard Shortcut -->
      <div class="flex items-center justify-between py-1.5">
        <div>
          <span class="text-zinc-700 dark:text-zinc-300 font-medium">{{ t('shortcutLabel') }}</span>
          <p class="text-[10px] text-zinc-500 dark:text-zinc-400">
            {{ t('shortcutDesc') }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="font-mono text-[11px] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200/60 dark:border-zinc-700/60">
            {{ currentShortcut }}
          </span>
          <button
            type="button"
            class="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium cursor-pointer"
            :title="browserType === 'firefox' ? 'Copy about:addons' : 'Open Shortcut Settings'"
            @click="openShortcutSettings">
            {{ t('change') }}
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <Button size="sm" variant="outline" @click="emit('update:open', false)">
        {{ t('close') }}
      </Button>
    </template>
  </Modal>
</template>
