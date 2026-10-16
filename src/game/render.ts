import { sampleHeight } from "./tracks";
import { wheelPoints, WHEEL_R, WHEELBASE, type Run } from "./sim";

export const PAL = {
  skyTop: "#f6f1e6",
  skyMid: "#f0d3b4",
  skyLow: "#e7b48a",
  hill: "#c48968",
  hillFar: "#d7a88a",
  dirt: "#8a4630",
  dirtDeep: "#5a2e22",
  lip: "#efd3b0",
  charcoal: "#141311",
  cream: "#f3efe6",
  rust: "#c45c32",
  gold: "#e2b657",
  dust: "#d7b292",
};

export type Camera = { x: number; y: number; shake: number; ox: number; oy: number };

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  kind: "dust" | "spark";
};

const REAR_U = 0.169;
const REAR_V = 0.926;
const FRONT_U = 0.875;
const AXLE_SPAN = FRONT_U - REAR_U;

export function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function worldToScreen(
  wx: number,
  wy: number,
  cam: Camera,
  zoom: number,
  anchorX: number,
  anchorY: number,
) {
  const mag = cam.shake * cam.shake;
  return {
    x: (wx - cam.x) * zoom + anchorX + cam.ox * mag,
    y: anchorY - (wy - cam.y) * zoom + cam.oy * mag,
  };
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  run: Run,
  cam: Camera,
  viewW: number,
  viewH: number,
  zoom: number,
  anchorX: number,
  anchorY: number,
  bike: HTMLImageElement | null,
  wheel: HTMLImageElement | null,
  reduced: boolean,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, viewH);
  sky.addColorStop(0, PAL.skyTop);
  sky.addColorStop(0.55, PAL.skyMid);
  sky.addColorStop(1, PAL.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.fillStyle = PAL.gold;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(viewW * 0.82, viewH * 0.16, Math.max(26, viewW * 0.034), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const to = (wx: number, wy: number) => worldToScreen(wx, wy, cam, zoom, anchorX, anchorY);

  ctx.fillStyle = PAL.hillFar;
  ctx.beginPath();
  const left = -30;
  const right = viewW + 30;
  ctx.moveTo(left, viewH);
  for (let sx = left; sx <= right; sx += 18) {
    const wx = (cam.x + (sx - anchorX) / zoom) * 0.35;
    const wy = 460 + Math.sin(wx * 0.01) * 50 + Math.sin(wx * 0.023) * 16;
    const p = to(cam.x + (sx - anchorX) / zoom, wy);
    ctx.lineTo(sx, p.y);
  }
  ctx.lineTo(right, viewH);
  ctx.fill();

  const x0 = cam.x - anchorX / zoom - 80;
  const x1 = cam.x + (viewW - anchorX) / zoom + 100;
  const step = 6;

  const groundPath = () => {
    ctx.beginPath();
    let started = false;
    for (let x = x0; x <= x1; x += step) {
      const p = to(x, sampleHeight(run.track, x));
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
  };

  groundPath();
  const end = to(x1, 0);
  const start = to(x0, 0);
  ctx.lineTo(end.x, viewH + 60);
  ctx.lineTo(start.x, viewH + 60);
  ctx.closePath();
  ctx.fillStyle = PAL.dirt;
  ctx.fill();

  ctx.beginPath();
  let started = false;
  for (let x = x0; x <= x1; x += step) {
    const p = to(x, sampleHeight(run.track, x) - 28);
    if (!started) {
      ctx.moveTo(p.x, p.y);
      started = true;
    } else ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(end.x, viewH + 60);
  ctx.lineTo(start.x, viewH + 60);
  ctx.closePath();
  ctx.fillStyle = PAL.dirtDeep;
  ctx.fill();

  groundPath();
  ctx.strokeStyle = PAL.lip;
  ctx.lineWidth = Math.max(2.5, 3.4 * zoom);
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.fillStyle = PAL.charcoal;
  ctx.globalAlpha = 0.25;
  for (let x = Math.floor(x0 / 90) * 90; x < x1; x += 90) {
    const h = hash(x);
    if (h < 0.4) continue;
    const p = to(x + h * 24, sampleHeight(run.track, x) + 3);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 3 + h * 4, 2 + h * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (let x = Math.floor(x0 / 480) * 480; x < x1; x += 480) {
    if (x < 80) continue;
    const gy = sampleHeight(run.track, x);
    const base = to(x, gy);
    const top = to(x, gy + 56);
    ctx.strokeStyle = PAL.charcoal;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(top.x - 7, top.y - 8, 14, 10);
  }

  if (run.track.finish != null) {
    const fx = run.track.finish;
    const gy = sampleHeight(run.track, fx);
    const a = to(fx, gy);
    const b = to(fx, gy + 150);
    ctx.fillStyle = PAL.charcoal;
    ctx.fillRect(a.x - 3, Math.min(a.y, b.y), 6, Math.abs(a.y - b.y));
    const cells = 6;
    const bw = 42 * Math.max(0.7, zoom);
    const topY = Math.min(a.y, b.y);
    const botY = Math.max(a.y, b.y);
    const bh = (botY - topY) / cells;
    for (let i = 0; i < cells; i++) {
      ctx.fillStyle = i % 2 === 0 ? PAL.cream : PAL.charcoal;
      ctx.fillRect(a.x + 3, topY + i * bh, bw, bh + 0.5);
      ctx.fillStyle = i % 2 === 0 ? PAL.charcoal : PAL.cream;
      ctx.fillRect(a.x + 3 + bw, topY + i * bh, bw, bh + 0.5);
    }
  }

  drawBike(ctx, run, cam, zoom, anchorX, anchorY, bike, wheel);

  if (run.callout && run.calloutT > 0) {
    const k = run.calloutT / 0.95;
    const pop = reduced ? 1 : Math.min(1.08, 0.7 + (1 - k) * 1.6);
    const p = to(run.x, run.y + 110);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.06);
    ctx.scale(pop, pop);
    ctx.globalAlpha = Math.min(1, run.calloutT * 2.4);
    ctx.fillStyle =
      run.calloutGrade === "perfect" ? PAL.gold : run.calloutGrade === "sketchy" || run.calloutGrade === "crash" ? PAL.rust : PAL.cream;
    ctx.strokeStyle = PAL.charcoal;
    ctx.lineWidth = 6;
    ctx.font = `400 ${Math.round(28 + zoom * 10)}px "Archivo Black", Impact, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.strokeText(run.callout, 0, 0);
    ctx.fillText(run.callout, 0, 0);
    ctx.restore();
  }
}

function blitWheel(
  ctx: CanvasRenderingContext2D,
  wheel: HTMLImageElement | null,
  radius: number,
  spin: number,
) {
  ctx.save();
  ctx.rotate(spin);
  if (wheel && wheel.complete && wheel.naturalWidth) {
    ctx.drawImage(wheel, -radius, -radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = "#1c1916";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a342c";
    const knobs = 14;
    for (let i = 0; i < knobs; i++) {
      ctx.save();
      ctx.rotate((i / knobs) * Math.PI * 2);
      ctx.fillRect(-radius * 0.11, -radius * 1.04, radius * 0.22, radius * 0.2);
      ctx.restore();
    }
    ctx.strokeStyle = PAL.cream;
    ctx.lineWidth = Math.max(1.4, radius * 0.07);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, radius * 0.035);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.2;
      ctx.moveTo(Math.cos(a) * radius * 0.18, Math.sin(a) * radius * 0.18);
      ctx.lineTo(Math.cos(a) * radius * 0.55, Math.sin(a) * radius * 0.55);
    }
    ctx.stroke();
    ctx.fillStyle = PAL.rust;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBike(
  ctx: CanvasRenderingContext2D,
  run: Run,
  cam: Camera,
  zoom: number,
  anchorX: number,
  anchorY: number,
  bike: HTMLImageElement | null,
  wheel: HTMLImageElement | null,
) {
  const to = (wx: number, wy: number) => worldToScreen(wx, wy, cam, zoom, anchorX, anchorY);
  const wheels = wheelPoints(run);
  let lift = 0;
  if (run.mode === "ground") {
    for (const w of [wheels.rear, wheels.front]) {
      const pen = sampleHeight(run.track, w.x) + WHEEL_R - w.y;
      if (pen > lift) lift = pen;
    }
  }
  const rear = to(wheels.rear.x, wheels.rear.y + lift);
  const shadow = to(run.x, sampleHeight(run.track, run.x));
  const height = run.y - sampleHeight(run.track, run.x);
  ctx.save();
  ctx.fillStyle = PAL.charcoal;
  ctx.globalAlpha = Math.max(0.08, 0.3 - Math.max(0, height) / 480);
  ctx.beginPath();
  ctx.ellipse(shadow.x, shadow.y, 34 * zoom, 7 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const radius = WHEEL_R * zoom;
  ctx.save();
  ctx.translate(rear.x, rear.y);
  ctx.rotate(-run.angle);
  if (bike && bike.complete && bike.naturalWidth) {
    const worldW = (WHEELBASE / AXLE_SPAN) * zoom;
    const scale = worldW / bike.naturalWidth;
    const dw = bike.naturalWidth * scale;
    const dh = bike.naturalHeight * scale;
    ctx.drawImage(bike, -REAR_U * dw, -REAR_V * dh, dw, dh);
  } else {
    const wb = WHEELBASE * zoom;
    const z = zoom;
    ctx.strokeStyle = PAL.charcoal;
    ctx.lineWidth = 5.5 * z;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(8 * z, -2 * z);
    ctx.lineTo(wb * 0.46, -18 * z);
    ctx.lineTo(wb * 0.78, -12 * z);
    ctx.lineTo(wb * 0.92, -2 * z);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wb * 0.46, -18 * z);
    ctx.lineTo(wb * 0.58, -36 * z);
    ctx.lineTo(wb * 0.82, -30 * z);
    ctx.lineTo(wb * 0.9, -8 * z);
    ctx.stroke();
    ctx.fillStyle = PAL.rust;
    ctx.beginPath();
    ctx.ellipse(wb * 0.5, -32 * z, 18 * z, 10 * z, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.charcoal;
    ctx.beginPath();
    ctx.moveTo(wb * 0.18, -34 * z);
    ctx.lineTo(wb * 0.52, -38 * z);
    ctx.lineTo(wb * 0.5, -30 * z);
    ctx.lineTo(wb * 0.22, -28 * z);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.cream;
    ctx.fillRect(wb * 0.72, -46 * z, 16 * z, 12 * z);
    ctx.fillStyle = PAL.charcoal;
    ctx.fillRect(wb * 0.75, -43 * z, 10 * z, 2.2 * z);
  }
  blitWheel(ctx, wheel, radius, run.wheelSpin);
  ctx.save();
  ctx.translate(WHEELBASE * zoom, 0);
  blitWheel(ctx, wheel, radius, run.wheelSpin);
  ctx.restore();
  ctx.restore();
}

export function spawnDust(list: Particle[], x: number, y: number, dir: number, n: number, spark = false) {
  for (let i = 0; i < n; i++) {
    const slot = list.find((p) => p.life <= 0);
    const p: Particle = slot ?? { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, kind: "dust" };
    p.x = x + (Math.random() - 0.5) * 10;
    p.y = y;
    p.vx = -dir * (30 + Math.random() * 120);
    p.vy = 20 + Math.random() * 110;
    p.life = p.max = 0.3 + Math.random() * 0.35;
    p.size = spark ? 2 + Math.random() * 2 : 3 + Math.random() * 5;
    p.kind = spark ? "spark" : "dust";
    if (!slot) list.push(p);
  }
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  list: Particle[],
  cam: Camera,
  zoom: number,
  anchorX: number,
  anchorY: number,
  dt: number,
) {
  for (const p of list) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 30 * dt;
    const s = worldToScreen(p.x, p.y, cam, zoom, anchorX, anchorY);
    ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.65;
    ctx.fillStyle = p.kind === "spark" ? PAL.gold : PAL.dust;
    ctx.beginPath();
    ctx.arc(s.x, s.y, p.size * Math.max(0.6, zoom), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
