import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildCaption,
  enabledChannels,
  pickNextPosts,
  queue,
  type Channel,
  type SocialPost,
} from '@/server/social';

const post: SocialPost = {
  id: 'p1',
  status: 'ready',
  channels: ['instagram', 'facebook'],
  caption: '本文です。',
  hashtags: ['#滑舌', '#朗読'],
  image: { template: 'statement', headline: ['a'] },
};

describe('buildCaption', () => {
  it('adds the site link on Facebook and no hashtags', () => {
    const caption = buildCaption(post, 'facebook', 'https://example.com');
    expect(caption).toContain('https://example.com');
    expect(caption).not.toContain('#朗読');
  });

  it('adds a profile-link line and deduplicated hashtags on Instagram', () => {
    const caption = buildCaption(post, 'instagram', 'https://example.com');
    expect(caption).toContain('プロフィールのリンク');
    expect(caption).not.toContain('https://example.com');
    expect(caption.match(/#滑舌(?!\S)/g)).toHaveLength(1);
    expect(caption).toContain('#朗読');
  });
});

describe('pickNextPosts', () => {
  const draft: SocialPost = { ...post, id: 'd', status: 'draft' };
  const second: SocialPost = { ...post, id: 'p2' };
  const both: Channel[] = ['instagram', 'facebook'];
  const ids = (picks: ReturnType<typeof pickNextPosts>) =>
    picks.map((pick) => `${pick.channel}:${pick.post.id}`);

  it('skips drafts and published posts', () => {
    const picks = pickNextPosts(
      [draft, post, second],
      [
        { post_id: 'p1', channel: 'instagram' },
        { post_id: 'p1', channel: 'facebook' },
      ],
      both
    );
    expect(ids(picks)).toEqual(['instagram:p2', 'facebook:p2']);
  });

  it('advances Facebook alone while Instagram is not enabled', () => {
    const picks = pickNextPosts(
      [post, second],
      [{ post_id: 'p1', channel: 'facebook' }],
      ['facebook']
    );
    expect(ids(picks)).toEqual(['facebook:p2']);
  });

  it('starts a channel enabled later from the top without holding the other back', () => {
    const picks = pickNextPosts([post, second], [{ post_id: 'p1', channel: 'facebook' }], both);
    expect(ids(picks)).toEqual(['instagram:p1', 'facebook:p2']);
  });

  it('skips posts that do not list the channel', () => {
    const facebookOnly: SocialPost = { ...post, id: 'f', channels: ['facebook'] };
    const picks = pickNextPosts([facebookOnly, second], [], both);
    expect(ids(picks)).toEqual(['instagram:p2', 'facebook:f']);
  });

  it('returns nothing when everything is published', () => {
    expect(
      pickNextPosts(
        [post],
        post.channels.map((channel) => ({ post_id: 'p1', channel })),
        both
      )
    ).toEqual([]);
  });
});

describe('enabledChannels', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is Facebook only until META_IG_USER_ID is set', () => {
    vi.stubEnv('META_IG_USER_ID', '');
    expect(enabledChannels()).toEqual(['facebook']);
    vi.stubEnv('META_IG_USER_ID', '123');
    expect(enabledChannels()).toEqual(['instagram', 'facebook']);
  });
});

describe('queue.json', () => {
  it('has unique ids, known templates, and a rendered image per ready post', async () => {
    const fs = await import('node:fs');
    const ids = queue.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of queue) {
      expect(['statement', 'drill', 'steps']).toContain(item.image.template);
      expect(item.caption.length).toBeLessThan(1800);
      if (item.status === 'ready') {
        expect(fs.existsSync(`public/promo/${item.id}.png`), `${item.id}.png missing`).toBe(true);
      }
    }
  });
});
