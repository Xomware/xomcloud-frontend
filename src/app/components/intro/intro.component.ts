import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, output, signal } from '@angular/core';

// Against the timeline in intro.component.scss: the overlay has faded out by then.
export const INTRO_LENGTH = 5000;
const SKIP_FADE = 250;

// A made-up track: a quiet intro, a build, two drops. Fixed so every visit draws the same waveform.
const BARS = Array.from({ length: 44 }, (_, i) => {
  const swell = Math.min(1, 0.35 + i / 30);
  const beat = Math.abs(Math.sin(i * 0.9)) * 0.45 + Math.abs(Math.sin(i * 0.27 + 0.6)) * 0.55;
  return Math.round((0.18 + swell * beat * 0.82) * 100) / 100;
});

// A sine as quadratic curves: `periods` crests across `width`, centred on `mid`.
function sine(width: number, periods: number, amp: number, mid: number): string {
  const half = width / periods / 2;
  let d = `M0 ${mid}`;
  for (let i = 0; i < periods * 2; i++) {
    const crest = i % 2 === 0 ? mid - amp * 2 : mid + amp * 2;
    d += ` Q${half * i + half / 2} ${crest} ${half * (i + 1)} ${mid}`;
  }
  return d;
}

// Drawn at twice the viewport and slid by half, so 8 periods loop seamlessly.
const RIBBONS = [
  { d: sine(800, 8, 6, 20), y: 30, tone: 'primary', speed: 2600 },
  { d: sine(800, 8, 4, 20), y: 44, tone: 'secondary', speed: 3400 },
  { d: sine(800, 8, 7, 20), y: 60, tone: 'accent', speed: 2200 },
] as const;

// Contour lines inside each cloud, so up close the clouds are made of sound.
const CONTOURS = Array.from({ length: 9 }, (_, k) => sine(400, 8, 2.5, 34 + k * 17));

const CLOUDS = [
  { side: 'left', x: -6, y: 18, w: 52, delay: 0 },
  { side: 'left', x: 4, y: 52, w: 44, delay: 120 },
  { side: 'left', x: -14, y: 70, w: 60, delay: 240 },
  { side: 'right', x: 58, y: 12, w: 50, delay: 60 },
  { side: 'right', x: 50, y: 46, w: 46, delay: 180 },
  { side: 'right', x: 62, y: 68, w: 56, delay: 300 },
] as const;

/**
 * The first-load hook: sound waves roll in on cloud banks, an orange waveform
 * plays, the clouds part on the logo. Every visual is CSS on transforms and
 * opacity, so it keeps to the compositor on phones. The app shows it only
 * when the head script in index.html has set html[data-intro="play"].
 */
@Component({
  selector: 'app-intro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './intro.component.html',
  styleUrl: './intro.component.scss',
})
export class IntroComponent implements OnInit, OnDestroy {
  readonly done = output<void>();

  readonly bars = BARS;
  readonly clouds = CLOUDS;
  readonly ribbons = RIBBONS;
  readonly contours = CONTOURS;
  readonly leaving = signal(false);

  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.timer = setTimeout(() => this.done.emit(), INTRO_LENGTH);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  @HostListener('document:keydown.escape')
  skip(): void {
    if (this.leaving()) return;
    this.leaving.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.done.emit(), SKIP_FADE);
  }
}
