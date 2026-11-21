import './style.css';

import type { Component } from 'vue';

import { applyCachedTheme } from '~/composables/useTheme';
import { bootstrap } from '~/utils/init-app';

import App from './App.vue';

// Initialize cached theme before mount and mount the Vue application
applyCachedTheme();
bootstrap(App as Component).mount('#app');
