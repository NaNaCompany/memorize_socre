// 마디별 숙련도, 보관함 목록, 올린 악보 본문을 브라우저에 저장한다.
// 목록·진도는 localStorage, 악보 본문(수 MB)은 IndexedDB. 저장소를 못 쓰면 이번 세션 동안만 유지한다.

const KEY = 'memscore:v1:';
const memory = new Map();
const xmlMemory = new Map();

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* 사생활 보호 모드 등 */ }
  return memory.has(key) ? memory.get(key) : fallback;
}

function write(key, value) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const today = () => new Date().toISOString().slice(0, 10);

export class Progress {
  constructor(pieceId, measureCount) {
    this.key = `${KEY}progress:${pieceId}`;
    this.count = measureCount;
    this.data = read(this.key, { m: {}, days: {}, total: 0, right: 0 });
  }

  static clear(pieceId) {
    const key = `${KEY}progress:${pieceId}`;
    memory.delete(key);
    try { localStorage.removeItem(key); } catch { /* 무시 */ }
  }

  // value: 0(틀림) ~ 1(맞음)
  record(indices, value) {
    const now = Date.now();
    for (const i of [].concat(indices)) {
      const e = this.data.m[i] ?? { s: value, n: 0, streak: 0, due: 0 };
      e.s = e.n ? e.s * 0.65 + value * 0.35 : value;
      e.n++;
      e.streak = value >= 0.8 ? e.streak + 1 : 0;
      e.due = now + (value >= 0.8 ? 6 * 3600e3 * 2 ** Math.min(e.streak, 7) : 10 * 60e3);
      this.data.m[i] = e;
    }
    this.data.total++;
    this.data.right += value;
    this.data.days[today()] = (this.data.days[today()] || 0) + 1;
    write(this.key, this.data);
  }

  mastery(i) {
    return this.data.m[i]?.s ?? null;
  }

  weight(i) {
    const e = this.data.m[i];
    if (!e) return 2.2;
    return 0.3 + (1 - e.s) * 3 + (Date.now() > e.due ? 1 : 0);
  }

  pickStart(from, to, len) {
    const last = to - len + 1;
    if (last < from) return from;
    const options = [];
    let sum = 0;
    for (let s = from; s <= last; s++) {
      let w = 0;
      for (let k = 0; k < len; k++) w += this.weight(s + k);
      sum += w;
      options.push([s, sum]);
    }
    const r = Math.random() * sum;
    return options.find(([, acc]) => r <= acc)[0];
  }

  stats() {
    const seen = Object.values(this.data.m);
    const avg = this.count ? seen.reduce((a, e) => a + e.s, 0) / this.count : 0;
    let streak = 0;
    const d = new Date();
    if (!this.data.days[today()]) d.setDate(d.getDate() - 1);
    while (this.data.days[d.toISOString().slice(0, 10)]) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return {
      seen: seen.length, avg, total: this.data.total,
      accuracy: this.data.total ? this.data.right / this.data.total : 0, streak,
      due: seen.filter((e) => Date.now() > e.due).length,
    };
  }

  reset() {
    this.data = { m: {}, days: {}, total: 0, right: 0 };
    write(this.key, this.data);
  }
}

export const loadLibrary = () => read(`${KEY}library`, []);
export const saveLibrary = (list) => write(`${KEY}library`, list);
export const loadPrefs = () => read(`${KEY}prefs`, {});
export const savePrefs = (prefs) => write(`${KEY}prefs`, prefs);

let dbPromise;
function openDb() {
  dbPromise ||= new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB 없음')); return; }
    const req = indexedDB.open('memscore', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('xml');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('xml', mode);
    const req = fn(t.objectStore('xml'));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// 저장에 성공했는지를 돌려준다. 실패해도 이번 세션에서는 메모리로 쓴다.
export async function putXml(id, xml) {
  xmlMemory.set(id, xml);
  try { await tx('readwrite', (s) => s.put(xml, id)); return true; } catch { return false; }
}

export async function getXml(id) {
  try {
    const v = await tx('readonly', (s) => s.get(id));
    if (v) return v;
  } catch { /* 메모리로 */ }
  return xmlMemory.get(id) ?? null;
}

export async function deleteXml(id) {
  xmlMemory.delete(id);
  try { await tx('readwrite', (s) => s.delete(id)); } catch { /* 이미 없음 */ }
}
