import { describe, expect, it } from 'vitest';

import { buildCaption, pickNextPost, queue, type SocialPost } from '@/server/social';

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

describe('pickNextPost', () => {
  const draft: SocialPost = { ...post, id: 'd', status: 'draft' };
  const second: SocialPost = { ...post, id: 'p2' };

  it('skips drafts and fully published posts', () => {
    const next = pickNextPost(
      [draft, post, second],
      [
        { post_id: 'p1', channel: 'instagram' },
        { post_id: 'p1', channel: 'facebook' },
      ]
    );
    expect(next?.post.id).toBe('p2');
    expect(next?.pending).toEqual(['instagram', 'facebook']);
  });

  it('resumes a post whose second channel failed', () => {
    const next = pickNextPost([post, second], [{ post_id: 'p1', channel: 'instagram' }]);
    expect(next?.post.id).toBe('p1');
    expect(next?.pending).toEqual(['facebook']);
  });

  it('returns null when everything is published', () => {
    expect(
      pickNextPost(
        [post],
        post.channels.map((channel) => ({ post_id: 'p1', channel }))
      )
    ).toBeNull();
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
