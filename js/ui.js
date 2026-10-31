// 화면 공통 도구: DOM 생성, 조각 악보 그리기, 음표 가리기, 건반, 문제 틀.

import { buildFragment } from './score.js';
import { engraveFragment } from './engraver.js';
import { playPitch, playRange, stopPlayback, isPlaying } from './audio.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const noteEl = (root, id) => root.querySelector(`[id="${id}"]`);

// 악보 조각 하나를 그린 상자를 만든다. showNumbers가 아니면 마디 번호를 숨겨 답이 새지 않게 한다.
export function fragmentBox(score, from, to, { transform, key, scale, showNumbers = false, cls = '', noTime = false, noWords = false, hand = 0 } = {}) {
  const box = h('div', { class: `sheet ${showNumbers ? '' : 'no-numbers'} ${cls}` });
  const xml = buildFragment(score, from, to, { transform, noTime, noWords, hand });
  const cacheKey = transform ? null : (key || `${score.id}:${from}-${to}${noTime ? ':nt' : ''}${noWords ? ':nw' : ''}${hand ? `:h${hand}` : ''}`);
  box.innerHTML = engraveFragment(xml, { key: cacheKey, scale });
  box.dataset.from = from;
  box.dataset.to = to;
  return box;
}

// 음표를 숨긴다. 머리·임시표·기둥까지 지우고 음높이가 드러나지 않게 오선 위쪽에 표시를 단다.
// 화음 안의 음을 모두 가리는 호출자가 쓴다. 기둥·꼬리 길이와 덧줄 개수도 음높이를 알려 주므로 함께 숨긴다.
export function blankNote(box, id, label) {
  const el = noteEl(box, id);
  if (!el) return null;
  el.classList.add('blanked');
  el.closest('.chord')?.classList.add('blanked-chord');
  const head = el.querySelector('.notehead') || el;
  const staff = el.closest('.staff');
  return label === undefined ? null : addMarker(box, head, staff, label);
}

// 덧줄 개수도 음높이를 알려 준다. 가려진 음에는 필요하고 보이는 음에는 필요 없는 덧줄만 지운다.
// 음이 반대 오선 쪽으로 걸쳐 그려진 경우(교차 오선)도 위치로 판단한다. 모두 가린 뒤에 한 번 부른다.
export function hideBlankedLedgers(box) {
  const heads = (sel) => [...box.querySelectorAll(sel)].map((n) => {
    const r = n.getBoundingClientRect();
    return { l: r.left, r: r.right, y: (r.top + r.bottom) / 2 };
  });
  const blanked = heads('.note.blanked .notehead');
  const visible = heads('.note:not(.blanked) .notehead');
  const tol = 6;
  for (const path of box.querySelectorAll('.ledgerLines path')) {
    const b = path.getBoundingClientRect();
    const y = (b.top + b.bottom) / 2;
    const above = path.closest('.ledgerLines').classList.contains('above');
    const staff = path.closest('.staff');
    const sr = (staff.querySelector(':scope > path') ?? staff).getBoundingClientRect();
    const edge = above ? sr.top : sr.bottom;
    const needs = (list) => list.some((hd) => hd.r >= b.left && hd.l <= b.right
      && (above ? y >= hd.y - tol && y <= edge + tol : y <= hd.y + tol && y >= edge - tol));
    if (needs(blanked) && !needs(visible)) path.style.visibility = 'hidden';
  }
}

export function revealNote(box, id, cls) {
  const el = noteEl(box, id);
  if (!el) return;
  el.classList.remove('blanked');
  el.closest('.chord')?.classList.remove('blanked-chord');
  if (cls) el.classList.add(cls);
  for (const line of box.querySelectorAll('.ledgerLines path')) line.style.visibility = '';
}

function addMarker(box, head, staff, label) {
  box.classList.add('has-markers');
  const host = box.getBoundingClientRect();
  const r = head.getBoundingClientRect();
  const lines = staff?.querySelector(':scope > path')?.getBoundingClientRect();
  const staffRect = lines && lines.height ? lines : staff.getBoundingClientRect();
  const marker = h('div', { class: 'blank-marker' }, h('span', {}, label));
  const x = ((r.left + r.width / 2 - host.left) / host.width) * 100;
  marker.style.left = `${x}%`;
  marker.style.top = `${((staffRect.top - host.top) / host.height) * 100}%`;
  marker.style.height = `${(Math.max(staffRect.height, 18) / host.height) * 100}%`;
  box.append(marker);
  return marker;
}

// 검은 건반 중심이 흰 건반 경계에서 벗어나는 정도(흰 건반 폭 단위). C♯ D♯ F♯ G♯ A♯ 순.
const BLACK_SHIFT = { 1: -0.07, 3: 0.07, 6: -0.1, 8: 0, 10: 0.1 };

// 건반 입력. 범위를 답 주변으로 잡되 위치가 답을 알려주지 않게 호출 쪽에서 흔든다.
export function pianoKeys(low, high, onPress) {
  const BLACK = new Set([1, 3, 6, 8, 10]);
  while (BLACK.has(low % 12)) low--;
  while (BLACK.has(high % 12)) high++;
  const whites = [];
  for (let m = low; m <= high; m++) if (!BLACK.has(m % 12)) whites.push(m);
  const wrap = h('div', { class: 'piano', role: 'group', 'aria-label': '건반으로 답하기' });
  wrap.style.setProperty('--keys', whites.length);
  // 실제 피아노 비율: 흰 건반 폭 23.5mm, 보이는 길이 약 150mm. 가로가 달라져도 세로가 같은 비율로 따라간다.
  wrap.style.setProperty('--ar', ((whites.length * 23.5) / 150).toFixed(4));
  const w = 100 / whites.length;
  const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const nameOf = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
  const press = (m, key) => {
    playPitch(m);
    onPress(m, key);
  };
  whites.forEach((m, i) => {
    const key = h('button', {
      class: 'key white', 'aria-label': nameOf(m), 'data-midi': m, style: `left:${i * w}%;width:${w}%`,
      onClick: () => press(m, key),
    }, m % 12 === 0 ? h('small', {}, nameOf(m)) : null);
    wrap.append(key);
  });
  for (let m = low; m <= high; m++) {
    if (!BLACK.has(m % 12)) continue;
    const i = whites.indexOf(m - 1);
    if (i < 0) continue;
    // 검은 건반은 폭이 흰 건반의 약 52%이고, 두 개·세 개 묶음의 바깥쪽 건반은 실제처럼 조금씩 바깥으로 치우친다.
    const bw = w * 0.52;
    const center = (i + 1 + BLACK_SHIFT[m % 12]) * w;
    const key = h('button', {
      class: 'key black', 'aria-label': nameOf(m), 'data-midi': m, style: `left:${center - bw / 2}%;width:${bw}%`,
      onClick: () => press(m, key),
    });
    wrap.append(key);
  }
  // 좁은 화면에서는 건반이 가로로 스크롤된다. 정답 위치가 새지 않게 가운데에서 시작한다.
  const scroller = h('div', { class: 'piano-scroll' }, wrap);
  scroller.style.setProperty('--keys', whites.length);
  requestAnimationFrame(() => { scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2; });
  return scroller;
}

export function listenButton(score, from, to, label = '▶ 듣기', opts = {}) {
  const btn = h('button', {
    class: 'btn ghost',
    onClick: () => {
      if (isPlaying() && btn.classList.contains('on')) { stopPlayback(); return; }
      btn.classList.add('on');
      playRange(score, from, to, { speed: opts.speed ?? 0.85, onEnd: () => btn.classList.remove('on') });
    },
  }, label);
  return btn;
}

// 모든 문제 화면의 뼈대.
export function quizFrame(root, ctx, { title, prompt, controls }) {
  stopPlayback();
  root.replaceChildren();
  const body = h('div', { class: 'quiz-body' });
  const actions = h('div', { class: 'quiz-actions' });
  const feedback = h('div', { class: 'feedback', role: 'status', 'aria-live': 'polite' });
  const promptEl = h('p', { class: 'quiz-prompt' }, prompt);
  root.append(
    h('div', { class: 'quiz-head' },
      h('div', {}, ctx.mixLabel ? h('span', { class: 'eyebrow' }, ctx.mixLabel) : null, h('h2', {}, title), promptEl),
      controls ? h('div', { class: 'quiz-controls' }, controls) : null),
    body, feedback, actions,
  );
  return {
    body, actions, promptEl,
    say(text, tone = '') {
      feedback.textContent = text;
      feedback.className = `feedback ${tone}`;
    },
    nextButton(label = '다음 문제 →') {
      return h('button', { class: 'btn primary', onClick: () => ctx.next() }, label);
    },
  };
}

export function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'segmented', role: 'group' });
  for (const [v, label] of options) {
    wrap.append(h('button', {
      class: v === value ? 'on' : '', 'aria-pressed': v === value ? 'true' : 'false', onClick: () => onChange(v),
    }, label));
  }
  return wrap;
}

export function emptyNote(root, text) {
  root.replaceChildren(h('div', { class: 'empty' }, text));
}

export const mLabel = (score, i) => `${score.measures[i]?.number ?? i + 1}마디`;
