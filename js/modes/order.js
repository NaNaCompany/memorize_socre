// 마디 퍼즐과 악절 순서. 흩어진 조각이 이미 줄지어 있고, 조각끼리 끌어서 자리를 바꾼다.

import { h, shuffle, fragmentBox, listenButton, quizFrame, segmented, emptyNote, mLabel } from '../ui.js';
import { chunkSig } from '../score.js';

const CONFIG = {
  measure: {
    title: '마디 퍼즐', chunk: 1, counts: [4, 6, 8], defaultCount: 4, scale: 36, layout: 'grid',
    prompt: '마디가 뒤섞여 있습니다. 조각을 끌어 다른 조각 위에 놓으면 서로 자리가 바뀝니다. 연주 순서대로 맞추세요.',
  },
  phrase: {
    title: '악절 순서', chunk: 4, counts: [3, 4, 5], defaultCount: 3, scale: 34, layout: 'stack',
    prompt: '4마디씩 묶은 악절이 뒤섞여 있습니다. 끌어서 서로 자리를 바꿔 연주 순서대로 맞추세요.',
  },
};

export function mountOrder(root, ctx, kind) {
  const cfg = CONFIG[kind];
  const count = ctx.prefs[`order.${kind}`] ?? cfg.defaultCount;
  const { from, to } = ctx.range();
  const needed = cfg.chunk * count;
  const score = ctx.score;

  if (to - from + 1 < needed) {
    emptyNote(root, `이 문제에는 ${needed}마디 이상이 필요합니다. 연습 구간을 넓혀 주세요.`);
    return;
  }

  const start = ctx.progress.pickStart(from, to, needed);
  const pieces = Array.from({ length: count }, (_, i) => {
    const a = start + i * cfg.chunk;
    return { pid: i, from: a, to: a + cfg.chunk - 1, sig: chunkSig(score, a, cfg.chunk) };
  });
  // 처음부터 맞아 있는 조각이 하나도 없도록 섞는다.
  let order = shuffle(pieces);
  for (let tries = 0; tries < 20 && order.some((p, i) => p.sig === pieces[i].sig) && count > 1; tries++) order = shuffle(pieces);

  const ui = quizFrame(root, ctx, {
    title: cfg.title,
    prompt: cfg.prompt,
    controls: segmented(cfg.counts.map((c) => [c, `${c}개`]), count, (v) => {
      ctx.setPref(`order.${kind}`, v);
      ctx.next();
    }),
  });

  const pinned = new Set();
  let selected = null;
  let locked = false;

  const slotsEl = h('div', { class: `slots ${cfg.layout}` });
  const pieceEls = new Map();
  const slotEls = pieces.map((_, i) => h('div', { class: 'slot filled', 'data-slot': i }, h('span', { class: 'slot-num' }, i + 1)));
  slotsEl.append(...slotEls);

  for (const p of pieces) {
    const el = h('div', { class: 'piece', 'data-pid': p.pid, tabindex: 0, role: 'button', 'aria-label': '악보 조각, 끌어서 자리 바꾸기' },
      fragmentBox(score, p.from, p.to, { scale: cfg.scale, noTime: true, noWords: true }));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapPiece(p.pid); }
    });
    attachDrag(el, p.pid);
    pieceEls.set(p.pid, el);
  }

  const indexOf = (pid) => order.findIndex((p) => p.pid === pid);

  function layout() {
    order.forEach((p, i) => {
      const slot = slotEls[i];
      const el = pieceEls.get(p.pid);
      if (el.parentElement !== slot) slot.append(el);
      slot.classList.toggle('pinned', pinned.has(p.pid));
      el.classList.toggle('pinned', pinned.has(p.pid));
    });
  }

  function swap(i, j) {
    if (i === j || locked) return;
    if (pinned.has(order[i].pid) || pinned.has(order[j].pid)) return;
    [order[i], order[j]] = [order[j], order[i]];
    layout();
    for (const k of [i, j]) {
      const el = pieceEls.get(order[k].pid);
      el.classList.remove('landed');
      void el.offsetWidth;
      el.classList.add('landed');
    }
  }

  function tapPiece(pid) {
    if (locked) return;
    if (selected === null) {
      if (pinned.has(pid)) return;
      selected = pid;
    } else if (selected === pid) {
      selected = null;
    } else {
      swap(indexOf(selected), indexOf(pid));
      selected = null;
    }
    for (const [id, el] of pieceEls) el.classList.toggle('selected', id === selected);
  }

  function attachDrag(el, pid) {
    let startX = 0, startY = 0, ghost = null, active = false, over = -1, moved = false, lastY = 0, scroller = 0;
    const slotAt = (x, y) => {
      const s = document.elementFromPoint(x, y)?.closest('[data-slot]');
      return s ? +s.dataset.slot : -1;
    };
    const onMove = (e) => {
      if (!active) return;
      lastY = e.clientY;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!ghost && Math.hypot(dx, dy) > 6) {
        moved = true;
        const r = el.getBoundingClientRect();
        ghost = el.cloneNode(true);
        ghost.classList.add('ghost');
        ghost.style.width = `${r.width}px`;
        ghost.dataset.ox = startX - r.left;
        ghost.dataset.oy = startY - r.top;
        document.body.append(ghost);
        el.classList.add('dragging');
        // 화면 가장자리에 닿으면 스크롤해서 먼 칸까지 닿게 한다.
        scroller = setInterval(() => {
          if (lastY < 80) scrollBy(0, -16);
          else if (lastY > innerHeight - 80) scrollBy(0, 16);
        }, 16);
      }
      if (ghost) {
        ghost.style.transform = `translate(${e.clientX - ghost.dataset.ox}px, ${e.clientY - ghost.dataset.oy}px)`;
        const i = slotAt(e.clientX, e.clientY);
        if (i !== over) {
          if (over >= 0) slotEls[over].classList.remove('over');
          if (i >= 0 && i !== indexOf(pid)) slotEls[i].classList.add('over');
          over = i;
        }
      }
    };
    const finish = (e) => {
      if (!active) return;
      active = false;
      clearInterval(scroller);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (over >= 0) slotEls[over].classList.remove('over');
      el.classList.remove('dragging');
      ghost?.remove();
      if (ghost && e.type === 'pointerup' && over >= 0) swap(indexOf(pid), over);
      else if (!moved && e.type === 'pointerup') tapPiece(pid);
      ghost = null;
      over = -1;
    };
    el.addEventListener('pointerdown', (e) => {
      if (locked || e.button !== 0 || pinned.has(pid)) return;
      active = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      e.preventDefault();
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    });
  }

  const check = h('button', { class: 'btn primary', onClick: grade }, '채점');
  const hint = h('button', {
    class: 'btn ghost',
    onClick: () => {
      const first = pieces[0];
      const at = indexOf(first.pid);
      if (at !== 0) {
        [order[0], order[at]] = [order[at], order[0]];
      }
      pinned.add(first.pid);
      selected = null;
      for (const el of pieceEls.values()) el.classList.remove('selected');
      layout();
      hint.disabled = true;
    },
  }, '첫 조각 힌트');
  const playAll = listenButton(score, start, start + needed - 1, '▶ 정답 순서로 듣기');

  function grade() {
    locked = true;
    selected = null;
    let right = 0;
    order.forEach((p, i) => {
      const ok = p.sig === pieces[i].sig;
      if (ok) right++;
      slotEls[i].classList.add(ok ? 'right' : 'wrong');
      pieceEls.get(p.pid).classList.remove('selected');
      pieceEls.get(p.pid).append(h('span', { class: 'piece-tag' },
        cfg.chunk === 1 ? mLabel(score, p.from) : `${score.measures[p.from].number}–${score.measures[p.to].number}마디`));
      for (let m = p.from; m <= p.to; m++) ctx.progress.record(m, ok ? 1 : 0);
    });
    check.disabled = true;
    hint.disabled = true;
    ui.say(right === count ? `완벽합니다. ${count}개 모두 맞았습니다.` : `${count}개 중 ${right}개 맞았습니다.`, right === count ? 'good' : 'bad');
    const actions = [ui.nextButton(), playAll];
    if (right !== count) {
      actions.splice(1, 0, h('button', {
        class: 'btn ghost',
        onClick: (e) => {
          order = [...pieces];
          layout();
          slotEls.forEach((s) => { s.classList.remove('wrong'); s.classList.add('right'); });
          e.currentTarget.disabled = true;
        },
      }, '정답 보기'));
    }
    ui.actions.replaceChildren(...actions);
  }

  ui.body.append(slotsEl);
  ui.actions.append(check, hint);
  layout();
}
