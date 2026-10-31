// 비슷해서 틀리기 쉬운 마디 쌍을 찾아 나란히 비교하고 구별하는 퀴즈를 낸다.

import { h, sample, fragmentBox, noteEl, listenButton, quizFrame, emptyNote, mLabel } from '../ui.js';
import { confusablePairs } from '../score.js';

function highlightDiff(score, box, own, other) {
  const keys = new Set(other.sig.split('|'));
  for (const n of own.notes) {
    if (n.rest) continue;
    if (!keys.has(`${n.pos.toFixed(3)}:${n.midi}:${n.hand}`)) noteEl(box, n.id)?.classList.add('mark-diff');
  }
}

export function mountConfusion(root, ctx) {
  const score = ctx.score;
  const all = confusablePairs(score);
  const pairs = all.filter((p) => p.s < 1);
  const same = all.filter((p) => p.s === 1);
  root.replaceChildren();

  const detail = h('div', { class: 'compare' });
  const list = h('div', { class: 'pair-list' });
  root.append(
    h('div', { class: 'quiz-head' }, h('div', {},
      h('h2', {}, '헷갈리는 구간 지도'),
      h('p', { class: 'quiz-prompt' }, `음표가 비슷하지만 같지 않은 마디 ${pairs.length}쌍과 완전히 같은 마디 ${same.length}쌍을 찾았습니다. 암보가 다른 곳으로 새는 지점은 대개 이런 곳입니다. 다른 음은 주황색으로 표시합니다.`))),
    h('div', { class: 'confusion-grid' }, list, detail),
  );

  if (!pairs.length) {
    emptyNote(detail, '이 곡에서는 헷갈릴 만큼 비슷한 마디를 찾지 못했습니다.');
    return;
  }

  const open = (p, btn) => {
    for (const b of list.children) b.classList.toggle('on', b === btn);
    const [ma, mb] = [score.measures[p.a], score.measures[p.b]];
    const boxA = fragmentBox(score, p.a, p.a, { scale: 42 });
    const boxB = fragmentBox(score, p.b, p.b, { scale: 42 });
    detail.replaceChildren(
      h('div', { class: 'compare-col' }, h('h3', {}, mLabel(score, p.a)), boxA, listenButton(score, p.a, p.a)),
      h('div', { class: 'compare-col' }, h('h3', {}, mLabel(score, p.b)), boxB, listenButton(score, p.b, p.b)),
      h('div', { class: 'compare-actions' }, h('button', { class: 'btn primary', onClick: () => ctx.open('tell', { pair: p }) }, '이 쌍으로 구별 퀴즈')),
    );
    requestAnimationFrame(() => {
      highlightDiff(score, boxA, ma, mb);
      highlightDiff(score, boxB, mb, ma);
    });
  };

  pairs.slice(0, 40).forEach((p, i) => {
    const btn = h('button', { class: 'pair', onClick: () => open(p, btn) },
      h('b', {}, `${score.measures[p.a].number} ↔ ${score.measures[p.b].number}`),
      h('span', { class: 'bar' }, h('i', { style: `width:${Math.round(p.s * 100)}%` })),
      h('small', {}, `${Math.round(p.s * 100)}%`));
    list.append(btn);
    if (i === 0) requestAnimationFrame(() => open(p, btn));
  });
}

// 두 마디 중 어느 쪽인지 고르는 퀴즈. 앞 마디를 함께 보여 문맥으로 구별하게 한다.
export function mountTell(root, ctx, params = {}) {
  const score = ctx.score;
  const { from, to } = ctx.range();
  const inRange = confusablePairs(score).filter((p) => p.s < 1 && p.a >= from && p.b <= to);
  const pair = params.pair ?? sample(inRange.length ? inRange : confusablePairs(score).filter((p) => p.s < 1));
  if (!pair) {
    emptyNote(root, '헷갈릴 만큼 비슷한 마디를 찾지 못했습니다.');
    return;
  }
  const shown = Math.random() < 0.5 ? pair.a : pair.b;
  const ui = quizFrame(root, ctx, { title: '비슷한 마디 구별', prompt: '이 악보는 둘 중 어느 마디일까요?' });
  ui.body.append(fragmentBox(score, shown, shown, { scale: 46 }));
  const choices = h('div', { class: 'choices two', role: 'group' });
  for (const idx of [pair.a, pair.b]) {
    const btn = h('button', {
      class: 'choice',
      onClick: () => {
        const ok = idx === shown;
        for (const c of choices.children) {
          c.disabled = true;
          if (c.textContent === mLabel(score, shown)) c.classList.add('right');
        }
        if (!ok) btn.classList.add('wrong');
        ctx.progress.record([pair.a, pair.b], ok ? 1 : 0);
        ui.say(ok ? '정답입니다.' : `아쉽습니다. ${mLabel(score, shown)}입니다.`, ok ? 'good' : 'bad');
        ui.actions.replaceChildren(ui.nextButton(), listenButton(score, Math.max(0, shown - 1), shown, '▶ 앞마디부터 듣기'));
      },
    }, mLabel(score, idx));
    choices.append(btn);
  }
  ui.body.append(choices);
  ui.actions.append(listenButton(score, shown, shown));
}
