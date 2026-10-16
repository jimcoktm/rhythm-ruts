import { extendEndless, makeTrack, sampleHeight, sampleSlope, type Track, type TrackId } from "./tracks";

export const WHEEL_R = 18;
export const WHEELBASE = 112;
export const GRAVITY = 1580;
const ACCEL = 640;
const BRAKE = 1100;
const DRAG = 0.85;
export const VMAX = 760;
const HB = WHEELBASE / 2;

export type InputState = { throttle: number; brake: number; lean: number };

export type StepEvent =
  | { t: "launch" }
  | { t: "land"; grade: "perfect" | "good" | "sketchy" }
  | { t: "crash"; reason: string }
  | { t: "finish" };

export type Run = {
  track: Track;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  angle: number;
  angVel: number;
  groundAngle: number;
  prevGround: number;
  mode: "ground" | "air" | "crash";
  airTime: number;
  time: number;
  combo: number;
  bestCombo: number;
  crashed: boolean;
  finished: boolean;
  crashT: number;
  crashReason: string;
  callout: string;
  calloutT: number;
  calloutGrade: string;
  wheelSpin: number;
  launchPlayed: boolean;
  lean: number;
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function normAngle(a: number) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

export function conform(track: Track, x: number) {
  let ang = sampleSlope(track, x);
  for (let i = 0; i < 3; i++) {
    const rx = x - Math.cos(ang) * HB;
    const fx = x + Math.cos(ang) * HB;
    const ry = sampleHeight(track, rx) + WHEEL_R;
    const fy = sampleHeight(track, fx) + WHEEL_R;
    ang = Math.atan2(fy - ry, fx - rx || 1);
  }
  const rx = x - Math.cos(ang) * HB;
  const ry = sampleHeight(track, rx) + WHEEL_R;
  const y = ry + Math.sin(ang) * HB;
  return { y, angle: ang };
}

export function wheelPoints(run: Run) {
  const c = Math.cos(run.angle);
  const s = Math.sin(run.angle);
  return {
    rear: { x: run.x - c * HB, y: run.y - s * HB },
    front: { x: run.x + c * HB, y: run.y + s * HB },
  };
}

export function createRun(track: Track): Run {
  const x = 230;
  const g = conform(track, x);
  return {
    track,
    x,
    y: g.y,
    vx: 0,
    vy: 0,
    speed: 0,
    angle: g.angle,
    angVel: 0,
    groundAngle: g.angle,
    prevGround: g.angle,
    mode: "ground",
    airTime: 0,
    time: 0,
    combo: 0,
    bestCombo: 0,
    crashed: false,
    finished: false,
    crashT: 0,
    crashReason: "",
    callout: "",
    calloutT: 0,
    calloutGrade: "",
    wheelSpin: 0,
    launchPlayed: false,
    lean: 0,
  };
}

export function createRunFor(id: TrackId) {
  return createRun(makeTrack(id));
}

function say(run: Run, text: string, grade: string) {
  run.callout = text;
  run.calloutGrade = grade;
  run.calloutT = 0.95;
}

function crash(run: Run, reason: string, events: StepEvent[]) {
  if (run.finished || run.crashed) return;
  run.mode = "crash";
  run.crashed = true;
  run.crashReason = reason;
  run.combo = 0;
  run.angVel = run.angle >= 0 ? 4.2 : -4.2;
  run.vy = Math.max(run.vy, 140);
  run.vx *= 0.45;
  say(run, reason === "looped" ? "LOOPED OUT" : "CASED IT", "crash");
  events.push({ t: "crash", reason });
}

function absorb(run: Run) {
  const g = conform(run.track, run.x);
  const along = run.vx * Math.cos(g.angle) + run.vy * Math.sin(g.angle);
  if (Number.isFinite(along) && Math.abs(along) > 20) run.speed = clamp(along, -190, VMAX);
  run.mode = "ground";
  run.y = g.y;
  run.groundAngle = g.angle;
  run.prevGround = g.angle;
  run.angle = g.angle;
  run.vx = 0;
  run.vy = 0;
  run.airTime = 0;
}

function land(run: Run, slope: number, events: StepEvent[]) {
  const err = normAngle(run.angle - slope);
  const nx = -Math.sin(slope);
  const ny = Math.cos(slope);
  const vn = run.vx * nx + run.vy * ny;
  const ae = Math.abs(err);
  if (ae > 0.98 || (vn < -980 && ae > 0.62)) {
    crash(run, Math.abs(run.angle) > 1.35 ? "looped" : "cased", events);
    return;
  }
  let grade: "perfect" | "good" | "sketchy" = "sketchy";
  if (ae < 0.24) grade = "perfect";
  else if (ae < 0.5) grade = "good";
  const along = run.vx * Math.cos(slope) + run.vy * Math.sin(slope);
  run.speed = along;
  if (grade === "perfect") {
    run.combo += 1;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    run.speed += 95 + Math.min(5, run.combo) * 12;
    say(run, run.combo >= 3 ? `WHIP x${run.combo}` : "STUCK IT", "perfect");
  } else if (grade === "good") {
    run.speed += 40;
    say(run, "CLEAN", "good");
  } else {
    run.combo = 0;
    run.speed *= 0.74;
    say(run, "SKETCHY", "sketchy");
  }
  run.speed = clamp(run.speed, -60, VMAX);
  run.mode = "ground";
  run.airTime = 0;
  run.vx = 0;
  run.vy = 0;
  const g = conform(run.track, run.x);
  run.y = g.y;
  run.groundAngle = g.angle;
  run.prevGround = g.angle;
  run.angle = slope + err * 0.22;
  events.push({ t: "land", grade });
}

export function stepRun(run: Run, input: InputState, dt: number, events: StepEvent[]) {
  if (run.calloutT > 0) run.calloutT = Math.max(0, run.calloutT - dt);
  run.lean = input.lean;
  run.wheelSpin += (run.speed / WHEEL_R) * dt;

  if (run.track.finish == null && run.x > run.track.length - 2600) {
    extendEndless(run.track);
  }

  if (run.mode === "crash") {
    run.crashT += dt;
    if (run.crashT < 1.5) {
      run.vy -= GRAVITY * dt;
      run.x += run.vx * dt;
      run.y += run.vy * dt;
      run.angle += run.angVel * dt;
      const floor = sampleHeight(run.track, run.x) + WHEEL_R;
      if (run.y < floor) {
        run.y = floor;
        run.vy = Math.abs(run.vy) * 0.28;
        run.vx *= 0.55;
        run.angVel *= -0.45;
      }
    }
    return;
  }

  const throttle = run.finished ? 0 : input.throttle;
  const brake = run.finished ? 1 : input.brake;
  const lean = run.finished ? 0 : input.lean;

  if (run.mode === "ground") {
    const dir = run.groundAngle;
    run.speed += throttle * ACCEL * dt;
    run.speed -= brake * BRAKE * dt;
    run.speed -= run.speed * DRAG * dt;
    run.speed -= Math.sin(dir) * 980 * dt;
    run.speed = clamp(run.speed, -190, VMAX);

    let nextX = run.x + run.speed * Math.cos(dir) * dt;
    if (nextX < 120) {
      nextX = 120;
      if (run.speed < 0) run.speed = 0;
    }
    const g = conform(run.track, nextX);
    const haveVy = run.speed * Math.sin(dir);
    const neededVy = (g.y - run.y) / Math.max(dt, 1 / 240);
    const fallingAway = neededVy < haveVy - GRAVITY * dt - 160;

    if (!run.finished && run.speed > 280 && fallingAway) {
      run.x = nextX;
      run.vx = run.speed * Math.cos(run.angle);
      run.vy = haveVy + 90;
      run.y += haveVy * dt + 16;
      run.angVel = clamp((dir - run.prevGround) / Math.max(dt, 1 / 240), -0.45, 0.45);
      run.mode = "air";
      run.airTime = 0;
      if (dir > 0.16) events.push({ t: "launch" });
    } else {
      run.x = nextX;
      run.y = g.y;
      run.groundAngle = g.angle;
      run.angVel = clamp((g.angle - run.prevGround) / Math.max(dt, 1 / 240), -2.6, 2.6);
      run.prevGround = g.angle;
      const target = g.angle + lean * 0.26;
      const k = 1 - Math.exp(-16 * dt);
      run.angle += (target - run.angle) * k;
    }
  } else {
    run.airTime += dt;
    run.vy -= GRAVITY * dt;
    run.vx -= run.vx * 0.04 * dt;
    const torque = lean * 5 + throttle * 0.7 - brake * 0.9;
    run.angVel = clamp(run.angVel + torque * dt, -2.6, 2.6);
    run.angle += run.angVel * dt;
    run.x += run.vx * dt;
    run.y += run.vy * dt;

    const c = Math.cos(run.angle);
    const s = Math.sin(run.angle);
    const wheels = [
      { x: run.x - c * HB, y: run.y - s * HB },
      { x: run.x + c * HB, y: run.y + s * HB },
    ];
    let maxPen = 0;
    let hitX = run.x;
    for (const w of wheels) {
      const pen = sampleHeight(run.track, w.x) + WHEEL_R - w.y;
      if (pen > maxPen) {
        maxPen = pen;
        hitX = w.x;
      }
    }
    if (maxPen > 0 && !(run.airTime < 0.14 && maxPen < 58)) {
      const slope = sampleSlope(run.track, hitX);
      const err = Math.abs(normAngle(run.angle - slope));
      if (run.vy > 60 && maxPen < 22) {
        run.y += maxPen + 2;
      } else if (run.finished || (run.airTime < 0.22 && err < 0.85)) {
        absorb(run);
      } else {
        land(run, slope, events);
      }
    }
  }

  if (!run.crashed && !run.finished) run.time += dt;

  if (!run.finished && !run.crashed && run.track.finish != null && run.x >= run.track.finish) {
    run.finished = true;
    say(run, "FINISH", "perfect");
    events.push({ t: "finish" });
  }
}
