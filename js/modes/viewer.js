// 전체 악보 보기: 재생, 손별 음소거, 손 가리기, 지우기, 숙련도 표시.

import { h, segmented } from '../ui.js';
import { engraveAll } from '../engraver.js';
import { playRange, stopPlayback, isPlaying } from '../audio.js';
import { buildFragment } from '../score.js';
import { hideHand } from './recall.js';

const heat = (s) => (s === null ? 'transparent' : `hsl(${Math.round(s * 130)} 62% 45% / .2)`);

export function mountViewer(root, ctx, params = {}) {
  const score = ctx.score;
  const opts = { speed: ctx.prefs['view.speed'] ?? 1, mute: 'none', hide: 'none', fade: 0, heat: !!ctx.prefs['view.heat'] };
  let selected = params.measure ?? ctx.range().from;
  let measureEls = [];
  let lastWidth = 0;
  let idMap = new Map();
  root.replaceChildren();

  const playBtn = h('button', { class: 'btn primary', onClick: togglePlay }, '▶ 재생');
  const where = h('span', { class: 'viewer-where' });
  const speedLabel = h('output', {}, `${Math.round(opts.speed * 100)}%`);
  const speed = h('input', {
    type: 'range', min: 30, max: 120, step: 5, value: Math.round(opts.speed * 100), 'aria-label': '재생 빠르기',
    onInput: (e) => {
      opts.speed = +e.target.value / 100;
      speedLabel.textContent = `${e.target.value}%`;
      ctx.setPref('view.speed', opts.speed);
    },
  });
  const pages = h('div', { class: 'viewer-pages' });
  const overlay = () => pages.querySelectorAll('.heat').forEach((e) => e.remove());

  const toolbar = h('div', { class: 'viewer-bar' },
    playBtn, where,
    h('label', { class: 'field' }, '빠르기 ', speed, speedLabel),
    score.isPiano ? control('소리', 'mute', [['none', '양손'], ['right', '오른손만'], ['left', '왼손만']]) : null,
    score.isPiano ? control('가리기', 'hide', [['none', '없음'], ['left', '왼손'], ['right', '오른손']]) : null,
    control('지우기', 'fade', [[0, '0'], [0.5, '50%'], [1, '100%']]),
    h('label', { class: 'check' }, h('input', {
      type: 'checkbox', checked: opts.heat, onChange: (e) => {
        opts.heat = e.target.checked;
        ctx.setPref('view.heat', opts.heat);
        paintHeat();
      },
    }), ' 숙련도 색'),
  );

  function control(label, key, options) {
    const holder = h('div', { class: 'field' }, label, ' ');
    const draw = () => {
      holder.replaceChildren(`${label} `, segmented(options, opts[key], (v) => {
        opts[key] = v;
        draw();
        if (key === 'hide' || key === 'fade') applyVisibility();
        if (key === 'mute' && isPlaying()) togglePlay();
      }));
    };
    draw();
    return holder;
  }

  root.append(toolbar, pages);

  function draw() {
    const width = pages.clientWidth;
    if (!width || Math.abs(width - lastWidth) < 40) return;
    lastWidth = width;
    const scale = width < 640 ? 30 : width < 1000 ? 36 : 40;
    const xml = buildFragment(score, 0, score.measures.length - 1);
    pages.innerHTML = engraveAll(xml, { widthPx: width, scale }).map((svg) => `<div class="sheet page">${svg}</div>`).join('');
    measureEls = [...pages.querySelectorAll('.measure')];
    idMap = new Map();
    for (const el of pages.querySelectorAll('.note')) idMap.set(el.id, el);
    applyVisibility();
    paintHeat();
    select(selected, false);
  }

  function applyVisibility() {
    for (const s of pages.querySelectorAll('.hand-hidden')) s.classList.remove('hand-hidden');
    pages.classList.remove('hand-hiding');
    if (opts.hide !== 'none') for (const sheet of pages.querySelectorAll('.sheet')) hideHand(sheet, opts.hide === 'left' ? 1 : 0);
    let i = 0;
    for (const el of idMap.values()) {
      // 난수 대신 고른 간격을 써서 다시 그려도 같은 음이 가려진다.
      el.classList.toggle('faded', opts.fade === 1 || (opts.fade > 0 && i % 2 === 0));
      i++;
    }
  }

  function paintHeat() {
    overlay();
    if (!opts.heat) return;
    const base = pages.getBoundingClientRect();
    measureEls.forEach((el, i) => {
      const s = ctx.progress.mastery(i);
      if (s === null) return;
      const r = el.getBoundingClientRect();
      pages.append(h('div', {
        class: 'heat',
        style: `left:${r.left - base.left}px;top:${r.top - base.top}px;width:${r.width}px;height:${r.height}px;background:${heat(s)}`,
      }));
    });
  }

  function select(i, scroll = true) {
    selected = i;
    for (const el of pages.querySelectorAll('.measure.current')) el.classList.remove('current');
    measureEls[i]?.classList.add('current');
    where.textContent = `${score.measures[i]?.number ?? i + 1}마디부터`;
    if (scroll) measureEls[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  pages.addEventListener('click', (e) => {
    const m = e.target.closest?.('.measure');
    if (!m) return;
    const i = measureEls.indexOf(m);
    if (i >= 0) select(i, false);
  });

  function togglePlay() {
    if (isPlaying()) { stopPlayback(); return; }
    const mute = { 1: opts.mute === 'left', 2: opts.mute === 'right' };
    playBtn.textContent = '■ 정지';
    playRange(score, selected, score.measures.length - 1, {
      speed: opts.speed, mute,
      onStart: (e) => { for (const id of e.ids) idMap.get(id)?.classList.add('playing'); },
      onOff: (e) => { for (const id of e.ids) idMap.get(id)?.classList.remove('playing'); },
      onMeasure: (m) => {
        const el = measureEls[m];
        if (!el) return;
        for (const c of pages.querySelectorAll('.measure.current')) c.classList.remove('current');
        el.classList.add('current');
        where.textContent = `${score.measures[m].number}마디`;
        const r = el.getBoundingClientRect();
        if (r.bottom > innerHeight - 40 || r.top < 80) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      },
      onEnd: () => {
        playBtn.textContent = '▶ 재생';
        for (const el of pages.querySelectorAll('.playing')) el.classList.remove('playing');
      },
    });
  }

  const observer = new ResizeObserver(() => draw());
  observer.observe(pages);
  ctx.onLeave(() => observer.disconnect());
  requestAnimationFrame(() => {
    draw();
    if (params.measure !== undefined) select(params.measure);
  });
}
