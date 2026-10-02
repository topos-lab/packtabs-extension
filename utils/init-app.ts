import { createPinia } from 'pinia';
import type { Component } from 'vue';
import { createApp } from 'vue';

export function bootstrap(RootComponent: Component) {
  const app = createApp(RootComponent);
  const pinia = createPinia();

  app.use(pinia);

  // Global Vue error handler
  app.config.errorHandler = (err, _instance, info) => {
    console.error('PackTabs global error:', err, info);
  };

  return app;
}
