import { Component, ElementRef, afterNextRender, inject, input, viewChild, DestroyRef } from '@angular/core';

interface Star {
  x: number;
  y: number;
  z: number;
}

/** Parallax starfield on a canvas. Static when reduced motion is on. */
@Component({
  selector: 'fdm-starfield',
  template: `<canvas #c></canvas>`,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      display: block;
      overflow: hidden;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
})
export class Starfield {
  readonly speed = input(1);
  readonly tint = input('#ffffff');
  readonly still = input(false);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('c');
  private raf = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const stars: Star[] = Array.from({ length: 220 }, () => ({
        x: Math.random(),
        y: Math.random(),
        z: Math.random() ** 2 * 0.9 + 0.1,
      }));
      let last = performance.now();

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      const frame = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const moving = !this.still();
        for (const s of stars) {
          if (moving) {
            s.x -= dt * 0.02 * s.z * this.speed();
            if (s.x < 0) {
              s.x += 1;
              s.y = Math.random();
            }
          }
          const size = s.z * 2.2;
          ctx.globalAlpha = 0.3 + s.z * 0.7;
          ctx.fillStyle = s.z > 0.75 ? this.tint() : '#cfd6ff';
          ctx.fillRect(s.x * w, s.y * h, size, size);
        }
        ctx.globalAlpha = 1;
        this.raf = requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);

      destroyRef.onDestroy(() => {
        cancelAnimationFrame(this.raf);
        ro.disconnect();
      });
    });
  }
}
