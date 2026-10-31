// 스스로 떠올리고 스스로 채점하는 연습: 한 손 가리기, 점점 지우기.

import { h, shuffle, fragmentBox, listenButton, quizFrame, segmented, emptyNote } from '../ui.js';

const LEVELS = [0.25, 0.5, 0.75, 1];

function rateButtons(ctx, ui, measures, extra = []) {
  const rate = (value, text) => h('button', {
    class: 'btn ghost',
    onClick: () => {
      for (const m of measures) ctx.progress.record(m, value);
      ui.say(`기록했습니다: ${text}`);
      ui.actions.replaceChildren(ui.nextButton(), ...extra);
    },
  }, text);
  return [rate(1, '다 기억남'), rate(0.5, '조금 헷갈림'), rate(0, '기억 안 남')];
}

export function hideHand(box, staffIndex) {
  for (const measure of box.querySelectorAll('.measure')) {
    const staves = measure.querySelectorAll(':scope > .staff');
    const staff = staves[staffIndex];
    if (!staff) continue;
    staff.classList.add('hand-hidden');
  }
  box.classList.add('hand-hiding');
}

export function mountHand(root, ctx) {
  const score = ctx.score;
  const { from, to } = ctx.range();
  const len = Math.min(4, to - from + 1);
  const start = ctx.progress.pickStart(from, to, len);
  const hide = ctx.prefs['hand.hide'] ?? 1;
  const ui = quizFrame(root, ctx, {
    title: '한 손 가리기',
    prompt: '가려진 손의 음을 머릿속으로 그려 보거나 실제로 쳐 본 다음 답을 확인하세요.',
    controls: segmented([[1, '왼손 가리기'], [0, '오른손 가리기']], hide, (v) => {
      ctx.setPref('hand.hide', v);
      ctx.next();
    }),
  });
  const box = fragmentBox(score, start, start + len - 1, { scale: 44, cls: 'wide' });
  ui.body.append(box);
  requestAnimationFrame(() => hideHand(box, hide));
  ui.say(`${score.measures[start].number}–${score.measures[start + len - 1].number}마디`);
  const play = listenButton(score, start, start + len - 1);
  ui.actions.append(h('button', {
    class: 'btn primary',
    onClick: () => {
      box.classList.remove('hand-hiding');
      for (const s of box.querySelectorAll('.hand-hidden')) s.classList.remove('hand-hidden');
      ui.actions.replaceChildren(...rateButtons(ctx, ui, Array.from({ length: len }, (_, i) => start + i), [play]), play);
    },
  }, '답 보기'), play);
}

export function mountFade(root, ctx) {
  const score = ctx.score;
  const { from, to } = ctx.range();
  const len = Math.min(4, to - from + 1);
  if (len < 1) { emptyNote(root, '연습 구간을 다시 골라 주세요.'); return; }
  const start = ctx.progress.pickStart(from, to, len);
  const ui = quizFrame(root, ctx, {
    title: '점점 지우기',
    prompt: '악보를 읽고 눈을 뗀 뒤, 음표가 지워져도 끝까지 떠올릴 수 있는지 확인하세요.',
  });
  const box = fragmentBox(score, start, start + len - 1, { scale: 44, cls: 'wide' });
  ui.body.append(box);
  const measures = Array.from({ length: len }, (_, i) => start + i);
  const notes = shuffle(measures.flatMap((m) => score.measures[m].notes).filter((n) => !n.rest));
  let level = -1;
  let shownAgain = false;
  const play = listenButton(score, start, start + len - 1);

  const applyLevel = () => {
    const hideCount = level < 0 || shownAgain ? 0 : Math.ceil(notes.length * LEVELS[level]);
    notes.forEach((n, i) => {
      const el = box.querySelector(`[id="${n.id}"]`);
      el?.classList.toggle('faded', i < hideCount);
    });
    box.classList.toggle('fade-all', level === LEVELS.length - 1 && !shownAgain);
    ui.say(level < 0 ? '먼저 천천히 읽어 보세요.' : `${Math.round(LEVELS[level] * 100)}% 가렸습니다.`);
  };

  const more = h('button', {
    class: 'btn primary',
    onClick: () => {
      level = Math.min(level + 1, LEVELS.length - 1);
      shownAgain = false;
      applyLevel();
      if (level === LEVELS.length - 1) {
        more.disabled = true;
        ui.actions.replaceChildren(peek, ...rateButtons(ctx, ui, measures, [play]), play);
      }
    },
  }, '더 지우기');
  const peek = h('button', {
    class: 'btn ghost',
    onClick: () => {
      shownAgain = !shownAgain;
      applyLevel();
      peek.textContent = shownAgain ? '다시 가리기' : '잠깐 보기';
    },
  }, '잠깐 보기');
  ui.actions.append(more, play);
  applyLevel();
}
