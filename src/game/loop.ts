import { createAudio } from "./audio";
import { drawParticles, drawWorld, spawnDust, type Camera, type Particle } from "./render";
import { createRunFor, stepRun, wheelPoints, type InputState, type Run, type StepEvent } from "./sim";
import type { TrackId } from "./tracks";

export type Screen = "menu" | "play" | "crash" | "finish";

export type World = {
  screen: Screen;
  trackId: TrackId;
  shakeOn: boolean;
  muted: boolean;
  held: Set<string>;
  touch: { throttle: boolean; brake: boolean; noseUp: boolean; noseDown: boolean };
};

export type Hud = {
  mph: number;
  time: number;
  combo: number;
  progress: number;
  callout: string;
  dist: number;
  endless: boolean;
};

export type EndInfo = {
  reason: string;
  time: number;
  dist: number;
  combo: number;
  trackId: TrackId;
};

type MountOpts = {
  canvas: HTMLCanvasElement;
  world: World;
  onHud: (h: Hud) => void;
  onEnd: (screen: "crash" | "finish", info: EndInfo) => void;
};

function inputOf(world: World): InputState {
  const h = world.held;
  const t = world.touch;
  const throttle = h.has("KeyD") || h.has("ArrowRight") || h.has("Space") || t.throttle ? 1 : 0;
  const brake = h.has("KeyA") || h.has("ArrowLeft") || t.brake ? 1 : 0;
  let lean = 0;
  if (h.has("KeyW") || h.has("ArrowUp") || t.noseUp) lean += 1;
  if (h.has("KeyS") || h.has("ArrowDown") || t.noseDown) lean -= 1;
  return { throttle, brake, lean: Math.max(-1, Math.min(1, lean)) };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

export function mountGame(opts: MountOpts) {
  const { canvas, world, onHud, onEnd } = opts;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      unlock() {},
      restart() {},
      dispose() {},
    };
  }
  const draw = ctx;
  const audio = createAudio();
  const cam: Camera = { x: 200, y: 260, shake: 0, ox: 0, oy: 0 };
  const particles: Particle[] = [];
  let run: Run = createRunFor(world.trackId);
  let previewId = world.trackId;
  let bike: HTMLImageElement | null = null;
  let wheel: HTMLImageElement | null = null;
  void loadImage("/sprites/bike-body.png").then((img) => {
    bike = img;
  });
  void loadImage("/sprites/wheel.png").then((img) => {
    wheel = img;
  });
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let ended = false;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const fixed = 1 / 120;
  const events: StepEvent[] = [];

  const probe = {
    getYaw: () => 0,
    getPitch: () => run.angle,
    getSpeed: () => run.speed,
    getX: () => run.x,
    getScreen: () => world.screen,
    setKeys: (codes: string[]) => {
      world.held.clear();
      for (const c of codes) world.held.add(c);
    },
    setSteer: (_v: number) => {},
  };
  window.__controlsTest = probe;

  function resetRun() {
    run = createRunFor(world.trackId);
    previewId = world.trackId;
    ended = false;
    acc = 0;
    cam.x = run.x;
    cam.y = run.y;
    cam.shake = 0;
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const viewW = canvas.clientWidth || 1;
    const viewH = canvas.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.max(1, Math.floor(viewW * dpr));
    const bh = Math.max(1, Math.floor(viewH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    draw.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw.imageSmoothingEnabled = true;

    if (world.screen === "menu") {
      if (previewId !== world.trackId) {
        run = createRunFor(world.trackId);
        previewId = world.trackId;
        cam.x = run.x;
        cam.y = run.y;
      }
    } else if (world.screen === "play" || world.screen === "crash" || world.screen === "finish") {
      const playing = world.screen === "play";
      const input = playing ? inputOf(world) : { throttle: 0, brake: 0, lean: 0 };
      acc += dt;
      let steps = 0;
      while (acc >= fixed && steps < 8) {
        events.length = 0;
        stepRun(run, input, fixed, events);
        for (const e of events) {
          if (e.t === "launch" && Math.abs(run.speed) > 480) audio.launch();
          if (e.t === "land") {
            audio.land(e.grade);
            if (!reduced && world.shakeOn) cam.shake = Math.min(1, cam.shake + (e.grade === "perfect" ? 0.45 : 0.3));
            const w = wheelPoints(run);
            spawnDust(particles, w.rear.x, w.rear.y, 1, e.grade === "perfect" ? 14 : 8, e.grade === "perfect");
          }
          if (e.t === "crash") {
            audio.crash();
            if (!reduced && world.shakeOn) cam.shake = 1;
            spawnDust(particles, run.x, run.y, 1, 22, true);
            if (!ended) {
              ended = true;
              onEnd("crash", {
                reason: run.crashReason,
                time: run.time,
                dist: run.x,
                combo: run.bestCombo,
                trackId: world.trackId,
              });
            }
          }
          if (e.t === "finish") {
            audio.finish();
            if (!ended) {
              ended = true;
              onEnd("finish", {
                reason: "finish",
                time: run.time,
                dist: run.x,
                combo: run.bestCombo,
                trackId: world.trackId,
              });
            }
          }
        }
        acc -= fixed;
        steps++;
      }
      if (playing && run.mode === "ground" && input.throttle > 0 && Math.abs(run.speed) > 80) {
        if (Math.random() < 0.35) {
          const w = wheelPoints(run);
          spawnDust(particles, w.rear.x, w.rear.y - 4, Math.sign(run.speed) || 1, 1);
        }
      }
    }

    const worldW = viewW < 560 ? 600 : viewW < 1100 ? 980 : 1180;
    const zoom = viewW / worldW;
    const anchorX = viewW * 0.34;
    const anchorY = viewH * (viewW < 960 ? 0.58 : 0.62);
    const look = world.screen === "menu" ? 40 : 70 + Math.max(0, run.speed) * 0.12;
    const tx = run.x + look;
    const ty = run.y + 24;
    const blend = 1 - Math.exp(-4.2 * dt);
    cam.x += (tx - cam.x) * blend;
    cam.y += (ty - cam.y) * blend;
    if (reduced || !world.shakeOn) cam.shake = 0;
    else cam.shake = Math.max(0, cam.shake - dt * 1.4);
    cam.ox = Math.sin(now * 0.045) * 18;
    cam.oy = Math.cos(now * 0.037) * 12;

    audio.setMuted(world.muted);
    audio.update(run.speed, inputOf(world).throttle, world.screen === "play");

    drawWorld(draw, run, cam, viewW, viewH, zoom, anchorX, anchorY, bike, wheel, reduced);
    drawParticles(draw, particles, cam, zoom, anchorX, anchorY, dt);

    const finish = run.track.finish;
    onHud({
      mph: Math.round(Math.abs(run.speed) * 0.072),
      time: run.time,
      combo: run.combo,
      progress: finish ? Math.max(0, Math.min(1, run.x / finish)) : 0,
      callout: run.calloutT > 0 ? run.callout : "",
      dist: Math.max(0, Math.floor(run.x / 12)),
      endless: finish == null,
    });
  }

  raf = requestAnimationFrame(frame);

  return {
    unlock: () => audio.unlock(),
    restart: () => resetRun(),
    dispose: () => {
      cancelAnimationFrame(raf);
      if (window.__controlsTest === probe) delete window.__controlsTest;
    },
  };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getPitch: () => number;
      getSpeed: () => number;
      getX: () => number;
      getScreen?: () => string;
      setKeys: (codes: string[]) => void;
      setSteer: (v: number) => void;
    };
  }
}
