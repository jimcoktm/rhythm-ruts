import { useEffect, useRef, useState, type PointerEvent } from "react";
import { mountGame, type EndInfo, type Hud, type Screen, type World } from "@/game/loop";
import { TRACK_LIST, type TrackId } from "@/game/tracks";

type Save = { v: 1; times: Partial<Record<TrackId, number>>; dist: number };

const SAVE_KEY = "rhythm-ruts-v1";

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { v: 1, times: {}, dist: 0 };
    const parsed = JSON.parse(raw) as Save;
    if (!parsed || parsed.v !== 1) return { v: 1, times: {}, dist: 0 };
    return { v: 1, times: parsed.times ?? {}, dist: parsed.dist ?? 0 };
  } catch {
    return { v: 1, times: {}, dist: 0 };
  }
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const r = safe - m * 60;
  const whole = Math.floor(r);
  const frac = Math.floor((r - whole) * 100);
  return `${m}:${String(whole).padStart(2, "0")}.${String(frac).padStart(2, "0")}`;
}

export function RhythmRuts() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useRef<World>({
    screen: "menu",
    trackId: "warmup",
    shakeOn: typeof window === "undefined" ? true : !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    muted: false,
    held: new Set<string>(),
    touch: { throttle: false, brake: false, noseUp: false, noseDown: false },
  });
  const api = useRef<ReturnType<typeof mountGame> | null>(null);
  const mphRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const subRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [trackId, setTrackId] = useState<TrackId>("warmup");
  const [save, setSave] = useState<Save>({ v: 1, times: {}, dist: 0 });
  const [end, setEnd] = useState<EndInfo | null>(null);
  const [bestFlag, setBestFlag] = useState(false);
  const [muted, setMuted] = useState(false);
  const [endless, setEndless] = useState(false);
  const saveRef = useRef<Save>({ v: 1, times: {}, dist: 0 });

  useEffect(() => {
    const loaded = loadSave();
    saveRef.current = loaded;
    setSave(loaded);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const held = world.current.held;
    const onKeyDown = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      held.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => held.delete(e.code);
    const clear = () => held.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    const mounted = mountGame({
      canvas,
      world: world.current,
      onHud: (h: Hud) => {
        if (mphRef.current) mphRef.current.textContent = String(h.mph);
        if (mainRef.current) {
          mainRef.current.textContent = h.endless ? `${h.dist}m` : formatTime(h.time);
        }
        if (subRef.current) {
          subRef.current.textContent = h.combo > 1 ? `whip x${h.combo}` : h.endless ? "desert" : "time";
        }
        if (barRef.current) barRef.current.style.width = `${Math.round(h.progress * 100)}%`;
        if (liveRef.current && h.callout) liveRef.current.textContent = h.callout;
      },
      onEnd: (next, info) => {
        world.current.screen = next;
        const prev = saveRef.current;
        let best = false;
        const times = { ...prev.times };
        let dist = prev.dist;
        if (next === "finish") {
          const old = times[info.trackId];
          if (old == null || info.time < old) {
            times[info.trackId] = info.time;
            best = true;
          }
        }
        if (info.trackId === "endless") {
          const meters = Math.floor(info.dist / 12);
          if (meters > dist) {
            dist = meters;
            best = true;
          }
        }
        const nextSave: Save = { v: 1, times, dist };
        saveRef.current = nextSave;
        localStorage.setItem(SAVE_KEY, JSON.stringify(nextSave));
        setSave(nextSave);
        setBestFlag(best);
        setEnd(info);
        setScreen(next);
      },
    });
    api.current = mounted;
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      mounted?.dispose();
      api.current = null;
    };
  }, []);

  function pick(id: TrackId) {
    world.current.trackId = id;
    setTrackId(id);
  }

  function ride() {
    api.current?.unlock();
    world.current.trackId = trackId;
    world.current.screen = "play";
    world.current.touch = { throttle: false, brake: false, noseUp: false, noseDown: false };
    setEndless(trackId === "endless");
    setEnd(null);
    setBestFlag(false);
    api.current?.restart();
    setScreen("play");
  }

  function again() {
    api.current?.unlock();
    world.current.screen = "play";
    world.current.touch = { throttle: false, brake: false, noseUp: false, noseDown: false };
    setEnd(null);
    setBestFlag(false);
    api.current?.restart();
    setScreen("play");
  }

  function tracks() {
    world.current.screen = "menu";
    world.current.held.clear();
    world.current.touch = { throttle: false, brake: false, noseUp: false, noseDown: false };
    api.current?.restart();
    setScreen("menu");
  }

  function toggleMute() {
    const next = !world.current.muted;
    world.current.muted = next;
    setMuted(next);
  }

  function hold(key: "throttle" | "brake" | "noseUp" | "noseDown") {
    return {
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        world.current.touch[key] = true;
        e.currentTarget.dataset.held = "true";
      },
      onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
        world.current.touch[key] = false;
        e.currentTarget.dataset.held = "false";
      },
      onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => {
        world.current.touch[key] = false;
        e.currentTarget.dataset.held = "false";
      },
    };
  }

  const crashTitle = end?.reason === "looped" ? "Looped out" : "Cased it";

  return (
    <div className={`game-root ${screen === "menu" ? "is-menu" : "is-ride"}`}>
      <div className="stage">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Rhythm Ruts track" />
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {screen !== "menu" && (
        <div className="hud">
          <div className="hud-row">
            <button type="button" className="icon-btn" onClick={tracks}>
              Tracks
            </button>
            <div className="hud-stat" style={{ textAlign: "center" }}>
              <span ref={subRef}>{endless ? "desert" : "time"}</span>
              <strong ref={mainRef} className="time-readout">
                {endless ? "0m" : "0:00.00"}
              </strong>
            </div>
            <div className="hud-stat" style={{ textAlign: "right" }}>
              <span>mph</span>
              <strong ref={mphRef}>0</strong>
            </div>
          </div>
          {!endless && (
            <div className="progress" aria-hidden="true">
              <i ref={barRef} />
            </div>
          )}
        </div>
      )}

      {screen === "menu" && (
        <div className="menu-wrap">
          <div className="sheet">
            <div className="sheet-head">
              <div>
                <span className="menu-kicker">Straight dirt</span>
                <h1 className="wordmark">
                  RHYTHM
                  <br />
                  <em>RUTS</em>
                </h1>
              </div>
              <button type="button" className="ghost-btn" onClick={toggleMute}>
                {muted ? "Sound off" : "Sound on"}
              </button>
            </div>
            <p className="lede">No turning. Hold gas, nose the bike in the air, and match the landing.</p>
            <div className="track-grid">
              {TRACK_LIST.map((track) => {
                const best =
                  track.id === "endless"
                    ? save.dist > 0
                      ? `${save.dist}m`
                      : "No run yet"
                    : save.times[track.id] != null
                      ? formatTime(save.times[track.id]!)
                      : "No time yet";
                return (
                  <button
                    key={track.id}
                    type="button"
                    className="track-card"
                    aria-pressed={trackId === track.id}
                    onClick={() => pick(track.id)}
                  >
                    <span className="track-index">{track.index}</span>
                    <strong>{track.name}</strong>
                    <small>{track.blurb}</small>
                    <small>{best}</small>
                  </button>
                );
              })}
            </div>
            <div className="menu-actions">
              <button type="button" className="ride-btn" onClick={ride}>
                RIDE
              </button>
              <p className="keys">
                <span>Left thumb gas and brake</span>
                <span>Right thumb lean back and forward</span>
                <span>
                  <kbd>D</kbd> gas
                </span>
                <span>
                  <kbd>A</kbd> brake
                </span>
                <span>
                  <kbd>W</kbd> back
                </span>
                <span>
                  <kbd>S</kbd> forward
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {screen === "crash" && (
        <div className="overlay-wrap">
          <div className="sheet overlay-card">
            <span className="overlay-kicker">Down</span>
            <h2>{crashTitle}</h2>
            <p>
              {end?.trackId === "endless"
                ? "The desert keeps going. You did not."
                : "Bring the nose down the same way the dirt falls away."}
            </p>
            <div className="stat-line">
              {end?.trackId === "endless" ? `${Math.floor((end?.dist ?? 0) / 12)}m` : formatTime(end?.time ?? 0)}
            </div>
            <div className="menu-actions">
              <button type="button" className="primary-btn" onClick={again}>
                AGAIN
              </button>
              <button type="button" className="ghost-btn" onClick={tracks}>
                Tracks
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "finish" && (
        <div className="overlay-wrap">
          <div className="sheet overlay-card">
            <span className="overlay-kicker">{bestFlag ? "New best" : "Checked"}</span>
            <h2>Finish</h2>
            <p>{TRACK_LIST.find((t) => t.id === end?.trackId)?.name ?? "Rhythm Ruts"}</p>
            <div className="stat-line">{formatTime(end?.time ?? 0)}</div>
            <div className="menu-actions">
              <button type="button" className="primary-btn" onClick={again}>
                AGAIN
              </button>
              <button type="button" className="ghost-btn" onClick={tracks}>
                Tracks
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "play" && (
        <div className="deck">
          <div className="cluster cluster-left">
            <button type="button" className="pad pad-brake" {...hold("brake")}>
              BRAKE
              <small>A</small>
            </button>
            <button type="button" className="pad pad-gas" {...hold("throttle")}>
              GAS
              <small>D</small>
            </button>
          </div>
          <div className="cluster cluster-right">
            <button type="button" className="pad pad-nose" {...hold("noseUp")}>
              BACK
              <small>W</small>
            </button>
            <button type="button" className="pad pad-nose" {...hold("noseDown")}>
              FWD
              <small>S</small>
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
