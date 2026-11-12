import { createApp } from 'vue';
import { Session } from './app/session.js';
import App from './vue/App.vue';

const session = await Session.open();
const mount = document.createElement('div');
document.body.prepend(mount);
createApp(App, { session }).mount(mount);
