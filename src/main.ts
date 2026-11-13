import { createApp } from 'vue';
import { fontsource } from './adapters/fontsource.js';
import { indexedDbFileStore } from './adapters/indexeddb-file-store.js';
import { Session } from './app/session.js';
import App from './vue/App.vue';

const session = await Session.open({
  drafts: localStorage,
  files: indexedDbFileStore(),
  fonts: fontsource({ cache: localStorage }),
});
const mount = document.createElement('div');
document.body.prepend(mount);
createApp(App, { session }).mount(mount);
