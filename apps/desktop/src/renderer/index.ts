import { App } from './app';

declare global {
  interface Window {
    pmOs: any;
  }
}

const app = new App();
app.init();
