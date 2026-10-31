// 다음 마디 고르기, 듣고 찾기, 위치 맞추기.

import { h, shuffle, fragmentBox, listenButton, quizFrame, emptyNote } from '../ui.js';
import { similarity, chunkSig } from '../score.js';
import { playRange } from '../audio.js';

function distractors(score, answerStart, len, count) {
  const answerSig = chunkSig(score, answerStart, len);
  const answerM = score.measures[answerStart];
  const seen = new Set([answerSig]);
  const scored = [];
  for (let s = 0; s + len <= score.measures.length; s++) {
    if (s === answerStart) continue;
    const sig = chunkSig(score, s, len);
    if (!score.measures[s].notes.some((n) => !n.rest)) continue;
    scored.push({ s, sig, rank: similarity(answerM, score.measures[s]) + 0.6 / (1 + Math.abs(s - answerStart)) + Math.random() * 0.25 });
  }
  scored.sort((a, b) => b.rank - a.rank);
  const out = [];
  for (const c of scored) {
    if (seen.has(c.sig)) continue;
    seen.add(c.sig);
    out.push(c.s);
    if (out.length === count) break;
  }
  return out;
}

function choiceGrid(score, starts, len, onPick) {
  const grid = h('div', { class: `sheet-choices ${len === 1 ? 'compact' : ''}` });
  starts.forEach((s, i) => {
    const btn = h('button', { class: 'sheet-choice', 'aria-label': `${i + 1}번 보기`, onClick: () => onPick(s, btn, grid) },
      h('span', { class: 'choice-num' }, i + 1),
      fragmentBox(score, s, s + len - 1, { scale: 34 }));
    btn.dataset.start = s;
    grid.append(btn);
  });
  return grid;
}

export function mountNext(root, ctx) {
  const score = ctx.score;
  const { from, to } = ctx.range();
  if (to - from < 1) { emptyNote(root, '2마디 이상 구간이 필요합니다.'); return; }
  const shown = ctx.progress.pickStart(from, to - 1, 2);
  const answer = shown + 1;
  const ui = quizFrame(root, ctx, { title: '다음 마디 고르기', prompt: '아래 마디 바로 다음에 오는 마디를 고르세요.' });
  ui.body.append(h('div', { class: 'stem-sheet' }, fragmentBox(score, shown, shown, { scale: 44 })));

  const starts = shuffle([answer, ...distractors(score, answer, 1, 3)]);
  const sig = score.measures[answer].sig;
  ui.body.append(choiceGrid(score, starts, 1, (s, btn, grid) => {
    const ok = score.measures[s].sig === sig;
    for (const c of grid.children) {
      c.disabled = true;
      if (+c.dataset.start === answer) c.classList.add('right');
    }
    if (!ok) btn.classList.add('wrong');
    ctx.progress.record(answer, ok ? 1 : 0);
    ui.say(`${ok ? '정답입니다.' : '아쉽습니다.'} ${score.measures[shown].number}마디 다음은 ${score.measures[answer].number}마디입니다.`, ok ? 'good' : 'bad');
    ui.actions.replaceChildren(ui.nextButton(), listenButton(score, shown, answer, '▶ 이어서 듣기'));
  }));
  ui.actions.append(listenButton(score, shown, shown, '▶ 앞 마디 듣기'));
}

export function mountListen(root, ctx) {
  const score = ctx.score;
  const { from, to } = ctx.range();
  const len = to - from >= 1 ? 2 : 1;
  const answer = ctx.progress.pickStart(from, to, len);
  const ui = quizFrame(root, ctx, { title: '듣고 찾기', prompt: '소리를 듣고 같은 악보를 고르세요. 재생 버튼을 눌러 시작합니다.' });
  const sig = chunkSig(score, answer, len);
  const starts = shuffle([answer, ...distractors(score, answer, len, 3)]);
  const play = listenButton(score, answer, answer + len - 1, '▶ 다시 듣기');
  ui.body.append(choiceGrid(score, starts, len, (s, btn, grid) => {
    const ok = chunkSig(score, s, len) === sig;
    for (const c of grid.children) {
      c.disabled = true;
      if (+c.dataset.start === answer) c.classList.add('right');
    }
    if (!ok) btn.classList.add('wrong');
    for (let m = answer; m < answer + len; m++) ctx.progress.record(m, ok ? 1 : 0);
    ui.say(`${ok ? '정답입니다.' : '아쉽습니다.'} 들은 곳은 ${score.measures[answer].number}마디입니다.`, ok ? 'good' : 'bad');
    ui.actions.replaceChildren(ui.nextButton(), play);
  }));
  ui.actions.append(play);
  playRange(score, answer, answer + len - 1, { speed: 0.85 });
}

export function mountLocate(root, ctx) {
  const score = ctx.score;
  const { from, to } = ctx.range();
  const target = ctx.progress.pickStart(from, to, 1);
  const n = score.measures.length;
  const ui = quizFrame(root, ctx, { title: '위치 맞추기', prompt: '이 마디는 곡 전체에서 어디쯤일까요? 슬라이더로 마디 번호를 고르세요. ±2마디면 정답입니다.' });
  ui.body.append(fragmentBox(score, target, target, { scale: 46 }));

  const mid = Math.floor(n / 2);
  const value = h('output', { class: 'locate-value' }, `${mid + 1}마디`);
  const slider = h('input', {
    type: 'range', min: 1, max: n, value: mid + 1, class: 'locate-slider', 'aria-label': '마디 번호',
    onInput: (e) => { value.textContent = `${e.target.value}마디`; },
  });
  const marks = h('div', { class: 'locate-marks' }, score.sections.map((s) =>
    h('span', { style: `left:${(s.from / Math.max(n - 1, 1)) * 100}%`, title: s.label }, s.label)));
  ui.body.append(h('div', { class: 'locate' }, value, slider, marks));

  ui.actions.append(h('button', {
    class: 'btn primary',
    onClick: () => {
      const guess = +slider.value - 1;
      const diff = Math.abs(guess - target);
      const val = diff <= 2 ? 1 : diff <= 6 ? 0.5 : 0;
      ctx.progress.record(target, val);
      slider.disabled = true;
      const sec = score.sections.find((s) => target >= s.from && target <= s.to);
      ui.say(`정답은 ${score.measures[target].number}마디(${sec?.label ?? ''} 구간)입니다. 고른 곳과 ${diff}마디 차이입니다.`, val === 1 ? 'good' : val ? '' : 'bad');
      ui.actions.replaceChildren(ui.nextButton(), listenButton(score, Math.max(0, target - 1), Math.min(n - 1, target + 1), '▶ 앞뒤까지 듣기'));
    },
  }, '확인'));
}
