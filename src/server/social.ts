import brandJson from '../../marketing/social/brand.json';
import queueJson from '../../marketing/social/queue.json';

import { getSupabaseAdmin } from '@/server/supabase-admin';

// Server-only. Publishes the next queued promo post to the Facebook Page, and to Instagram once
// META_IG_USER_ID is set, through the Meta Graph API. The queue lives in
// marketing/social/queue.json, the images are served from public/promo, and the published log
// lives in the Supabase `social_posts` table so a post is never sent twice.

export type Channel = 'instagram' | 'facebook';

export type SocialPost = {
  id: string;
  status: 'draft' | 'ready' | 'archived';
  theme?: string;
  channels: Channel[];
  caption: string;
  hashtags?: string[];
  image: { template: string } & Record<string, unknown>;
};

export type PublishedRow = { post_id: string; channel: Channel };

export type Brand = {
  name: string;
  company: string;
  instagramHandle: string;
  siteUrl: string;
  hashtags: { core: string[]; pool: string[] };
};

export const brand = brandJson as Brand;
export const queue = (queueJson as { posts: SocialPost[] }).posts;

export const INSTAGRAM_MAX_HASHTAGS = 30;

/** Caption for one channel: body, a link line, and (for Instagram) the hashtags. */
export function buildCaption(post: SocialPost, channel: Channel, siteUrl: string) {
  const parts = [post.caption.trim()];
  if (channel === 'facebook') {
    if (siteUrl) parts.push(`▶ 無料で試す: ${siteUrl}`);
  } else {
    parts.push('▶ プロフィールのリンクから、無料で試せます。');
    const tags = Array.from(new Set([...brand.hashtags.core, ...(post.hashtags ?? [])])).slice(
      0,
      INSTAGRAM_MAX_HASHTAGS
    );
    if (tags.length) parts.push(tags.join(' '));
  }
  return parts.join('\n\n');
}

/** The Facebook Page is always posted to. Instagram joins once META_IG_USER_ID is set. */
export function enabledChannels(): Channel[] {
  return process.env.META_IG_USER_ID ? ['instagram', 'facebook'] : ['facebook'];
}

/**
 * Each channel walks the queue on its own: for every given channel, the first ready post that
 * lists it and has no published row for it. A channel that is enabled later, or that keeps
 * failing, starts from its own position and does not hold the others back.
 */
export function pickNextPosts(posts: SocialPost[], published: PublishedRow[], channels: Channel[]) {
  const done = new Set(published.map((row) => `${row.channel}:${row.post_id}`));
  const picks: { channel: Channel; post: SocialPost }[] = [];
  for (const channel of channels) {
    const post = posts.find(
      (item) =>
        item.status === 'ready' &&
        item.channels.includes(channel) &&
        !done.has(`${channel}:${item.id}`)
    );
    if (post) picks.push({ channel, post });
  }
  return picks;
}

type MetaConfig = {
  version: string;
  pageId: string;
  igUserId?: string;
  token: string;
};

export function getMetaConfig(): MetaConfig | null {
  const pageId = process.env.META_PAGE_ID;
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return null;
  return {
    version: process.env.META_GRAPH_VERSION ?? 'v23.0',
    pageId,
    igUserId: process.env.META_IG_USER_ID || undefined,
    token,
  };
}

type GraphResult = {
  id?: string;
  post_id?: string;
  status_code?: string;
  error?: { message: string };
};

async function graph(
  config: MetaConfig,
  path: string,
  params: Record<string, string>,
  method: 'GET' | 'POST' = 'POST'
): Promise<GraphResult> {
  const url = new URL(`https://graph.facebook.com/${config.version}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: config.token });
  let response: Response;
  if (method === 'GET') {
    url.search = body.toString();
    response = await fetch(url);
  } else {
    response = await fetch(url, { method, body });
  }
  const json = (await response.json()) as GraphResult;
  if (!response.ok || json.error) {
    throw new Error(`Graph API ${path}: ${json.error?.message ?? response.statusText}`);
  }
  return json;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Two-step Instagram publish: create a media container from a public image URL, then publish it. */
export async function publishToInstagram(config: MetaConfig, imageUrl: string, caption: string) {
  if (!config.igUserId) throw new Error('META_IG_USER_ID is not configured');
  const container = await graph(config, `${config.igUserId}/media`, {
    image_url: imageUrl,
    caption,
  });
  if (!container.id) throw new Error('Instagram container id missing');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const status = await graph(config, container.id, { fields: 'status_code' }, 'GET');
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error(`Instagram container ${status.status_code}`);
    }
    await sleep(3000);
  }
  const published = await graph(config, `${config.igUserId}/media_publish`, {
    creation_id: container.id,
  });
  if (!published.id) throw new Error('Instagram publish returned no id');
  return published.id;
}

/** Posts a photo with a message to the Facebook Page. */
export async function publishToFacebook(config: MetaConfig, imageUrl: string, message: string) {
  const result = await graph(config, `${config.pageId}/photos`, { url: imageUrl, message });
  const id = result.post_id ?? result.id;
  if (!id) throw new Error('Facebook publish returned no id');
  return id;
}

export type PublishReport = {
  results: {
    channel: Channel;
    post: string;
    imageUrl: string;
    ok: boolean;
    id?: string;
    caption: string;
    error?: string;
  }[];
};

/**
 * Publishes the next pending post of each enabled channel. With `dryRun`, returns what would be
 * sent without calling Meta or writing the log. `origin` is the deployment origin used to build
 * the image URL when SOCIAL_SITE_URL is not set. `results` is empty when the queue is used up.
 */
export async function publishNext(origin: string, dryRun: boolean): Promise<PublishReport> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  const { data, error } = await admin.from('social_posts').select('post_id, channel');
  if (error) throw error;
  const picks = pickNextPosts(queue, (data ?? []) as PublishedRow[], enabledChannels());
  const report: PublishReport = { results: [] };
  if (!picks.length) return report;

  const siteUrl = (process.env.SOCIAL_SITE_URL || brand.siteUrl || origin).replace(/\/$/, '');
  const config = dryRun ? null : getMetaConfig();
  if (!dryRun && !config) {
    throw new Error('META_PAGE_ID and META_PAGE_ACCESS_TOKEN are required');
  }

  for (const { channel, post } of picks) {
    const imageUrl = `${siteUrl}/promo/${post.id}.png`;
    const caption = buildCaption(post, channel, siteUrl);
    const base = { channel, post: post.id, imageUrl, caption };
    if (!config) {
      report.results.push({ ...base, ok: true });
      continue;
    }
    try {
      const id =
        channel === 'instagram'
          ? await publishToInstagram(config, imageUrl, caption)
          : await publishToFacebook(config, imageUrl, caption);
      const { error: logError } = await admin
        .from('social_posts')
        .insert({ post_id: post.id, channel, external_id: id });
      if (logError) throw logError;
      report.results.push({ ...base, ok: true, id });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error(`social publish failed (${post.id}/${channel})`, cause);
      report.results.push({ ...base, ok: false, error: message });
    }
  }
  return report;
}
