import { Component, inject } from '@angular/core';
import { GameShell } from './game-shell/game-shell';
import { GameService } from './services/game.service';
import { SettingsService } from './services/settings.service';
import { TitleScreen } from './title/title-screen';

@Component({
  selector: 'app-root',
  imports: [TitleScreen, GameShell],
  template: `
    @if (game.view() === 'title') {
      <fdm-title-screen />
    } @else {
      <fdm-game-shell />
    }
    @if (settings.settings().crt) {
      <div class="crt-overlay" aria-hidden="true"></div>
    }
  `,
  host: {
    '[class.reduced-motion]': 'settings.reducedMotion()',
  },
})
export class App {
  protected readonly game = inject(GameService);
  protected readonly settings = inject(SettingsService);
}
