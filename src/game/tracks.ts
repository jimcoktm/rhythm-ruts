export type TrackId = "warmup" | "whoops" | "bigair" | "endless";

export type Track = {
  id: TrackId;
  name: string;
  blurb: string;
  dx: number;
  ys: number[];
  length: number;
  finish: number | null;
  rngState: number;
};

export const TRACK_LIST: { id: TrackId; name: string; blurb: string; index: string }[] = [
  { id: "warmup", name: "Warmup Ruts", blurb: "Tables, whoops, one double.", index: "01" },
  { id: "whoops", name: "Whoop Valley", blurb: "Keep the wheels chattering.", index: "02" },
  { id: "bigair", name: "Big Air", blurb: "Nose down or case the face.", index: "03" },
  { id: "endless", name: "Open Desert", blurb: "How far before you fold.", index: "04" },
];

const DX = 4;

function lastY(track: Track) {
  return track.ys[track.ys.length - 1] ?? 240;
}

function sync(track: Track) {
  track.length = Math.max(0, track.ys.length - 1) * track.dx;
}

function addFlat(track: Track, len: number) {
  const y0 = lastY(track);
  const n = Math.max(1, Math.round(len / track.dx));
  for (let i = 0; i < n; i++) track.ys.push(y0);
  sync(track);
}

type Ease = "smooth" | "kick" | "land";

function easeOf(t: number, ease: Ease) {
  if (ease === "kick") return 1 - Math.cos((t * Math.PI) / 2);
  if (ease === "land") return Math.sin((t * Math.PI) / 2);
  return t * t * (3 - 2 * t);
}

function addSlope(track: Track, len: number, dy: number, ease: Ease = "smooth") {
  const y0 = lastY(track);
  const n = Math.max(1, Math.round(len / track.dx));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    track.ys.push(y0 + dy * easeOf(t, ease));
  }
  sync(track);
}

function addWhoops(track: Track, count: number, width: number, amp: number) {
  const base = lastY(track);
  const n = Math.max(1, Math.round((count * width) / track.dx));
  for (let i = 1; i <= n; i++) {
    const phase = ((i * track.dx) / width) * Math.PI;
    const s = Math.sin(phase);
    track.ys.push(base + amp * s * s);
  }
  sync(track);
}

function addTable(track: Track, ramp: number, rise: number, top: number, down: number) {
  addSlope(track, ramp, rise, "kick");
  addFlat(track, top);
  addSlope(track, down, -rise, "land");
}

function addJump(track: Track, ramp: number, rise: number, gap: number, land: number) {
  const base = lastY(track);
  addSlope(track, ramp, rise, "kick");
  const lip = lastY(track);
  const valleyY = lip - Math.min(70, 36 + rise * 0.12);
  addSlope(track, 170, valleyY - lip, "smooth");
  const pit = Math.max(36, gap - 280);
  addFlat(track, pit);
  const peak = lip - 18;
  addSlope(track, 170, peak - lastY(track), "smooth");
  addSlope(track, land, base - lastY(track), "land");
}

function comfort(track: Track) {
  const y = lastY(track);
  if (y < 170) addSlope(track, 240, 210 - y, "smooth");
  else if (y > 460) addSlope(track, 260, 340 - y, "smooth");
}

function blank(id: TrackId, name: string, blurb: string, seed: number): Track {
  return { id, name, blurb, dx: DX, ys: [], length: 0, finish: null, rngState: seed };
}

function rand(track: Track) {
  track.rngState = (track.rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(track.rngState ^ (track.rngState >>> 15), 1 | track.rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function buildWarmup(track: Track) {
  track.ys.push(250);
  addFlat(track, 780);
  addTable(track, 210, 70, 80, 250);
  addFlat(track, 300);
  addWhoops(track, 7, 168, 30);
  addFlat(track, 260);
  addTable(track, 230, 100, 40, 290);
  addFlat(track, 240);
  addJump(track, 230, 110, 250, 320);
  comfort(track);
  addFlat(track, 280);
  addWhoops(track, 8, 150, 38);
  addFlat(track, 220);
  addTable(track, 190, 90, 36, 220);
  addFlat(track, 140);
  addTable(track, 180, 110, 24, 230);
  addFlat(track, 120);
  addTable(track, 170, 120, 16, 250);
  addFlat(track, 260);
  addJump(track, 250, 140, 280, 340);
  comfort(track);
  addFlat(track, 240);
  addWhoops(track, 6, 160, 34);
  addFlat(track, 200);
  addTable(track, 250, 130, 30, 320);
  addFlat(track, 640);
  track.finish = track.length - 280;
}

function buildWhoops(track: Track) {
  track.ys.push(260);
  addFlat(track, 640);
  addWhoops(track, 8, 180, 28);
  addFlat(track, 180);
  addWhoops(track, 10, 150, 40);
  addFlat(track, 200);
  addSlope(track, 280, 80, "smooth");
  addWhoops(track, 8, 140, 36);
  addSlope(track, 320, -90, "land");
  addFlat(track, 200);
  addTable(track, 200, 80, 30, 220);
  addFlat(track, 160);
  addWhoops(track, 12, 132, 44);
  addFlat(track, 220);
  addJump(track, 220, 100, 230, 280);
  comfort(track);
  addFlat(track, 180);
  addWhoops(track, 9, 124, 42);
  addFlat(track, 160);
  addSlope(track, 180, 70, "kick");
  addFlat(track, 220);
  addWhoops(track, 8, 150, 34);
  addFlat(track, 180);
  addTable(track, 210, 110, 20, 260);
  addFlat(track, 140);
  addWhoops(track, 10, 118, 40);
  addFlat(track, 700);
  track.finish = track.length - 300;
}

function buildBigAir(track: Track) {
  track.ys.push(240);
  addFlat(track, 980);
  addJump(track, 280, 140, 270, 340);
  comfort(track);
  addFlat(track, 380);
  addTable(track, 220, 80, 24, 260);
  addFlat(track, 160);
  addJump(track, 300, 160, 300, 360);
  comfort(track);
  addFlat(track, 340);
  addJump(track, 250, 130, 250, 300);
  addFlat(track, 150);
  addJump(track, 250, 140, 260, 310);
  addFlat(track, 140);
  addJump(track, 240, 150, 270, 320);
  comfort(track);
  addFlat(track, 300);
  addWhoops(track, 6, 170, 32);
  addFlat(track, 260);
  addJump(track, 320, 170, 320, 380);
  comfort(track);
  addFlat(track, 280);
  addTable(track, 240, 120, 16, 280);
  addFlat(track, 720);
  track.finish = track.length - 320;
}

export function extendEndless(track: Track) {
  const k = 1 + Math.min(1.15, track.length / 22000);
  for (let n = 0; n < 3; n++) {
    const roll = rand(track);
    if (roll < 0.34) {
      addWhoops(track, 6 + Math.floor(rand(track) * 5), 130 + rand(track) * 40, (26 + rand(track) * 16) * Math.min(k, 1.4));
      addFlat(track, 160 + rand(track) * 80);
    } else if (roll < 0.62) {
      const rise = 70 + rand(track) * 50 * k;
      addTable(track, 180 + rand(track) * 40, rise, 16 + rand(track) * 30, 200 + rand(track) * 60);
      addFlat(track, 140);
    } else {
      const rise = 90 + rand(track) * 50 * Math.min(k, 1.3);
      addJump(track, 210 + rand(track) * 50, rise, 220 + rand(track) * 50, 280 + rand(track) * 40);
      comfort(track);
      addFlat(track, 200);
    }
  }
}

export function makeTrack(id: TrackId): Track {
  const meta = TRACK_LIST.find((t) => t.id === id) ?? TRACK_LIST[0];
  const track = blank(id, meta.name, meta.blurb, id === "endless" ? (Date.now() & 0xfffffff) : 101);
  if (id === "warmup") buildWarmup(track);
  else if (id === "whoops") buildWhoops(track);
  else if (id === "bigair") buildBigAir(track);
  else {
    track.ys.push(250);
    addFlat(track, 900);
    addTable(track, 200, 60, 70, 220);
    addFlat(track, 240);
    addWhoops(track, 6, 170, 26);
    addFlat(track, 200);
    extendEndless(track);
    track.finish = null;
  }
  return track;
}

export function sampleHeight(track: Track, x: number) {
  const { ys, dx } = track;
  if (ys.length === 0) return 240;
  if (x <= 0) return ys[0];
  const max = ys.length - 1;
  const f = x / dx;
  if (f >= max) return ys[max];
  const i = Math.floor(f);
  const t = f - i;
  return ys[i] * (1 - t) + ys[i + 1] * t;
}

export function sampleSlope(track: Track, x: number) {
  const d = 12;
  return Math.atan2(sampleHeight(track, x + d) - sampleHeight(track, x - d), d * 2);
}
