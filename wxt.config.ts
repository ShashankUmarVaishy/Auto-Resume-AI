import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'AutoResume AI',
    description: 'Manifest V3 Smart ATS AutoFill & Ingestion Copilot',
    version: '1.0.0',
    permissions: ['storage', 'activeTab', 'clipboardWrite', 'scripting'],
    host_permissions: ['<all_urls>'],
  },
});
