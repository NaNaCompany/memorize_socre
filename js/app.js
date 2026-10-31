// 앱 뼈대: 악보 올리기와 보관함, 화면 전환, 연습 구간 관리.

import { parseScore, readScoreFile } from './score.js';
import { engraverReady } from './engraver.js';
import { stopPlayback } from './audio.js';
import { Progress, loadLibrary, saveLibrary, loadPrefs, savePrefs, putXml, getXml, deleteXml } from './store.js';
import { h, sample } from './ui.js';
import { mountOrder } from './modes/order.js';
import { mountBlank } from './modes/blank.js';
import { mountExpression } from './modes/expression.js';
import { mountNext, mountListen, mountLocate } from './modes/flash.js';
import { mountHand, mountFade } from './modes/recall.js';
import { mountHands } from './modes/hands.js';
import { mountConfusion, mountTell } from './modes/confusion.js';
import { mountViewer } from './modes/viewer.js';
import { mountDashboard } from './modes/dashboard.js';

// data/ 폴더에 파일이 있을 때만 예제로 보인다. 저장소에는 포함하지 않는다.
const SAMPLES = [
  {
    id: 'rachmaninoff-op39-no6', file: 'data/rachmaninoff-op39-no6.musicxml',
    title: '에튀드 타블로 Op. 39 No. 6', composer: '라흐마니노프',
    note: '곡은 1917년 출판된 퍼블릭 도메인 작품입니다. 악보 파일은 사용자가 구한 전사본이며 출판본과 대조 검수되지 않았습니다.',
  },
  {
    id: 'bartok-allegro-barbaro', file: 'data/bartok-allegro-barbaro.musicxml',
    title: 'Allegro barbaro, Sz. 49', composer: '바르톡',
    note: '곡은 1918년 출판된 퍼블릭 도메인 작품입니다. 악보 파일은 사용자가 구한 전사본이며 출판본과 대조 검수되지 않았습니다.',
  },
];

const MODES = [
  { id: 'measure', group: '순서', title: '마디 퍼즐', desc: '뒤섞인 마디끼리 자리를 바꿔 순서 맞추기', mount: (r, c) => mountOrder(r, c, 'measure'), mix: true },
  { id: 'phrase', group: '순서', title: '악절 순서', desc: '4마디 악절의 순서 맞추기', mount: (r, c) => mountOrder(r, c, 'phrase'), mix: true },
  { id: 'next', group: '순서', title: '다음 마디 고르기', desc: '이 마디 다음은 어느 마디인가', mount: mountNext, mix: true },
  { id: 'blank', group: '세부', title: '음표 빈칸', desc: '가려진 음을 건반으로 답하기', mount: mountBlank, mix: true },
  { id: 'expression', group: '세부', title: '악상 고르기', desc: '가려진 악상을 객관식으로', mount: mountExpression, mix: true },
  { id: 'tell', group: '세부', title: '비슷한 마디 구별', desc: '닮은 두 마디 가려내기', mount: mountTell, mix: true },
  { id: 'hands', group: '세부', title: '짝이 되는 손 고르기', desc: '오른손을 보고 맞는 왼손을 4지선다로', mount: mountHands, mix: true, piano: true },
  { id: 'listen', group: '귀와 위치', title: '듣고 찾기', desc: '소리와 같은 악보 고르기', mount: mountListen, mix: true },
  { id: 'locate', group: '귀와 위치', title: '위치 맞추기', desc: '이 마디가 곡의 어디인지', mount: mountLocate, mix: true },
  { id: 'hand', group: '떠올리기', title: '한 손 가리기', desc: '가린 손을 떠올리고 확인', mount: mountHand, piano: true },
  { id: 'fade', group: '떠올리기', title: '점점 지우기', desc: '음표를 조금씩 지우며 암기', mount: mountFade },
];

const MIX_LENGTH = 10;
const MAX_FILE = 30 * 1024 * 1024;
const main = document.getElementById('main');
const nav = document.getElementById('nav');
const toast = document.getElementById('toast');
const fileInput = document.getElementById('add-file');
const pieceTitle = document.getElementById('piece-title');

const state = { score: null, meta: null, progress: null, from: 0, to: 0, leave: [], library: [], report: [], busy: false };
const prefs = loadPrefs();

const isNarrow = () => matchMedia('(max-width: 720px)').matches;

function say(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(say.t);
  say.t = setTimeout(() => { toast.hidden = true; }, 4500);
}

function context(extra = {}) {
  return {
    score: state.score,
    progress: state.progress,
    prefs,
    setPref(k, v) { prefs[k] = v; savePrefs(prefs); },
    range: () => ({ from: state.from, to: state.to }),
    setRange,
    open: go,
    onLeave: (fn) => state.leave.push(fn),
    ...extra,
  };
}

function setRange(from, to) {
  const n = state.score.measures.length - 1;
  state.from = Math.max(0, Math.min(from, n));
  state.to = Math.max(state.from, Math.min(to, n));
  prefs[`range:${state.meta.id}`] = [state.from, state.to];
  savePrefs(prefs);
}

/* ---------- 올리기 ---------- */

const WRONG_TYPE = {
  pdf: 'PDF는 악보 그림이라 읽을 수 없습니다. 악보 인식(OMR) 프로그램으로 MusicXML로 바꾼 파일을 올려 주세요.',
  png: '사진은 읽을 수 없습니다. 악보 인식(OMR) 프로그램으로 MusicXML로 바꾼 파일을 올려 주세요.',
  jpg: '사진은 읽을 수 없습니다. 악보 인식(OMR) 프로그램으로 MusicXML로 바꾼 파일을 올려 주세요.',
  jpeg: '사진은 읽을 수 없습니다. 악보 인식(OMR) 프로그램으로 MusicXML로 바꾼 파일을 올려 주세요.',
  mid: 'MIDI에는 마디·악상 정보가 부족합니다. 편집기에서 MusicXML로 내보낸 파일을 올려 주세요.',
  midi: 'MIDI에는 마디·악상 정보가 부족합니다. 편집기에서 MusicXML로 내보낸 파일을 올려 주세요.',
  mscz: 'MuseScore 원본 파일은 읽을 수 없습니다. 파일 > 내보내기에서 MusicXML로 저장해 올려 주세요.',
  mscx: 'MuseScore 원본 파일은 읽을 수 없습니다. 파일 > 내보내기에서 MusicXML로 저장해 올려 주세요.',
};

function hashText(s) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return `${(x >>> 0).toString(36)}-${s.length.toString(36)}`;
}

async function importFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (WRONG_TYPE[ext]) throw new Error(WRONG_TYPE[ext]);
  if (!['musicxml', 'xml', 'mxl'].includes(ext)) throw new Error(`.${ext} 형식은 지원하지 않습니다. .musicxml, .xml, .mxl 파일을 올려 주세요.`);
  if (file.size > MAX_FILE) throw new Error('파일이 너무 큽니다(30MB 초과).');
  let xml = await readScoreFile(file);
  xml = xml.replace(/\s+color="#[0-9a-fA-F]{6,8}"/g, '');
  if (/<score-timewise[\s>]/.test(xml)) throw new Error('timewise 형식 MusicXML은 지원하지 않습니다. 편집기에서 다시 내보내 주세요.');
  if (!/<score-partwise[\s>]/.test(xml)) throw new Error('MusicXML 악보가 아닌 파일입니다.');
  const parsed = parseScore(xml, {});
  if (parsed.measures.length < 2) throw new Error('마디가 2개 이상 있는 악보만 연습할 수 있습니다.');
  const hash = hashText(xml);
  const dup = state.library.find((p) => p.hash === hash);
  if (dup) return { id: dup.id, title: dup.title, existed: true };
  const id = `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const title = parsed.title !== '제목 없음' ? parsed.title : file.name.replace(/\.[^.]+$/, '');
  const stored = await putXml(id, xml);
  const entry = { id, title, composer: parsed.composer, measures: parsed.measures.length, hash, addedAt: Date.now(), piano: parsed.isPiano };
  state.library.push(entry);
  saveLibrary(state.library.filter((p) => !p.sample));
  return { id, title, existed: false, measures: entry.measures, stored };
}

async function addFiles(files) {
  const list = [...files];
  if (!list.length || state.busy) return;
  state.busy = true;
  state.report = [];
  let last = null;
  for (const file of list) {
    try {
      const r = await importFile(file);
      last = r;
      state.report.push({ ok: true, name: file.name, text: r.existed ? `"${r.title}"은 이미 보관함에 있습니다.` : `"${r.title}" 추가됨 (${r.measures}마디)` });
      if (r.stored === false) state.report.push({ ok: false, name: file.name, text: '이 브라우저는 저장을 막고 있어 이번 접속 동안만 쓸 수 있습니다.' });
    } catch (err) {
      state.report.push({ ok: false, name: file.name, text: err.message });
    }
  }
  state.busy = false;
  const failed = state.report.some((r) => !r.ok);
  if (list.length === 1 && last && !failed) {
    say(state.report[0].text);
    await openPiece(last.id);
  } else {
    say(failed ? '일부 파일을 추가하지 못했습니다.' : `${list.length}개 추가했습니다.`);
    go('library');
  }
}

/* ---------- 보관함 ---------- */

async function refreshLibrary() {
  const mine = loadLibrary().filter((p) => !p.sample);
  const present = await Promise.all(SAMPLES.map((s) => fetch(s.file, { method: 'HEAD' }).then((r) => r.ok).catch(() => false)));
  state.library = [...mine, ...SAMPLES.filter((_, i) => present[i]).map((s) => ({ ...s, sample: true }))];
}

function masteryOf(p) {
  const n = p.measures ?? 0;
  if (!n) return null;
  return new Progress(p.id, n).stats().avg;
}

function viewLibrary() {
  main.replaceChildren();
  const mine = state.library.filter((p) => !p.sample);
  const samples = state.library.filter((p) => p.sample);

  const zone = h('div', { class: 'dropzone' },
    h('h1', {}, mine.length ? '악보 추가' : '내 악보를 올려서 외워 보세요'),
    h('p', {}, mine.length
      ? 'MusicXML 파일을 끌어다 놓거나 아래 버튼으로 고르세요. 여러 개를 한 번에 올려도 됩니다.'
      : '악보 편집기에서 내보낸 MusicXML 파일(.musicxml, .xml, .mxl)을 올리면 곧바로 연습할 수 있습니다.'),
    h('button', { class: 'btn primary big', onClick: () => fileInput.click() }, '파일 선택'),
    h('p', { class: 'dz-sub' }, isNarrow() ? '파일은 서버로 전송되지 않습니다.' : '또는 이 화면 아무 곳에나 끌어다 놓으세요. 파일은 서버로 전송되지 않습니다.'),
    state.report.length ? h('ul', { class: 'report' }, state.report.map((r) => h('li', { class: r.ok ? 'ok' : 'fail' },
      h('b', {}, r.ok ? '완료' : '실패'), h('span', {}, r.ok ? r.text : `${r.name}: ${r.text}`)))) : null,
  );

  main.append(h('div', { class: 'library' }, zone));

  const card = (p) => {
    const mastery = masteryOf(p);
    return h('article', { class: 'piece-card' },
      h('button', { class: 'pc-main', onClick: () => openPiece(p.id) },
        h('b', {}, p.title),
        h('span', {}, `${p.composer ? `${p.composer} · ` : ''}${p.measures ? `${p.measures}마디` : '예제'}`),
        mastery !== null ? h('span', { class: 'bar' }, h('i', { style: `width:${Math.round(mastery * 100)}%` })) : null),
      p.sample ? null : h('div', { class: 'pc-tools' },
        h('button', { class: 'btn link', onClick: () => renamePiece(p) }, '이름 변경'),
        h('button', { class: 'btn link danger-text', onClick: () => removePiece(p) }, '삭제')));
  };

  if (mine.length) main.append(h('section', { class: 'lib-section' }, h('h2', {}, '내 악보'), h('div', { class: 'piece-cards' }, mine.map(card))));
  if (samples.length) main.append(h('section', { class: 'lib-section' }, h('h2', {}, '예제'), h('div', { class: 'piece-cards' }, samples.map(card))));
}

function renamePiece(p) {
  const name = prompt('악보 이름', p.title)?.trim();
  if (!name || name === p.title) return;
  p.title = name;
  saveLibrary(state.library.filter((x) => !x.sample));
  if (state.meta?.id === p.id) { state.meta.title = name; state.score.title = name; updateHeader(); }
  viewLibrary();
}

async function removePiece(p) {
  if (!confirm(`"${p.title}"을(를) 보관함에서 삭제할까요? 이 악보의 진도도 함께 지워지며 되돌릴 수 없습니다.`)) return;
  state.library = state.library.filter((x) => x.id !== p.id);
  saveLibrary(state.library.filter((x) => !x.sample));
  await deleteXml(p.id);
  Progress.clear(p.id);
  delete prefs[`range:${p.id}`];
  if (state.meta?.id === p.id) {
    state.score = state.meta = state.progress = null;
    delete prefs.piece;
    updateHeader();
  }
  savePrefs(prefs);
  viewLibrary();
}

/* ---------- 곡 열기 ---------- */

function updateHeader() {
  pieceTitle.textContent = state.meta?.title ?? '악보를 추가하세요';
  document.getElementById('score-note').textContent = !state.meta ? ''
    : state.meta.note ?? '직접 올린 악보입니다. 이 기기의 브라우저 안에서만 사용됩니다.';
  document.title = state.meta ? `${state.meta.title} · 악보 암기` : '악보 암기';
}

async function openPiece(id, route = 'practice', params = {}) {
  const ok = await loadPiece(id);
  if (ok) go(route, params);
}

async function loadPiece(id) {
  const meta = state.library.find((p) => p.id === id);
  if (!meta) return false;
  main.replaceChildren(h('div', { class: 'loading' }, '악보를 읽는 중입니다…'));
  try {
    let xml;
    if (meta.sample) {
      const res = await fetch(meta.file);
      if (!res.ok) throw new Error(`악보 파일을 받지 못했습니다 (${res.status}).`);
      xml = await res.text();
    } else {
      xml = await getXml(id);
      if (!xml) throw new Error('이 악보가 브라우저에 남아 있지 않습니다. 보관함에서 삭제하고 다시 올려 주세요.');
    }
    await engraverReady;
    state.score = parseScore(xml, { id, title: meta.title, composer: meta.composer });
    state.meta = meta;
    state.progress = new Progress(id, state.score.measures.length);
    if (!meta.sample && meta.measures !== state.score.measures.length) {
      meta.measures = state.score.measures.length;
      saveLibrary(state.library.filter((p) => !p.sample));
    }
    const saved = prefs[`range:${id}`];
    const n = state.score.measures.length - 1;
    state.from = saved ? Math.min(saved[0], n) : 0;
    state.to = saved ? Math.min(saved[1], n) : n;
    prefs.piece = id;
    savePrefs(prefs);
    updateHeader();
    return true;
  } catch (err) {
    main.replaceChildren(h('div', { class: 'empty' }, `불러오기 실패: ${err.message}`,
      h('div', { class: 'quiz-actions center' }, h('button', { class: 'btn primary', onClick: () => go('library') }, '보관함으로'))));
    return false;
  }
}

/* ---------- 연습 화면 ---------- */

function rangeBar(onChange) {
  const score = state.score;
  const n = score.measures.length;
  const fromInput = h('input', { type: 'number', inputmode: 'numeric', min: 1, max: n, value: state.from + 1, 'aria-label': '시작 마디' });
  const toInput = h('input', { type: 'number', inputmode: 'numeric', min: 1, max: n, value: state.to + 1, 'aria-label': '끝 마디' });
  const chips = h('div', { class: 'chips' });
  const now = h('span', { class: 'range-now' });
  const apply = () => {
    setRange((+fromInput.value || 1) - 1, (+toInput.value || n) - 1);
    fromInput.value = state.from + 1;
    toInput.value = state.to + 1;
    paint();
    onChange?.();
  };
  fromInput.addEventListener('change', apply);
  toInput.addEventListener('change', apply);
  const add = (label, from, to) => chips.append(h('button', {
    class: 'chip', 'data-from': from, 'data-to': to,
    onClick: () => { fromInput.value = from + 1; toInput.value = to + 1; apply(); },
  }, label));
  const paint = () => {
    for (const c of chips.children) c.classList.toggle('on', +c.dataset.from === state.from && +c.dataset.to === state.to);
    now.textContent = state.from === 0 && state.to === n - 1 ? '곡 전체' : `${state.from + 1}–${state.to + 1}마디`;
  };
  add('곡 전체', 0, n - 1);
  for (const s of score.sections) add(`${s.label} (${score.measures[s.from].number}–${score.measures[s.to].number})`, s.from, s.to);
  paint();
  return h('details', { class: 'range-bar', open: !isNarrow() },
    h('summary', {}, h('span', { class: 'range-label' }, '연습 구간'), now),
    h('div', { class: 'range-body' }, h('div', { class: 'range-inputs' }, fromInput, '–', toInput, h('span', {}, '마디')), chips));
}

function pieceHead() {
  const s = state.score;
  const bpm = s.tempos[0]?.bpm;
  return h('div', { class: 'piece-head' },
    h('h1', {}, state.meta.title),
    h('p', {}, [state.meta.composer, `${s.measures.length}마디`, bpm ? `♩ = ${Math.round(bpm)}` : null, s.isPiano ? null : '한 손 기능 없음'].filter(Boolean).join(' · ')));
}

function viewPractice() {
  main.replaceChildren();
  const st = state.progress.stats();
  const groups = new Map();
  for (const m of MODES) {
    if (m.piano && !state.score.isPiano) continue;
    if (!groups.has(m.group)) groups.set(m.group, []);
    groups.get(m.group).push(m);
  }
  main.append(
    pieceHead(),
    rangeBar(),
    h('button', { class: 'mix-card', onClick: () => go('mix') },
      h('div', {}, h('b', {}, `오늘의 복습 ${MIX_LENGTH}문제`),
        h('p', {}, st.total ? `약한 마디와 복습할 때가 된 마디를 먼저 냅니다. 복습 대상 ${st.due}마디.` : '여러 유형을 섞어 냅니다. 처음이면 여기서 시작하세요.')),
      h('span', { class: 'mix-go' }, '시작 →')),
  );
  for (const [group, list] of groups) {
    main.append(h('section', { class: 'mode-group' }, h('h2', {}, group), h('div', { class: 'mode-list' },
      list.map((m) => h('button', { class: 'mode-card', onClick: () => go(m.id) }, h('b', {}, m.title), h('span', {}, m.desc))))));
  }
  main.append(h('section', { class: 'mode-group' }, h('h2', {}, '분석'), h('div', { class: 'mode-list' },
    h('button', { class: 'mode-card', onClick: () => go('confusion') }, h('b', {}, '헷갈리는 구간 지도'), h('span', {}, '비슷한 마디 쌍을 나란히 비교')))));
}

function viewMode(mode, params) {
  main.replaceChildren();
  const head = h('div', { class: 'mode-nav' }, h('button', { class: 'btn link', onClick: () => go('practice') }, '← 연습 목록'));
  const area = h('div', { class: 'quiz' });
  main.append(head, rangeBar(() => mode.mount(area, ctx, {})), area);
  const ctx = context({ next: () => mode.mount(area, ctx, {}) });
  mode.mount(area, ctx, params);
}

function viewMix() {
  main.replaceChildren();
  const pool = MODES.filter((m) => m.mix && (!m.piano || state.score.isPiano));
  const area = h('div', { class: 'quiz' });
  const meter = h('div', { class: 'mix-meter' }, h('i', {}));
  main.append(h('div', { class: 'mode-nav' }, h('button', { class: 'btn link', onClick: () => go('practice') }, '← 연습 목록')), meter, area);
  let index = 0;
  let last = null;
  const before = { total: state.progress.data.total, right: state.progress.data.right };
  const step = () => {
    if (index >= MIX_LENGTH) {
      const solved = state.progress.data.total - before.total;
      const score = solved ? (state.progress.data.right - before.right) / solved : 0;
      area.replaceChildren(h('div', { class: 'mix-done' },
        h('h2', {}, '오늘의 복습 끝'),
        h('p', {}, `기록된 답 ${solved}개, 정답률 ${Math.round(score * 100)}%`),
        h('div', { class: 'quiz-actions' },
          h('button', { class: 'btn primary', onClick: () => go('mix') }, '한 번 더'),
          h('button', { class: 'btn ghost', onClick: () => go('progress') }, '진도 보기'))));
      meter.firstChild.style.width = '100%';
      return;
    }
    meter.firstChild.style.width = `${(index / MIX_LENGTH) * 100}%`;
    const mode = sample(pool.filter((m) => m !== last));
    last = mode;
    index++;
    mode.mount(area, context({ next: step, mixLabel: `${index} / ${MIX_LENGTH}` }));
  };
  step();
}

/* ---------- 이동 ---------- */

function go(route, params = {}) {
  stopPlayback();
  for (const fn of state.leave.splice(0)) fn();
  if (route !== 'library' && !state.score) {
    say('먼저 악보를 추가해 주세요.');
    route = 'library';
  }
  const tab = ['view', 'progress', 'library'].includes(route) ? route : 'practice';
  for (const b of nav.querySelectorAll('button')) {
    const on = b.dataset.tab === tab;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  history.replaceState(null, '', `#${route}`);
  window.scrollTo(0, 0);
  const mode = MODES.find((m) => m.id === route);
  if (route === 'library') viewLibrary();
  else if (route === 'view') { main.replaceChildren(); mountViewer(main, context(), params); }
  else if (route === 'progress') mountDashboard(main, context());
  else if (route === 'mix') viewMix();
  else if (route === 'confusion') {
    main.replaceChildren();
    const area = h('div', { class: 'quiz' });
    main.append(h('div', { class: 'mode-nav' }, h('button', { class: 'btn link', onClick: () => go('practice') }, '← 연습 목록')), area);
    mountConfusion(area, context());
  } else if (mode) viewMode(mode, params);
  else viewPractice();
}

/* ---------- 입력 연결 ---------- */

nav.addEventListener('click', (e) => {
  const tab = e.target.closest('button')?.dataset.tab;
  if (tab) go(tab);
});
document.getElementById('piece-btn').addEventListener('click', () => go('library'));
document.getElementById('add-btn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const files = [...fileInput.files];
  fileInput.value = '';
  addFiles(files);
});

// 화면 어디에 놓아도 올라가게 한다.
const overlay = document.getElementById('drop-overlay');
let dragDepth = 0;
const hasFiles = (e) => e.dataTransfer?.types?.includes('Files');
addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; overlay.hidden = false; } });
addEventListener('dragleave', (e) => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; overlay.hidden = true; } });
addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  overlay.hidden = true;
  addFiles(e.dataTransfer.files);
});

(async function start() {
  await refreshLibrary();
  const route = location.hash.slice(1);
  const last = state.library.find((p) => p.id === prefs.piece);
  if (last && route !== 'library') await openPiece(last.id, route || 'practice');
  else go('library');
}());
