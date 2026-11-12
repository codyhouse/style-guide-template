// Opens the session (library, preset, the browser's saved draft) and mounts the app.
import { Session } from './app/session.js';
import { App } from './ui/app.js';

const app = new App();
app.session = await Session.open();
document.body.prepend(app);
