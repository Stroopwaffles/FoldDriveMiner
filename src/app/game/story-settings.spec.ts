import { describe, expect, it } from 'vitest';
import { EPISODES, EPISODE_SETTINGS, SIDE_SETTINGS, SIDE_STORIES, sceneSetting } from './story-data';

describe('story scene settings', () => {
  it('gives every episode and side story a backdrop', () => {
    for (const e of EPISODES) expect(EPISODE_SETTINGS[e.n]).toBeTruthy();
    for (let i = 1; i <= SIDE_STORIES.length; i++) expect(SIDE_SETTINGS[i]).toBeTruthy();
    expect(EPISODE_SETTINGS.length).toBe(EPISODES.length + 1);
  });

  it('falls back to the nebula for anything unknown', () => {
    expect(sceneSetting('episode', 6)).toBe('battle');
    expect(sceneSetting('side', 99)).toBe('nebula');
  });
});
