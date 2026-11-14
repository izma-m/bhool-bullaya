// React UI (no JSX, no build step: htm tagged templates). Reads the shared store, calls the Game API.
import React, { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import { store } from './store.js';
import { LEVELS } from './game.js';
import { sound } from './audio.js';

const html = htm.bind(React.createElement);
const useStore = () => useSyncExternalStore(store.subscribe, store.get);

function Menu({ s, game }) {
  return html`<div className="screen menu">
    <header><h1>Bhool Bulayya</h1><p>Follow Jugnoo through the glowing maze. Pick your level.</p></header>
    <div className="levels">
      ${['beg', 'adv'].map((k) => html`<button className="lvl-btn ${k}" key=${k} onClick=${() => game.start(k)}>
        <b>${LEVELS[k].name}</b>
        <span>${k === 'beg' ? '2 imposters · relaxed pace · guide arrow on' : '3 imposters · full speed · for the brave'}</span>
        <em>Best ${String(s.best[k]).padStart(5, '0')}</em></button>`)}
    </div>
  </div>`;
}

function Key({ c }) { return html`<span className="key">${c}</span>`; }
function HowTo({ s, game }) {
  return html`<div className="screen how">
    <h2>${LEVELS[s.level].name} · How to win</h2>
    <div className="steps">
      <div className="step"><svg viewBox="0 0 120 80"><g className="k"><rect x="44" y="6" width="30" height="30" rx="7"/><rect x="8" y="42" width="30" height="30" rx="7"/><rect x="44" y="42" width="30" height="30" rx="7"/><rect x="80" y="42" width="30" height="30" rx="7"/></g>
        <g className="t" textAnchor="middle"><text x="59" y="28">W</text><text x="23" y="64">A</text><text x="59" y="64">S</text><text x="95" y="64">D</text></g></svg>
        <b>1 · Fly</b><p>${s.touch ? 'Left thumb moves, right thumb looks.' : html`<${Key} c="W"/><${Key} c="A"/><${Key} c="S"/><${Key} c="D"/> to move, mouse to look.`}</p></div>
      <div className="step"><svg viewBox="0 0 120 80"><g fill="#ffe14d"><circle cx="22" cy="40" r="9"/><circle cx="60" cy="40" r="9"/><circle cx="98" cy="40" r="9"/></g><g fill="#ffe14d" opacity=".25"><circle cx="22" cy="40" r="20"/><circle cx="60" cy="40" r="20"/><circle cx="98" cy="40" r="20"/></g></svg>
        <b>2 · Eat every orb</b><p>Fly into the glowing orbs. Clear them all to win.</p></div>
      <div className="step"><svg viewBox="0 0 120 80"><rect x="30" y="10" width="40" height="56" rx="20" fill="#ff2e63"/><rect x="48" y="24" width="30" height="16" rx="8" fill="#b8f2ff"/><path d="M82 56l22-30" stroke="#eee" strokeWidth="6" strokeLinecap="round"/><circle cx="104" cy="60" r="12" fill="#dfe7ff" stroke="#22d6ff" strokeWidth="4"/></svg>
        <b>3 · Dodge imposters</b><p>Touching one costs a life. A Power Coin lets you flip them into coins!</p></div>
    </div>
    <button className="go" onClick=${() => game.begin()}>Let’s fly! ${s.touch ? '' : html`<small>(Enter)</small>`}</button>
  </div>`;
}

function Hud({ s, game }) {
  const lvl = Math.floor(s.score / 500) + 1, xp = (s.score % 500) / 5, done = s.total - s.orbsLeft;
  return html`<div>
    <div className="hud">
      <div className="card score"><div className="num">${String(s.score).padStart(5, '0')}</div>
        <div className="lives">${Array.from({ length: Math.max(0, s.lives) }, (_, i) => html`<i className="orb" key=${i}></i>`)}</div>
        <div className="lv"><b>LV ${lvl}</b><div className="bar"><i style=${{ width: xp + '%' }}></i></div></div></div>
      <div className="card prog"><span>ORBS</span><b>${done}/${s.total}</b><div className="bar wide"><i style=${{ width: (done / s.total) * 100 + '%' }}></i></div>${s.captured ? html`<small>Flipped ${s.captured}</small>` : null}</div>
      <div className="btns">
        <button title="Music" onClick=${() => { sound.init(); store.set({ music: sound.toggle() }); }}>${s.music ? '🔊' : '🔇'}</button>
        <button title="Camera (V)" onClick=${() => game.setView(1 - s.view)}>🎥</button>
        <button title="Pause (P)" onClick=${() => game.pause()}>⏸</button>
      </div>
    </div>
    ${s.power > 0 ? html`<div className="power"><span>POWER COIN</span><div className="bar wide"><i style=${{ width: (s.power / s.powerMax) * 100 + '%' }}></i></div></div>` : null}
    <div className="danger" style=${{ opacity: s.danger }}></div>
    ${s.toast ? html`<div className="toast ${s.toast.kind}" key=${s.toast.id}>${s.toast.text}</div>` : null}
    ${s.hint ? html`<div className="hintbar" key=${s.hint.id}>${s.hint.text}</div>` : null}
    ${s.guideOn ? html`<div className="guide" title="Points to the nearest orb (G)" style=${{ transform: `rotate(${s.guide}rad)` }}>▲</div>` : null}
    <div className="cross"></div>
  </div>`;
}

function Pause({ s, game }) {
  return html`<div className="screen pause"><div className="panel"><h2>Paused</h2>
    <button className="go" onClick=${() => game.resume()}>Resume</button>
    <div className="row"><span>Music</span><button onClick=${() => { sound.init(); store.set({ music: sound.toggle() }); }}>${s.music ? 'On' : 'Off'}</button></div>
    <div className="row"><span>Graphics</span><div className="seg">${['auto', 'high', 'low'].map((q) => html`<button key=${q} className=${s.quality === q ? 'on' : ''} onClick=${() => game.setQuality(q)}>${q}</button>`)}</div></div>
    <div className="row"><span>Camera</span><button onClick=${() => game.setView(1 - s.view)}>${s.view ? 'Third person' : 'First person'}</button></div>
    <div className="row"><span>Guide arrow</span><button onClick=${() => game.toggleGuide()}>${s.guideOn ? 'On' : 'Off'}</button></div>
    <button className="ghost" onClick=${() => game.toMenu()}>Main menu</button></div></div>`;
}

function End({ s, game }) {
  const lvl = Math.floor(s.score / 500) + 1;
  return html`<div className="screen end"><div className="panel">
    <h2>${s.won ? 'Maze cleared! 🎉' : 'Game over'}</h2>
    <div className="big">${String(s.score).padStart(5, '0')}</div>
    ${s.newBest ? html`<div className="newbest">New best score!</div>` : html`<p>Best ${String(s.best[s.level]).padStart(5, '0')}</p>`}
    <p>${LEVELS[s.level].name} · Level ${lvl} · Imposters flipped ${s.captured}</p>
    <button className="go" onClick=${() => game.retry()}>Play again</button>
    <button className="ghost" onClick=${() => game.toMenu()}>Main menu</button></div></div>`;
}

function App({ game }) {
  const s = useStore();
  return html`<${React.Fragment}>
    ${s.screen === 'menu' ? html`<${Menu} s=${s} game=${game}/>` : null}
    ${s.screen === 'howto' ? html`<${HowTo} s=${s} game=${game}/>` : null}
    ${s.screen === 'play' || s.screen === 'paused' ? html`<${Hud} s=${s} game=${game}/>` : null}
    ${s.screen === 'paused' ? html`<${Pause} s=${s} game=${game}/>` : null}
    ${s.screen === 'over' ? html`<${End} s=${s} game=${game}/>` : null}
    ${s.screen === 'menu' ? html`<button className="snd" onClick=${() => { sound.init(); store.set({ music: sound.toggle() }); }}>${s.music ? '🔊' : '🔇'}</button>` : null}
  <//>`;
}

export function mount(game) { createRoot(document.getElementById('ui')).render(html`<${App} game=${game}/>`); }
