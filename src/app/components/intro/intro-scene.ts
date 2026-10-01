import { createClouds } from '../atmosphere/cloud-shader';
import { grainTile, rng } from '../atmosphere/grain';

// The intro, drawn as a pure function of time so every frame can be rendered on its own.
// Three canvases, back to front: the WebGL sky, the out-of-focus gear, and a sharp one sized to
// the track player, which is the focal plane. Timed to a 128 BPM track that drops on beat 6.

export const BEAT = 60000 / 128;
export const DROP = BEAT * 6;
const INHALE = 230;
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";
const ORANGE = '#ff6b35';
const TRACK_SECONDS = 232;
const ARTIST = 'DJ GTiT';
const TITLE = 'Xomcloud Sessions Vol. 1 (Midnight Mix)';
// How far the record sticks out of its sleeve.
const SLIDE = 24;

export interface SceneElements {
  sky: HTMLCanvasElement;
  gear: HTMLCanvasElement;
  card: HTMLCanvasElement;
  logo: HTMLElement;
  tagline: HTMLElement;
  grain: HTMLElement;
  artwork: string;
}

const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
const smooth = (a: number, b: number, v: number): number => {
  const x = clamp((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const easeOut = (x: number): number => 1 - Math.pow(1 - clamp(x), 4);

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext('2d')!];
}

// A made-up four-minute track: intro, groove, breakdown, a build, a beat of air, the drop, outro.
// The playhead reaches the drop (u = 0.62) at DROP.
function amplitude(u: number, r: number): number {
  let level = 0.4;
  if (u < 0.1) level = 0.22;
  else if (u < 0.3) level = 0.55;
  else if (u < 0.42) level = 0.34;
  else if (u < 0.6) level = 0.32 + 0.55 * Math.pow((u - 0.42) / 0.18, 1.6);
  else if (u < 0.62) level = 0.2;
  else if (u < 0.86) level = 0.92;
  const groove = 0.75 + 0.25 * Math.abs(Math.sin(u * 420));
  return clamp(level * groove * (0.72 + r * 0.42), 0.04, 1);
}

interface Layout {
  w: number;
  h: number;
  s: number;
  scale: number;
  cw: number;
  ch: number;
  pad: number;
  wave: number;
  phone: boolean;
  speakerAt: [number, number];
  cassetteAt: [number, number];
}

const CASSETTE_TILT = 0.09;

export function createScene(el: SceneElements): (t: number) => void {
  const clouds = createClouds(el.sky);
  const bars = Array.from({ length: 600 }, (_, i) => amplitude(i / 600, rng(i * 7 + 3)()));
  el.grain.style.backgroundImage = `url(${grainTile()})`;
  const cover = new Image();
  cover.src = el.artwork;

  let lay: Layout | undefined;
  let speaker: ReturnType<typeof bakeSpeaker> | undefined;
  let cassette: ReturnType<typeof bakeCassette> | undefined;
  let cardBg: HTMLCanvasElement | undefined;
  const gearCtx = el.gear.getContext('2d')!;
  const cardCtx = el.card.getContext('2d')!;

  function layout(): Layout {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const phone = w < 640;
    // The gear is out of focus, so its canvas runs below device resolution too.
    const scale = Math.min(1, 0.7 * dpr);
    el.gear.width = Math.round(w * scale);
    el.gear.height = Math.round(h * scale);
    // Vapour has no detail finer than a few pixels, so the shader runs at about half size.
    const sky = Math.min(0.5, 960 / w);
    el.sky.width = Math.round(w * sky);
    el.sky.height = Math.round(h * sky);
    const cw = Math.min(w - 32, 600);
    const pad = phone ? 14 : 18;
    const wave = phone ? 54 : 68;
    const ch = pad + 48 + 16 + wave + 22 + pad;
    const cdpr = Math.min(window.devicePixelRatio || 1, 2);
    el.card.width = Math.round(cw * cdpr);
    el.card.height = Math.round(ch * cdpr);
    el.card.style.width = `${cw}px`;
    el.card.style.height = `${ch}px`;
    el.card.style.marginLeft = `${-cw / 2}px`;
    el.card.style.marginTop = `${-ch / 2}px`;
    cardCtx.setTransform(cdpr, 0, 0, cdpr, 0, 0);
    const s = Math.max(w, h * 0.75);
    // Gear sits nearer the camera than the player, so it is rendered out of focus: the speaker
    // more so, being closest. Rims face the light at the centre.
    const sr = (phone ? 0.17 : 0.13) * s;
    const kw = (phone ? 0.34 : 0.19) * s;
    const speakerAt: [number, number] = phone ? [-w * 0.24, -ch / 2 - sr * 1.15] : [-w * 0.33, h * 0.17];
    const cassetteAt: [number, number] = phone ? [w * 0.17, ch / 2 + kw * 0.62] : [w * 0.3, -h * 0.2];
    speaker = bakeSpeaker(sr, scale, phone ? 3 : 4, Math.atan2(-speakerAt[1], -speakerAt[0]));
    cassette = bakeCassette(kw, scale, phone ? 2 : 2.5, Math.atan2(-cassetteAt[1], -cassetteAt[0]) - CASSETTE_TILT);
    cardBg = bakeCard(cw, ch, cdpr);
    return { w, h, s, scale, cw, ch, pad, wave, phone, speakerAt, cassetteAt };
  }

  function light(t: number): number {
    if (t >= DROP) {
      const s = t - DROP;
      return 1.05 + 1.3 * Math.exp(-s / 260) + 0.08 * kick(t);
    }
    const build = (0.6 + 0.35 * smooth(0, DROP, t) + 0.08 * kick(t)) * smooth(0, 900, t);
    return build * (1 - 0.35 * smooth(DROP - INHALE, DROP - 40, t));
  }

  function drawSky(L: Layout, t: number): void {
    const enter = easeOut(t / 1600);
    const blast = t > DROP ? 1 - Math.exp(-(t - DROP) / 420) : 0;
    const shake = t > DROP ? Math.exp(-(t - DROP) / 140) * Math.sin((t - DROP) * 0.11) * 0.006 : 0;
    clouds?.({
      time: t / 1000,
      light: light(t),
      enter: smooth(0, 900, t) * (0.3 + 0.7 * enter),
      inhale: smooth(DROP - INHALE, DROP, t) * (1 - blast),
      blast,
      shake,
      push: 0.05 * (t / 1000),
      sun: [0, 0],
    });
    gearCtx.setTransform(L.scale, 0, 0, L.scale, 0, 0);
    gearCtx.clearRect(0, 0, L.w, L.h);
    drawGear(L, t, L.w / 2, L.h / 2 - shake * L.h, blast, enter);
  }

  function drawGear(L: Layout, t: number, cx: number, cy: number, blast: number, enter: number): void {
    if (!speaker || !cassette) return;
    const ctx = gearCtx;
    const alpha = smooth(150, 1100, t) * (1 - smooth(0.35, 0.85, blast));
    if (alpha <= 0) return;
    // Nearer than the clouds, so they come in from further out and leave faster.
    const fly = 1 + 0.35 * (1 - enter) + blast * 1.6;
    const grow = 1 + blast * 0.5;
    const rim = clamp(light(t) * 0.4);

    const k = t > DROP - INHALE && t < DROP ? 0 : kick(t);
    const [sx, sy] = L.speakerAt;
    const sr = speaker.r;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx + sx * fly - t * 0.008, cy + sy * fly + t * 0.003);
    ctx.scale(grow, grow);
    ctx.drawImage(speaker.frame, -sr, -sr, sr * 2, sr * 2);
    // The cone throws forward on each kick: a touch larger, and its sheen swings brighter.
    const ex = 1 + 0.035 * k;
    ctx.drawImage(speaker.cone, -sr * ex, -sr * ex, sr * 2 * ex, sr * 2 * ex);
    ctx.globalAlpha = alpha * k * 0.6;
    ctx.drawImage(speaker.sheen, -sr * ex, -sr * ex, sr * 2 * ex, sr * 2 * ex);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * rim;
    ctx.drawImage(speaker.rim, -sr, -sr, sr * 2, sr * 2);
    ctx.restore();

    const [kx, ky] = L.cassetteAt;
    const cw = cassette.w;
    const chh = cassette.h;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx + kx * fly + t * 0.006, cy + ky * fly - t * 0.002);
    ctx.rotate(CASSETTE_TILT + blast * 0.25 + t * 0.00002);
    ctx.scale(grow, grow);
    ctx.drawImage(cassette.body, -cw / 2, -chh / 2, cw, chh);
    // Take-up reel turns faster: it has less tape on it.
    for (const [hx, rate] of [
      [-0.21, 1],
      [0.21, 1.5],
    ] as const) {
      ctx.save();
      ctx.translate(hx * cw, -0.06 * chh);
      ctx.rotate((-t / 1000) * Math.PI * 2 * 0.5 * rate);
      ctx.drawImage(cassette.hub, -cassette.hubR, -cassette.hubR, cassette.hubR * 2, cassette.hubR * 2);
      ctx.restore();
    }
    ctx.drawImage(cassette.glass, -cw / 2, -chh / 2, cw, chh);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * rim;
    ctx.drawImage(cassette.rim, -cw / 2, -chh / 2, cw, chh);
    ctx.restore();
  }

  function drawCard(L: Layout, t: number): void {
    const ctx = cardCtx;
    const { cw, ch, pad, wave, phone } = L;
    ctx.clearRect(0, 0, cw, ch);
    if (cardBg) ctx.drawImage(cardBg, 0, 0, cw, ch);

    const playing = t > 380;
    const head = playing ? 0.47 + (0.62 - 0.47) * clamp((t - 380) / (DROP - 380)) : 0.47;
    const headX = pad;
    const headY = pad;

    // Artwork: the sleeve, with the record slid half out of it, turning under a fixed reflection,
    // which is how a spinning record reads. The off-centre mark on the label shows the turn.
    const art = 48;
    const rx = headX + art / 2 + SLIDE;
    const ry = headY + art / 2;
    const rr = art * 0.46;
    ctx.save();
    ctx.fillStyle = '#0b0b0e';
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let g = 0.2; g < 0.46; g += 0.035) {
      ctx.beginPath();
      ctx.arc(rx, ry, art * g, 0, Math.PI * 2);
      ctx.stroke();
    }
    const glint = ctx.createConicGradient(-0.6, rx, ry);
    glint.addColorStop(0, 'rgba(255,255,255,0)');
    glint.addColorStop(0.05, 'rgba(255,255,255,0.16)');
    glint.addColorStop(0.1, 'rgba(255,255,255,0)');
    glint.addColorStop(0.5, 'rgba(255,255,255,0)');
    glint.addColorStop(0.55, 'rgba(255,255,255,0.1)');
    glint.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = glint;
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
    ctx.fill();
    const spin = (t / 1000) * Math.PI * 2 * (33.3 / 60);
    ctx.translate(rx, ry);
    ctx.rotate(spin);
    ctx.fillStyle = '#c9542c';
    ctx.beginPath();
    ctx.arc(0, 0, art * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,10,8,0.55)';
    ctx.fillRect(art * 0.02, -art * 0.035, art * 0.12, art * 0.025);
    ctx.fillStyle = '#e9e4d8';
    ctx.beginPath();
    ctx.arc(0, 0, art * 0.018, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    roundRect(ctx, headX, headY, art, art, 3);
    ctx.fillStyle = '#16171d';
    ctx.fill();
    ctx.restore();
    if (cover.complete && cover.naturalWidth) {
      ctx.save();
      roundRect(ctx, headX, headY, art, art, 3);
      ctx.clip();
      ctx.drawImage(cover, headX, headY, art, art);
      ctx.restore();
    }

    // Play / pause.
    const bx = headX + art + SLIDE + 14 + 18;
    const by = headY + art / 2;
    ctx.fillStyle = ORANGE;
    ctx.beginPath();
    ctx.arc(bx, by, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fcfcf2';
    if (playing) {
      ctx.fillRect(bx - 5.5, by - 6.5, 3.5, 13);
      ctx.fillRect(bx + 2, by - 6.5, 3.5, 13);
    } else {
      ctx.beginPath();
      ctx.moveTo(bx - 4, by - 7);
      ctx.lineTo(bx + 7, by);
      ctx.lineTo(bx - 4, by + 7);
      ctx.fill();
    }

    const tx = bx + 18 + 12;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#8f909c';
    ctx.font = `400 ${phone ? 12 : 13}px ${FONT}`;
    ctx.fillText(ARTIST, tx, by - 4);
    ctx.fillStyle = '#ecebe4';
    ctx.font = `500 ${phone ? 14 : 15}px ${FONT}`;
    // Ends short of the level meter, which sits under the title's right end.
    ctx.fillText(ellipsize(ctx, TITLE, cw - pad - (phone ? 6 : 8) * 6 - 10 - tx), tx, by + 15);

    // BPM readout with a beat lamp, and a level meter: the kind of glass on a DJ mixer.
    const k = t > DROP - INHALE && t < DROP ? 0 : kick(t);
    const right = cw - pad;
    ctx.textAlign = 'right';
    ctx.font = `500 ${phone ? 13 : 14}px ${MONO}`;
    ctx.fillStyle = '#d9d8d0';
    ctx.fillText('128.0', right, headY + 16);
    ctx.font = `500 9px ${FONT}`;
    ctx.fillStyle = '#6f707c';
    ctx.fillText('BPM', right - (phone ? 44 : 48), headY + 16);
    ctx.textAlign = 'left';
    ctx.fillStyle = `rgba(255,107,53,${0.18 + 0.82 * k})`;
    ctx.beginPath();
    ctx.arc(right - (phone ? 72 : 78), headY + 12, 2.5, 0, Math.PI * 2);
    ctx.fill();

    const bands = phone ? 6 : 8;
    const segs = 8;
    const mw = 4;
    const mx = right - bands * (mw + 2) + 2;
    const my = headY + art;
    for (let b = 0; b < bands; b++) {
      const level = meter(t, b, bands);
      for (let sgm = 0; sgm < segs; sgm++) {
        const lit = sgm < Math.round(level * segs);
        const peak = sgm === segs - 1 || sgm === segs - 2;
        ctx.fillStyle = lit ? (peak ? ORANGE : 'rgba(226,226,220,0.82)') : 'rgba(255,255,255,0.06)';
        ctx.fillRect(mx + b * (mw + 2), my - (sgm + 1) * 3.5, mw, 2.5);
      }
    }

    // The waveform: thin bars, a dimmer reflection underneath, split at the playhead.
    const wy = headY + art + 16;
    const top = wave * 0.7;
    const base = wy + top;
    const step = 3;
    const count = Math.floor((cw - pad * 2 + 1) / step);
    const x0 = pad;
    const headBar = head * count;
    for (let i = 0; i < count; i++) {
      const amp = bars[Math.floor((i / count) * bars.length)];
      const bh = Math.max(1, amp * top);
      const played = i < headBar;
      ctx.fillStyle = played ? ORANGE : 'rgba(214,214,222,0.5)';
      ctx.fillRect(x0 + i * step, base - bh, 2, bh);
      ctx.fillStyle = played ? 'rgba(255,107,53,0.38)' : 'rgba(214,214,222,0.2)';
      ctx.fillRect(x0 + i * step, base + 1, 2, bh * 0.42);
    }

    const now = Math.floor(head * TRACK_SECONDS);
    ctx.font = `500 11px ${MONO}`;
    timeTag(ctx, fmt(now), x0, base - 7, '#fcfcf2', 'left');
    timeTag(ctx, fmt(TRACK_SECONDS), cw - pad, base - 7, '#9a9aa6', 'right');

    ctx.fillStyle = '#5f606b';
    ctx.font = `400 11px ${FONT}`;
    ctx.fillText('#electronic', x0, ch - pad + 2);
    ctx.textAlign = 'right';
    ctx.fillText('12,480 plays', cw - pad, ch - pad + 2);
    ctx.textAlign = 'left';
  }

  function stage(t: number): void {
    const enter = easeOut((t - 120) / 900);
    const out = t > DROP ? easeOut((t - DROP) / 160) : 0;
    const shove = t > DROP ? 1 - Math.exp(-(t - DROP) / 200) : 0;
    el.card.style.opacity = `${enter * (1 - out)}`;
    el.card.style.transform = `translateY(${(1 - enter) * 22}px) scale(${1 + shove * 0.07})`;

    const reveal = easeOut((t - DROP - 180) / 900);
    el.logo.style.opacity = `${reveal}`;
    el.logo.style.transform = `scale(${0.955 + 0.045 * reveal + 0.006 * (t > DROP ? kick(t) : 0)})`;
    const tag = easeOut((t - DROP - 760) / 700);
    el.tagline.style.opacity = `${tag}`;
    el.tagline.style.transform = `translateY(${(1 - tag) * 8}px)`;
  }

  return (t: number) => {
    if (!lay || lay.w !== window.innerWidth || lay.h !== window.innerHeight) lay = layout();
    drawSky(lay, t);
    if (t < DROP + 300) drawCard(lay, t);
    stage(t);
  };
}

// A kick drum: fast attack, exponential decay. Four on the floor at 128.
export function kick(t: number): number {
  const phase = ((t % BEAT) + BEAT) % BEAT;
  return Math.exp(-phase / 110);
}

function meter(t: number, band: number, bands: number): number {
  const low = 1 - band / bands;
  const hat = Math.exp(-(((t + BEAT / 2) % BEAT) / 70));
  const jitter = 0.5 + 0.5 * Math.sin(t * 0.021 * (band + 1.3) + band * 2.1);
  const silence = smooth(DROP - INHALE, DROP - INHALE + 60, t) * (1 - smooth(DROP - 10, DROP, t));
  const build = t < DROP ? 0.75 + 0.25 * (t / DROP) : 1;
  const level = (0.25 + 0.5 * kick(t) * low + 0.35 * hat * (1 - low) + 0.18 * jitter) * build;
  return clamp(level * (1 - silence * 0.85), 0.05, 1);
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text.length;
  while (cut > 1 && ctx.measureText(`${text.slice(0, cut).trimEnd()}…`).width > max) cut--;
  return `${text.slice(0, cut).trimEnd()}…`;
}

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function timeTag(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  align: 'left' | 'right',
): void {
  const tw = ctx.measureText(text).width + 8;
  const left = align === 'left' ? x : x - tw;
  ctx.fillStyle = 'rgba(8,8,12,0.78)';
  ctx.fillRect(left, y - 11, tw, 15);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.fillText(text, left + 4, y + 1);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function bakeCard(w: number, h: number, dpr: number): HTMLCanvasElement {
  const [c, ctx] = canvas(w * dpr, h * dpr);
  ctx.scale(dpr, dpr);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(24,25,33,0.9)');
  g.addColorStop(1, 'rgba(15,16,22,0.92)');
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 10);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const edge = ctx.createLinearGradient(0, 0, w, 0);
  edge.addColorStop(0, 'rgba(255,255,255,0)');
  edge.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  edge.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(12, 0.5, w - 24, 1);
  return c;
}

// A woofer from the front: steel basket rim, rubber half-roll surround, paper cone, dust cap.
// The cone and cap are their own image so they can move on the beat while the rim stays put.
function bakeSpeaker(
  r: number,
  scale: number,
  blur: number,
  sun: number,
): {
  r: number;
  frame: HTMLCanvasElement;
  cone: HTMLCanvasElement;
  sheen: HTMLCanvasElement;
  rim: HTMLCanvasElement;
} {
  const px = Math.max(48, r * 2 * scale * 1.5);
  const k = px / (r * 2);
  const R = r * k;
  const [frame, f] = canvas(px, px);
  f.translate(R, R);
  const rim = f.createLinearGradient(-R, -R, R, R);
  rim.addColorStop(0, '#2a2b30');
  rim.addColorStop(0.5, '#141518');
  rim.addColorStop(1, '#09090b');
  f.fillStyle = rim;
  f.beginPath();
  f.arc(0, 0, R * 0.99, 0, Math.PI * 2);
  f.fill();
  f.fillStyle = '#060608';
  f.beginPath();
  f.arc(0, 0, R * 0.9, 0, Math.PI * 2);
  f.fill();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    f.fillStyle = '#050506';
    f.beginPath();
    f.arc(Math.cos(a) * R * 0.945, Math.sin(a) * R * 0.945, R * 0.03, 0, Math.PI * 2);
    f.fill();
    f.fillStyle = 'rgba(255,255,255,0.18)';
    f.beginPath();
    f.arc(Math.cos(a) * R * 0.945 - R * 0.008, Math.sin(a) * R * 0.945 - R * 0.008, R * 0.012, 0, Math.PI * 2);
    f.fill();
  }

  const [cone, c] = canvas(px, px);
  c.translate(R, R);
  // The surround: a torus, so lit on its upper-left shoulder and shadowed on the inner lower edge.
  const roll = c.createRadialGradient(-R * 0.12, -R * 0.12, R * 0.6, 0, 0, R * 0.88);
  roll.addColorStop(0, '#09090b');
  roll.addColorStop(0.55, '#2e3036');
  roll.addColorStop(0.8, '#1a1b1f');
  roll.addColorStop(1, '#070708');
  c.fillStyle = roll;
  c.beginPath();
  c.arc(0, 0, R * 0.88, 0, Math.PI * 2);
  c.fill();
  const paper = c.createRadialGradient(-R * 0.08, -R * 0.1, R * 0.1, 0, 0, R * 0.7);
  paper.addColorStop(0, '#08080a');
  paper.addColorStop(0.7, '#17181c');
  paper.addColorStop(1, '#202126');
  c.fillStyle = paper;
  c.beginPath();
  c.arc(0, 0, R * 0.7, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.025)';
  c.lineWidth = Math.max(0.5, R * 0.006);
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    c.beginPath();
    c.moveTo(Math.cos(a) * R * 0.28, Math.sin(a) * R * 0.28);
    c.lineTo(Math.cos(a) * R * 0.69, Math.sin(a) * R * 0.69);
    c.stroke();
  }
  c.fillStyle = 'rgba(0,0,0,0.6)';
  c.beginPath();
  c.arc(R * 0.015, R * 0.025, R * 0.27, 0, Math.PI * 2);
  c.fill();
  const cap = c.createRadialGradient(-R * 0.09, -R * 0.1, R * 0.01, 0, 0, R * 0.26);
  cap.addColorStop(0, '#55585f');
  cap.addColorStop(0.35, '#2a2c31');
  cap.addColorStop(1, '#111215');
  c.fillStyle = cap;
  c.beginPath();
  c.arc(0, 0, R * 0.26, 0, Math.PI * 2);
  c.fill();

  const [sheen, sh] = canvas(px, px);
  sh.translate(R, R);
  const sg = sh.createRadialGradient(-R * 0.25, -R * 0.3, 0, -R * 0.1, -R * 0.1, R * 0.8);
  sg.addColorStop(0, 'rgba(255,240,225,0.28)');
  sg.addColorStop(1, 'rgba(255,240,225,0)');
  sh.fillStyle = sg;
  sh.beginPath();
  sh.arc(0, 0, R * 0.86, 0, Math.PI * 2);
  sh.fill();
  const [rim2, rg] = canvas(px, px);
  rg.translate(R, R);
  const [ux, uy] = [Math.cos(sun) * R, Math.sin(sun) * R];
  const dir = rg.createLinearGradient(ux, uy, -ux * 0.2, -uy * 0.2);
  dir.addColorStop(0, 'rgba(255,184,130,0.95)');
  dir.addColorStop(1, 'rgba(255,184,130,0)');
  rg.strokeStyle = dir;
  rg.lineWidth = R * 0.035;
  rg.beginPath();
  rg.arc(0, 0, R * 0.975, 0, Math.PI * 2);
  rg.stroke();
  const soft = (c: HTMLCanvasElement): HTMLCanvasElement => soften(c, blur * scale * 1.5);
  return { r, frame: soft(frame), cone: soft(cone), sheen: soft(sheen), rim: soft(rim2) };
}

// A compact cassette, 100 x 64 like the real thing: smoked shell, paper label, a window onto
// the two tape packs, and the hubs drawn separately so they can turn.
function bakeCassette(
  w: number,
  scale: number,
  blur: number,
  sun: number,
): {
  w: number;
  h: number;
  hubR: number;
  body: HTMLCanvasElement;
  hub: HTMLCanvasElement;
  glass: HTMLCanvasElement;
  rim: HTMLCanvasElement;
} {
  const h = w * 0.64;
  const k = Math.max(1, scale * 1.5);
  const [body, b] = canvas(w * k, h * k);
  b.scale(k, k);
  const shell = b.createLinearGradient(0, 0, 0, h);
  shell.addColorStop(0, '#1f2024');
  shell.addColorStop(1, '#0e0e11');
  roundRect(b, 0, 0, w, h, w * 0.035);
  b.fillStyle = shell;
  b.fill();
  b.strokeStyle = 'rgba(255,255,255,0.1)';
  b.lineWidth = Math.max(0.6, w * 0.004);
  b.stroke();

  const lx = w * 0.07;
  const ly = h * 0.08;
  const lw = w * 0.86;
  const lh = h * 0.6;
  const hubY = h * 0.44;
  const holeR = h * 0.135;
  const wx = w * 0.37;
  const wy = h * 0.34;
  const ww = w * 0.26;
  const wh = h * 0.2;

  // The tape packs sit under the label and show through its window and the two hub holes.
  b.fillStyle = '#0b0b0d';
  b.fillRect(lx, ly, lw, lh);
  b.save();
  b.beginPath();
  b.rect(lx, ly, lw, lh);
  b.clip();
  for (const [px, pr] of [
    [w * 0.29, h * 0.3],
    [w * 0.71, h * 0.19],
  ]) {
    const pg = b.createRadialGradient(px - pr * 0.3, hubY - pr * 0.3, 0, px, hubY, pr);
    pg.addColorStop(0, '#5e3d2a');
    pg.addColorStop(0.85, '#3a2418');
    pg.addColorStop(1, '#22160e');
    b.fillStyle = pg;
    b.beginPath();
    b.arc(px, hubY, pr, 0, Math.PI * 2);
    b.fill();
  }
  b.restore();

  const paper = b.createLinearGradient(0, ly, 0, ly + lh);
  paper.addColorStop(0, '#a29c8e');
  paper.addColorStop(1, '#8a8476');
  b.beginPath();
  b.roundRect(lx, ly, lw, lh, w * 0.012);
  b.roundRect(wx, wy, ww, wh, wh * 0.2);
  b.moveTo(w * 0.29 + holeR, hubY);
  b.arc(w * 0.29, hubY, holeR, 0, Math.PI * 2);
  b.moveTo(w * 0.71 + holeR, hubY);
  b.arc(w * 0.71, hubY, holeR, 0, Math.PI * 2);
  b.fillStyle = paper;
  b.fill('evenodd');
  b.fillStyle = '#c4562e';
  b.fillRect(lx, ly + lh * 0.2, lw, lh * 0.035);
  b.fillStyle = '#3b3833';
  b.font = `600 ${h * 0.09}px ${FONT}`;
  b.fillText('A', lx + lw * 0.03, ly + lh * 0.16);
  b.font = `italic 400 ${h * 0.075}px Georgia, 'Times New Roman', serif`;
  b.fillText('untitled mix', lx + lw * 0.12, ly + lh * 0.15);
  b.font = `500 ${h * 0.06}px ${FONT}`;
  b.textAlign = 'right';
  b.fillText('C-60', lx + lw * 0.97, ly + lh * 0.15);
  b.textAlign = 'left';

  b.fillStyle = '#1d1d21';
  b.beginPath();
  b.moveTo(w * 0.2, h);
  b.lineTo(w * 0.25, h * 0.76);
  b.lineTo(w * 0.75, h * 0.76);
  b.lineTo(w * 0.8, h);
  b.fill();
  for (const sx of [0.36, 0.64]) {
    b.fillStyle = '#060607';
    b.beginPath();
    b.arc(w * sx, h * 0.87, h * 0.035, 0, Math.PI * 2);
    b.fill();
  }
  for (const [sx, sy] of [
    [0.035, 0.05],
    [0.965, 0.05],
    [0.035, 0.94],
    [0.965, 0.94],
    [0.5, 0.88],
  ]) {
    b.fillStyle = '#4a4b50';
    b.beginPath();
    b.arc(w * sx, h * sy, h * 0.022, 0, Math.PI * 2);
    b.fill();
    b.strokeStyle = '#1a1a1d';
    b.lineWidth = h * 0.006;
    b.beginPath();
    b.moveTo(w * sx - h * 0.012, h * sy);
    b.lineTo(w * sx + h * 0.012, h * sy);
    b.moveTo(w * sx, h * sy - h * 0.012);
    b.lineTo(w * sx, h * sy + h * 0.012);
    b.stroke();
  }

  const hubR = h * 0.1;
  const [hub, hb] = canvas(hubR * 2 * k, hubR * 2 * k);
  hb.scale(k, k);
  hb.translate(hubR, hubR);
  hb.fillStyle = '#a9a69e';
  hb.beginPath();
  hb.arc(0, 0, hubR, 0, Math.PI * 2);
  hb.fill();
  hb.fillStyle = '#0b0b0d';
  hb.beginPath();
  hb.arc(0, 0, hubR * 0.55, 0, Math.PI * 2);
  hb.fill();
  hb.fillStyle = '#a9a69e';
  for (let i = 0; i < 6; i++) {
    hb.save();
    hb.rotate((i * Math.PI) / 3);
    hb.fillRect(-hubR * 0.08, -hubR * 0.58, hubR * 0.16, hubR * 0.2);
    hb.restore();
  }

  const [glass, gl] = canvas(w * k, h * k);
  gl.scale(k, k);
  const glare = gl.createLinearGradient(wx, wy, wx + ww * 0.6, wy + wh);
  glare.addColorStop(0, 'rgba(255,255,255,0)');
  glare.addColorStop(0.45, 'rgba(255,255,255,0.09)');
  glare.addColorStop(0.55, 'rgba(255,255,255,0)');
  roundRect(gl, wx, wy, ww, wh, wh * 0.18);
  gl.fillStyle = glare;
  gl.fill();
  const [rim, rg] = canvas(w * k, h * k);
  rg.scale(k, k);
  const reach = Math.hypot(w, h) / 2;
  const dir = rg.createLinearGradient(
    w / 2 + Math.cos(sun) * reach,
    h / 2 + Math.sin(sun) * reach,
    w / 2 - Math.cos(sun) * reach * 0.1,
    h / 2 - Math.sin(sun) * reach * 0.1,
  );
  dir.addColorStop(0, 'rgba(255,184,130,0.95)');
  dir.addColorStop(1, 'rgba(255,184,130,0)');
  roundRect(rg, w * 0.006, w * 0.006, w * 0.988, h - w * 0.012, w * 0.035);
  rg.strokeStyle = dir;
  rg.lineWidth = w * 0.01;
  rg.stroke();
  const soft = (c: HTMLCanvasElement): HTMLCanvasElement => soften(c, blur * scale * 1.5);
  return { w, h, hubR, body: soft(body), hub: soft(hub), glass: soft(glass), rim: soft(rim) };
}

// Depth of field on the cheap: a box-ish blur from shrinking and re-enlarging with smoothing.
function soften(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  if (px < 0.75) return src;
  const f = Math.min(8, px);
  const [small, sctx] = canvas(src.width / f, src.height / f);
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(src, 0, 0, small.width, small.height);
  const [out, octx] = canvas(src.width, src.height);
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(small, 0, 0, out.width, out.height);
  return out;
}
