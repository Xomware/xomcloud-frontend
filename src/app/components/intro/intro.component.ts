import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { createScene } from './intro-scene';

// Against the outro fade in intro.component.scss: the overlay has faded out by then.
export const INTRO_LENGTH = 5000;
const SKIP_FADE = 250;

/**
 * The first-load hook: a track plays in a bank of backlit cloud, and on the drop the clouds
 * blow apart to show the logo. Drawn on canvas outside Angular's zone; the app shows it only
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
  readonly leaving = signal(false);

  private readonly sky = viewChild.required<ElementRef<HTMLCanvasElement>>('sky');
  private readonly gear = viewChild.required<ElementRef<HTMLCanvasElement>>('gear');
  private readonly card = viewChild.required<ElementRef<HTMLCanvasElement>>('card');
  private readonly logo = viewChild.required<ElementRef<HTMLElement>>('logo');
  private readonly tagline = viewChild.required<ElementRef<HTMLElement>>('tagline');
  private readonly grain = viewChild.required<ElementRef<HTMLElement>>('grain');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private timer?: ReturnType<typeof setTimeout>;
  private frame = 0;

  constructor() {
    const zone = inject(NgZone);
    afterNextRender(() => zone.runOutsideAngular(() => this.play()));
  }

  ngOnInit(): void {
    this.timer = setTimeout(() => this.done.emit(), INTRO_LENGTH);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    cancelAnimationFrame(this.frame);
  }

  @HostListener('document:keydown.escape')
  skip(): void {
    if (this.leaving()) return;
    this.leaving.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.done.emit(), SKIP_FADE);
  }

  private play(): void {
    const artwork = getComputedStyle(this.host.nativeElement).getPropertyValue('--artwork');
    const draw = createScene({
      sky: this.sky().nativeElement,
      gear: this.gear().nativeElement,
      card: this.card().nativeElement,
      logo: this.logo().nativeElement,
      tagline: this.tagline().nativeElement,
      grain: this.grain().nativeElement,
      artwork: artwork.match(/url\(["']?([^"')]+)/)?.[1] ?? '',
    });
    const start = performance.now();
    const tick = (): void => {
      const t = performance.now() - start;
      draw(t);
      if (t < INTRO_LENGTH) this.frame = requestAnimationFrame(tick);
    };
    tick();
  }
}
