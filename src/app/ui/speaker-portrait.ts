import { Component, computed, input } from '@angular/core';
import { PilotPortrait } from './pilot-portrait';

const STORY: Record<string, string> = { JUNO: 'juno', KIT: 'kit', SAFFI: 'saffi', ANSEL: 'ansel', HALE: 'hale', JACKAL: 'jackal' };

/** Portrait for a story voice: the cast's faces, VESPER's eye, or a SYSTEM tag. */
@Component({
  selector: 'fdm-speaker-portrait',
  imports: [PilotPortrait],
  template: `
    @if (story(); as key) {
      <fdm-pilot-portrait [story]="key" [size]="size()" />
    } @else if (speaker() === 'VESPER') {
      <svg viewBox="0 0 40 40" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
        <rect width="40" height="40" fill="#061522" />
        <polygon points="20,6 34,20 20,34 6,20" fill="none" stroke="#4fe3ff" stroke-width="1.5" />
        <circle cx="20" cy="20" r="6" fill="#0b2a3a" stroke="#4fe3ff" />
        <circle class="vesper-eye" cx="20" cy="20" r="2.5" fill="#ffb547" />
      </svg>
    } @else {
      <svg viewBox="0 0 40 40" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
        <rect width="40" height="40" fill="#1b2250" />
        <text x="20" y="25" text-anchor="middle" fill="#8d95c7" font-size="10">SYS</text>
      </svg>
    }
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
  `,
})
export class SpeakerPortrait {
  readonly speaker = input.required<string>();
  readonly size = input(40);
  protected readonly story = computed(() => STORY[this.speaker()] ?? null);
}
