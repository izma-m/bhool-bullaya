import { Game } from './game.js';
import { mount } from './ui.js';
import { store } from './store.js';

const boot = document.getElementById('boot');
document.body.dataset.s = 'menu';
store.subscribe(() => { document.body.dataset.s = store.get().screen; });
try {
  const game = new Game(document.getElementById('game'));
  mount(game);
  boot.remove();
  window.__game = game;               // handy for debugging in the console
} catch (err) {
  console.error(err);
  boot.innerHTML = '<b>Sorry!</b> Your browser could not start WebGL.<br>Try Chrome, Edge, Firefox or Safari with hardware acceleration on.';
}
