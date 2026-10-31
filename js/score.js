// MusicXML을 읽어 마디·음표·악상 모델로 바꾸고, 원하는 구간만 잘라 다시 MusicXML로 만든다.

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
const NS_FREE = document.implementation;

const kids = (el, name) => [...el.children].filter((c) => !name || c.tagName === name);
const kid = (el, name) => kids(el, name)[0];
const txt = (el, name, d = '') => kid(el, name)?.textContent.trim() ?? d;

export function parseScore(xml, meta = {}) {
  const clean = xml.replace(/\s+color="#[0-9a-fA-F]{6,8}"/g, '');
  const doc = new DOMParser().parseFromString(clean, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('MusicXML 파일을 읽을 수 없습니다.');
  const root = doc.documentElement;
  if (root.tagName !== 'score-partwise') throw new Error('score-partwise 형식의 MusicXML만 지원합니다.');
  const parts = kids(root, 'part');
  if (!parts.length) throw new Error('악보에 파트가 없습니다.');

  const count = kids(parts[0], 'measure').length;
  const measures = Array.from({ length: count }, (_, index) => ({
    index, number: String(index + 1), els: [], state: [], notes: [], marks: [], q: 0, lenQ: 0,
  }));
  const tempos = [];
  let uid = 0;
  let staffCount = 0;

  parts.forEach((part, pi) => {
    const st = { divisions: 1, key: null, time: null, staves: null, clefs: {}, shifts: {} };
    let q = 0;
    kids(part, 'measure').forEach((mEl, i) => {
      const m = measures[i];
      if (!m) return;
      if (pi === 0) { m.q = q; m.number = mEl.getAttribute('number') || m.number; }
      m.els[pi] = mEl;
      m.state[pi] = { ...st, clefs: { ...st.clefs }, shifts: { ...st.shifts } };
      let pos = 0, maxPos = 0, lastOnset = 0;

      for (const c of kids(mEl)) {
        const name = c.tagName;
        if (name === 'attributes') {
          const div = kid(c, 'divisions');
          if (div) st.divisions = +div.textContent || 1;
          if (kid(c, 'key')) st.key = kid(c, 'key');
          if (kid(c, 'time')) st.time = kid(c, 'time');
          if (kid(c, 'staves')) st.staves = kid(c, 'staves');
          for (const cl of kids(c, 'clef')) st.clefs[cl.getAttribute('number') || '1'] = cl;
        } else if (name === 'backup') {
          pos -= +txt(c, 'duration', 0);
        } else if (name === 'forward') {
          pos += +txt(c, 'duration', 0);
          maxPos = Math.max(maxPos, pos);
        } else if (name === 'direction') {
          readDirection(c, m, pos / st.divisions, st, tempos, pi, ++uid);
          const snd = kid(c, 'sound');
          if (snd?.getAttribute('tempo') && pi === 0) tempos.push({ q: m.q + pos / st.divisions, bpm: +snd.getAttribute('tempo') });
        } else if (name === 'note') {
          const chord = !!kid(c, 'chord');
          const grace = !!kid(c, 'grace');
          const dur = +txt(c, 'duration', 0);
          const onset = chord ? lastOnset : pos;
          if (!chord) lastOnset = pos;
          if (!c.getAttribute('id')) c.setAttribute('id', `n${++uid}`);
          const pitch = kid(c, 'pitch');
          const ties = kids(c, 'tie').map((t) => t.getAttribute('type'));
          const staff = +txt(c, 'staff', 1);
          const note = {
            id: c.getAttribute('id'), m: i, part: pi, staff, voice: txt(c, 'voice', '1'),
            hand: parts.length > 1 ? pi + 1 : staff, rest: !pitch, grace, chord,
            pos: onset / st.divisions, q: m.q + onset / st.divisions, durQ: dur / st.divisions,
            tieStart: ties.includes('start'), tieStop: ties.includes('stop'),
          };
          if (pitch) {
            const alter = +txt(pitch, 'alter', 0);
            const step = txt(pitch, 'step');
            const oct = +txt(pitch, 'octave');
            note.midi = (oct + 1) * 12 + STEP[step] + alter;
            note.name = `${step}${ACC[alter] ?? ''}${oct}`;
          }
          m.notes.push(note);
          for (const art of [...c.querySelectorAll('articulations > *')]) {
            const mid = `a${++uid}`;
            art.setAttribute('data-mid', mid);
            if (note.rest) continue;
            m.marks.push({ mid, kind: 'articulation', value: art.tagName, m: i, noteId: note.id });
          }
          if (!chord && !grace) { pos += dur; maxPos = Math.max(maxPos, pos); }
        }
      }
      const lenQ = maxPos / st.divisions;
      if (pi === 0) { m.lenQ = lenQ; q += lenQ; }
    });
    staffCount += st.staves ? +st.staves.textContent || 1 : 1;
  });

  // 끝 상태: 잘라낸 구간 뒤로 넘어가는 8va 처리에 쓴다.
  // 양손 기능(한 손 가리기, 손별 소리)은 오선이 둘인 피아노 악보에서만 뜻이 있다.
  const score = { ...meta, doc, root, parts, measures, tempos: normalizeTempos(tempos), isPiano: staffCount === 2 };
  if (!meta.title) score.title = txt(root, 'movement-title') || root.querySelector('work-title')?.textContent || '제목 없음';
  if (!meta.composer) score.composer = root.querySelector('creator[type="composer"]')?.textContent || '';
  score.events = buildEvents(score);
  for (const m of measures) m.sig = signature(m);
  score.sections = buildSections(score);
  score.encoding = root.querySelector('identification software')?.textContent || '';
  return score;
}

function readDirection(el, m, pos, st, tempos, pi, uid) {
  const types = kids(el, 'direction-type');
  for (const dt of types) {
    const shift = kid(dt, 'octave-shift');
    if (shift) {
      const num = shift.getAttribute('number') || '1';
      if (shift.getAttribute('type') === 'stop') delete st.shifts[num];
      else st.shifts[num] = { el, type: shift.getAttribute('type'), size: shift.getAttribute('size') };
    }
    const mid = `d${uid}`;
    const dyn = kid(dt, 'dynamics');
    if (dyn?.children[0]) {
      // 표준 목록에 없는 셈여림(sfp, fz 등)은 other-dynamics 안에 글자로 들어 있다.
      // 편집기가 말(marc. 등)이나 조각 글자를 여기에 넣기도 해서, 셈여림 모양일 때만 셈여림으로 본다.
      const tag = dyn.children[0].tagName;
      const value = tag === 'other-dynamics' ? dyn.children[0].textContent.trim() : tag;
      const kind = tag !== 'other-dynamics' || /^[sfpzmr]{1,5}$/i.test(value) ? 'dynamics'
        : /^[a-zà-ü]{4,}\.?$/i.test(value) ? 'words' : null;
      if (kind) {
        el.setAttribute('data-mid', mid);
        m.marks.push({ mid, kind, value, m: m.index, pos });
      }
    }
    const wedge = kid(dt, 'wedge');
    if (wedge && ['crescendo', 'diminuendo'].includes(wedge.getAttribute('type'))) {
      el.setAttribute('data-mid', mid);
      m.marks.push({ mid, kind: 'wedge', value: wedge.getAttribute('type'), m: m.index, pos });
    }
    const words = kid(dt, 'words');
    if (words?.textContent.trim()) {
      el.setAttribute('data-mid', mid);
      m.marks.push({ mid, kind: 'words', value: words.textContent.trim(), m: m.index, pos });
    }
  }
}

function normalizeTempos(list) {
  const sorted = list.filter((t) => t.bpm > 0).sort((a, b) => a.q - b.q);
  if (!sorted.length || sorted[0].q > 0) sorted.unshift({ q: 0, bpm: sorted[0]?.bpm ?? 120 });
  return sorted;
}

function secondsAt(tempos, q) {
  let sec = 0;
  for (let i = 0; i < tempos.length; i++) {
    const t = tempos[i];
    const end = tempos[i + 1]?.q ?? Infinity;
    if (q <= t.q) break;
    sec += ((Math.min(q, end) - t.q) * 60) / t.bpm;
  }
  return sec;
}

// 붙임줄은 소리 하나로 합쳐 재생용 이벤트를 만든다.
function buildEvents(score) {
  const events = [];
  const open = new Map();
  for (const m of score.measures) {
    const ordered = [...m.notes].sort((a, b) => a.q - b.q);
    for (const n of ordered) {
      if (n.rest) continue;
      const durQ = n.grace ? 0.08 : n.durQ;
      const key = `${n.hand}:${n.midi}`;
      if (n.tieStop && open.has(key)) {
        const ev = open.get(key);
        ev.endQ = n.q + durQ;
        ev.ids.push(n.id);
        if (!n.tieStart) open.delete(key);
        continue;
      }
      const ev = { midi: n.midi, hand: n.hand, q: n.q, endQ: n.q + durQ, m: n.m, id: n.id, ids: [n.id] };
      events.push(ev);
      if (n.tieStart) open.set(key, ev);
    }
  }
  for (const ev of events) {
    ev.t = secondsAt(score.tempos, ev.q);
    ev.dur = Math.max(0.06, secondsAt(score.tempos, ev.endQ) - ev.t);
  }
  return events.sort((a, b) => a.t - b.t);
}

function signature(m) {
  return m.notes.filter((n) => !n.rest).map((n) => `${n.pos.toFixed(3)}:${n.midi}:${n.hand}`).sort().join('|');
}

const TEMPO_WORD = /allegro|presto|mosso|tempo i\b|a tempo|meno|largo|lento|adagio|andante|moderato|vivace/i;

function buildSections(score) {
  const starts = [];
  for (const m of score.measures) {
    for (const mk of m.marks) {
      if (mk.kind === 'words' && TEMPO_WORD.test(mk.value) && !/cambio/i.test(mk.value)) {
        if (!starts.length || starts.at(-1).from !== m.index) starts.push({ label: mk.value, from: m.index });
      }
    }
  }
  const n = score.measures.length;
  if (!starts.length || starts.length > 16) {
    starts.length = 0;
    for (let i = 0; i < n; i += 16) starts.push({ label: `${i + 1}마디~`, from: i });
  }
  if (starts[0].from !== 0) starts.unshift({ label: '도입', from: 0 });
  return starts.map((s, i) => ({ ...s, to: (starts[i + 1]?.from ?? n) - 1 }));
}

// 한 마디 차이의 정도. 1이면 음표까지 완전히 같다.
export function similarity(a, b) {
  const A = new Set(a.sig.split('|').filter(Boolean));
  const B = new Set(b.sig.split('|').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const x of A) if (B.has(x)) both++;
  return both / (A.size + B.size - both);
}

export function confusablePairs(score, threshold = 0.45) {
  if (score._pairs) return score._pairs;
  const pairs = [];
  const ms = score.measures;
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 2; j < ms.length; j++) {
      const s = similarity(ms[i], ms[j]);
      if (s >= threshold) pairs.push({ a: i, b: j, s });
    }
  }
  pairs.sort((x, y) => (x.s === 1) - (y.s === 1) || y.s - x.s);
  return (score._pairs = pairs);
}

export function chunkSig(score, from, len) {
  return score.measures.slice(from, from + len).map((m) => m.sig).join('/');
}

function append(doc, parent, xmlTag, attrs = {}, text) {
  const el = doc.createElement(xmlTag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  parent?.appendChild(el);
  return el;
}

// from~to 마디만 담은 독립 MusicXML을 만든다. transform(doc)으로 잘라낸 사본을 고칠 수 있다.
export function buildFragment(score, from, to, { transform, noTime, hand } = {}) {
  const doc = NS_FREE.createDocument(null, 'score-partwise', null);
  const root = doc.documentElement;
  const partList = root.appendChild(doc.importNode(kid(score.root, 'part-list'), true));
  // 악기 이름 표기는 줄 앞을 넓게 차지해 조각 악보를 작게 만든다.
  for (const n of partList.querySelectorAll('part-name')) { n.textContent = ''; n.setAttribute('print-object', 'no'); }
  for (const n of partList.querySelectorAll('part-abbreviation')) n.remove();
  score.parts.forEach((part, pi) => {
    const out = append(doc, root, 'part', { id: part.getAttribute('id') });
    for (let i = from; i <= to; i++) {
      const mEl = score.measures[i]?.els[pi];
      if (!mEl) continue;
      const copy = doc.importNode(mEl, true);
      for (const p of kids(copy, 'print')) p.remove();
      if (i === from) injectState(doc, copy, score.measures[i].state[pi]);
      out.appendChild(copy);
    }
    closeShifts(doc, out, score.measures[to + 1]?.state[pi]);
  });
  // 순서 문제에서는 조각마다 붙는 박자표가 단서가 되고 어색해 보여 뺀다.
  if (noTime) for (const t of doc.querySelectorAll('time')) t.remove();
  if (hand) keepHand(doc, root, hand, score.parts.length === 2);
  transform?.(doc);
  for (const out of kids(root, 'part')) pruneSpanners(out);
  return new XMLSerializer().serializeToString(doc);
}

// 한 손(1=오른손, 2=왼손)만 남긴 악보로 바꾼다. 오선이 둘인 한 파트 악보는 오선을 걸러내고,
// 손마다 파트가 나뉜 악보는 다른 파트를 뺀다.
function keepHand(doc, root, handNo, twoParts) {
  if (twoParts) {
    const drop = kids(root, 'part')[handNo === 1 ? 1 : 0];
    root.querySelector(`score-part[id="${drop.getAttribute('id')}"]`)?.remove();
    drop.remove();
    return;
  }
  for (const part of kids(root, 'part')) for (const m of kids(part, 'measure')) filterStaff(doc, m, handNo);
}

function filterStaff(doc, m, n) {
  let divisions = 1;
  let pos = 0;       // 원래 악보에서의 위치
  let cur = 0;       // 남긴 음만 놓았을 때의 위치
  let lastOnset = 0;
  let principalKept = true;
  const move = (before, amount) => {
    const el = doc.createElement(amount < 0 ? 'backup' : 'forward');
    el.appendChild(doc.createElement('duration')).textContent = Math.abs(amount);
    m.insertBefore(el, before);
  };
  for (const c of kids(m)) {
    const name = c.tagName;
    if (name === 'attributes') {
      const d = kid(c, 'divisions');
      if (d) divisions = +d.textContent || 1;
      for (const s of kids(c, 'staves')) s.remove();
      for (const cl of kids(c, 'clef')) {
        if ((cl.getAttribute('number') || '1') === String(n)) cl.removeAttribute('number');
        else cl.remove();
      }
    } else if (name === 'backup') {
      pos -= +txt(c, 'duration', 0);
      c.remove();
    } else if (name === 'forward') {
      pos += +txt(c, 'duration', 0);
      c.remove();
    } else if (name === 'direction') {
      if (+txt(c, 'staff', 1) !== n) c.remove();
      else kid(c, 'staff') && (kid(c, 'staff').textContent = '1');
    } else if (name === 'note') {
      const chord = !!kid(c, 'chord');
      const grace = !!kid(c, 'grace');
      const dur = +txt(c, 'duration', 0);
      const onset = chord ? lastOnset : pos;
      if (!chord) lastOnset = pos;
      if (!chord && !grace) pos += dur;
      if (+txt(c, 'staff', 1) !== n) {
        if (!chord) principalKept = false;
        c.remove();
        continue;
      }
      let asPrincipal = !chord;
      if (chord && !principalKept) { kid(c, 'chord').remove(); asPrincipal = true; principalKept = true; }
      if (!chord) principalKept = true;
      if (asPrincipal) {
        if (onset < cur) move(c, onset - cur);
        else if (onset > cur) move(c, onset - cur);
        cur = onset + (grace ? 0 : dur);
      }
      if (kid(c, 'staff')) kid(c, 'staff').textContent = '1';
    }
  }
  void divisions;
}

function injectState(doc, mEl, st) {
  const attrs = doc.createElement('attributes');
  append(doc, attrs, 'divisions', {}, st.divisions);
  const lead = kids(mEl).find((c) => c.tagName !== 'barline');
  const own = lead?.tagName === 'attributes' ? lead : null;
  const pick = (name) => (own && kid(own, name)) || (st[name] ? doc.importNode(st[name], true) : null);
  const key = pick('key');
  if (key) attrs.appendChild(key.cloneNode(true));
  const time = pick('time');
  if (time) attrs.appendChild(time.cloneNode(true));
  const staves = pick('staves');
  if (staves) attrs.appendChild(staves.cloneNode(true));
  const clefs = { ...st.clefs };
  if (own) for (const cl of kids(own, 'clef')) clefs[cl.getAttribute('number') || '1'] = cl;
  for (const n of Object.keys(clefs).sort()) attrs.appendChild(doc.importNode(clefs[n], true));
  own?.remove();
  mEl.insertBefore(attrs, mEl.firstChild);
  // 구간 앞에서 시작된 8va를 이어 준다.
  let after = attrs.nextSibling;
  for (const [num, sh] of Object.entries(st.shifts)) {
    const dir = doc.createElement('direction');
    const dt = append(doc, dir, 'direction-type');
    append(doc, dt, 'octave-shift', { type: sh.type, size: sh.size || '8', number: num });
    const staff = kid(sh.el, 'staff');
    if (staff) dir.appendChild(doc.importNode(staff, true));
    mEl.insertBefore(dir, after);
    after = dir.nextSibling;
  }
}

function closeShifts(doc, partEl, nextState) {
  if (!nextState) return;
  const last = kids(partEl, 'measure').at(-1);
  if (!last) return;
  for (const [num, sh] of Object.entries(nextState.shifts)) {
    const dir = append(doc, last, 'direction');
    const dt = append(doc, dir, 'direction-type');
    append(doc, dt, 'octave-shift', { type: 'stop', size: sh.size || '8', number: num });
    const staff = kid(sh.el, 'staff');
    if (staff) dir.appendChild(doc.importNode(staff, true));
  }
}

// 구간 경계에서 짝을 잃은 슬러·붙임줄·헤어핀·페달을 지운다.
function pruneSpanners(partEl) {
  const open = { wedge: new Map(), 'octave-shift': new Map(), pedal: new Map() };
  const slurs = new Map();
  const ties = new Map();
  const dropDirection = (el) => el.closest('direction')?.remove();

  for (const m of kids(partEl, 'measure')) {
    for (const c of kids(m)) {
      if (c.tagName === 'direction') {
        for (const name of Object.keys(open)) {
          const el = c.querySelector(name);
          if (!el) continue;
          const num = el.getAttribute('number') || '1';
          const type = el.getAttribute('type');
          if (type === 'stop' || type === 'discontinue') {
            if (open[name].has(num)) open[name].delete(num);
            else dropDirection(el);
          } else if (type !== 'change' && type !== 'continue') {
            open[name].set(num, el);
          }
        }
      } else if (c.tagName === 'note') {
        const voiceKey = txt(c, 'staff', '1');
        for (const s of c.querySelectorAll('slur')) {
          const key = `${voiceKey}:${s.getAttribute('number') || '1'}`;
          const type = s.getAttribute('type');
          if (type === 'start') slurs.set(key, s);
          else if (type === 'stop') {
            if (slurs.has(key)) slurs.delete(key);
            else s.remove();
          }
        }
        const pitch = kid(c, 'pitch');
        if (pitch) {
          const key = `${voiceKey}:${pitch.textContent.replace(/\s+/g, '')}`;
          const hasStop = kids(c, 'tie').some((t) => t.getAttribute('type') === 'stop');
          if (hasStop && !ties.has(key)) {
            for (const t of kids(c, 'tie')) if (t.getAttribute('type') === 'stop') t.remove();
            for (const t of c.querySelectorAll('tied[type="stop"]')) t.remove();
          } else if (hasStop) ties.delete(key);
          if (kids(c, 'tie').some((t) => t.getAttribute('type') === 'start')) ties.set(key, c);
        }
      }
    }
  }
  for (const el of open.wedge.values()) dropDirection(el);
  for (const el of open.pedal.values()) dropDirection(el);
  for (const s of slurs.values()) s.remove();
  for (const c of ties.values()) {
    for (const t of kids(c, 'tie')) if (t.getAttribute('type') === 'start') t.remove();
    for (const t of c.querySelectorAll('tied[type="start"]')) t.remove();
  }
}

// 압축된 .mxl(zip)에서 악보 XML을 꺼낸다.
export async function readScoreFile(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return new TextDecoder().decode(bytes);
  const view = new DataView(buf);
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('손상된 MXL 파일입니다.');
  const entries = new Map();
  let p = view.getUint32(eocd + 16, true);
  for (let i = 0, n = view.getUint16(eocd + 10, true); i < n; i++) {
    const nameLen = view.getUint16(p + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, {
      method: view.getUint16(p + 10, true), size: view.getUint32(p + 20, true), offset: view.getUint32(p + 42, true),
    });
    p += 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  const read = async (e) => {
    const start = e.offset + 30 + view.getUint16(e.offset + 26, true) + view.getUint16(e.offset + 28, true);
    const raw = bytes.subarray(start, start + e.size);
    if (e.method === 0) return new TextDecoder().decode(raw);
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  };
  let target = null;
  if (entries.has('META-INF/container.xml')) {
    const c = await read(entries.get('META-INF/container.xml'));
    const path = new DOMParser().parseFromString(c, 'application/xml').querySelector('rootfile')?.getAttribute('full-path');
    target = path && entries.get(path);
  }
  target ||= [...entries].find(([n]) => /\.(musicxml|xml)$/i.test(n) && !n.startsWith('META-INF'))?.[1];
  if (!target) throw new Error('MXL 안에서 악보를 찾지 못했습니다.');
  return read(target);
}
