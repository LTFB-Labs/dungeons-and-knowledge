// @ts-check
// D&K inside LevAcademy: the shell loads this module in its sandboxed frame and calls mount().
// The game is the same as when it is opened alone (index.html). It keeps nothing in the child's profile yet.
import { defineApp } from '../core/academy-core/app.js';
import { startGame, FONTS } from './game.js';

export default defineApp({
  id: 'dungeons-and-knowledge',
  name: 'D&K: Подземия и знания',
  description: 'Подземие от кубчета на ходове: отваряй сандъци със задачи, отговаряй на пазителя и излез в горния свят.',
  icon: 'icon.svg',
  route: 'dungeons-and-knowledge',
  contract: 2,
  permissions: ['settings'],

  async mount(el) {
    document.documentElement.lang = 'bg';
    document.title = 'D&K: Подземия и знания';
    const link = (attrs) => document.head.append(Object.assign(document.createElement('link'), attrs));
    link({ rel: 'stylesheet', href: FONTS });
    link({ rel: 'stylesheet', href: new URL('game.css', import.meta.url).href });
    document.head.append(Object.assign(document.createElement('meta'), { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }));
    await startGame(el);
  },
});
