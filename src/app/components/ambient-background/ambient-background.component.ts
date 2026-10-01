import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  input,
  viewChild,
} from '@angular/core';

import { createClouds } from '../atmosphere/cloud-shader';
import { grainTile } from '../atmosphere/grain';

const FRAME_MS = 1000 / 30;
// Sky seconds per real second: the intro's clouds, slowed to a drift you notice only on a long look.
const DRIFT = 0.18;
// The light sits just above the top edge, so the clouds are backlit without a hot spot behind the content.
const SUN: [number, number] = [0, -0.52];
const LIGHT = 0.9;

/**
 * The intro's backlit clouds behind the whole app, as a cheap ambient layer: about a third of
 * the CSS resolution, 30 fps, outside Angular's zone. rAF already stops in a hidden tab, and the
 * clock only counts frames that were drawn, so the sky resumes where it left off.
 */
@Component({
  selector: 'app-ambient-background',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ambient-background.component.html',
  styleUrl: './ambient-background.component.scss',
  host: { 'aria-hidden': 'true' },
})
export class AmbientBackgroundComponent {
  // True while the intro covers the page: draw one frame so the sky is there under its fade, then wait.
  readonly held = input(false);

  private readonly sky = viewChild.required<ElementRef<HTMLCanvasElement>>('sky');
  private readonly grain = viewChild.required<ElementRef<HTMLElement>>('grain');

  constructor() {
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.grain().nativeElement.style.backgroundImage = `url(${grainTile()})`;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const stop = zone.runOutsideAngular(() => this.run());
      destroyRef.onDestroy(stop);
    });
  }

  private run(): () => void {
    const canvas = this.sky().nativeElement;
    const draw = createClouds(canvas);
    if (!draw) return () => {};

    let frame = 0;
    let last = 0;
    let time = 0;
    let drawn = false;
    const tick = (now: number): void => {
      frame = requestAnimationFrame(tick);
      if (now - last < FRAME_MS - 2 || (drawn && this.held())) return;
      time += (Math.min(now - last, 100) / 1000) * DRIFT;
      last = now;
      fit(canvas);
      draw({ time, light: LIGHT, enter: 1, inhale: 0, blast: 0, shake: 0, push: 0, sun: SUN });
      if (!drawn) canvas.classList.add('lit');
      drawn = true;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }
}

// Vapour has no detail finer than a few pixels, so a third of the CSS size reads the same and costs a ninth.
function fit(canvas: HTMLCanvasElement): void {
  const scale = Math.min(0.34, 480 / canvas.clientWidth);
  const w = Math.max(1, Math.round(canvas.clientWidth * scale));
  const h = Math.max(1, Math.round(canvas.clientHeight * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
