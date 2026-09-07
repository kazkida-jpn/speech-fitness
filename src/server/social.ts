import brandJson from '../../marketing/social/brand.json';
import queueJson from '../../marketing/social/queue.json';

import { getSupabaseAdmin } from '@/server/supabase-admin';

// Server-only. Publishes the next queued promo post to Instagram and the Facebook Page through
// the Meta Graph API. The queue lives in marketing/social/queue.json, the images are served
// from public/promo, and the published log lives in the Supabase `social_posts` table so a post
// is never sent twice.

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

/** First ready post that still has a channel without a published row, with those channels. */
export function pickNextPost(posts: SocialPost[], published: PublishedRow[]) {
  for (const post of posts) {
    if (post.status !== 'ready') continue;
    const done = new Set(published.filter((row) => row.post_id === post.id).map((r) => r.channel));
    const pending = post.channels.filter((channel) => !done.has(channel));
    if (pending.length) return { post, pending };
  }
  return null;
}

type MetaConfig = {
  version: string;
  pageId: string;
  igUserId: string;
  token: string;
};

export function getMetaConfig(): MetaConfig | null {
  const pageId = process.env.META_PAGE_ID;
  const igUserId = process.env.META_IG_USER_ID;
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!pageId || !igUserId || !token) return null;
  return { version: process.env.META_GRAPH_VERSION ?? 'v23.0', pageId, igUserId, token };
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
  post: string | null;
  imageUrl?: string;
  results: { channel: Channel; ok: boolean; id?: string; caption: string; error?: string }[];
};

/**
 * Publishes the next pending post. With `dryRun`, returns what would be sent without calling
 * Meta or writing the log. `origin` is the deployment origin used to build the image URL when
 * SOCIAL_SITE_URL is not set.
 */
export async function publishNext(origin: string, dryRun: boolean): Promise<PublishReport> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  const { data, error } = await admin.from('social_posts').select('post_id, channel');
  if (error) throw error;
  const next = pickNextPost(queue, (data ?? []) as PublishedRow[]);
  if (!next) return { post: null, results: [] };

  const siteUrl = (process.env.SOCIAL_SITE_URL || brand.siteUrl || origin).replace(/\/$/, '');
  const imageUrl = `${siteUrl}/promo/${next.post.id}.png`;
  const report: PublishReport = { post: next.post.id, imageUrl, results: [] };
  const config = dryRun ? null : getMetaConfig();
  if (!dryRun && !config) {
    throw new Error('META_PAGE_ID, META_IG_USER_ID and META_PAGE_ACCESS_TOKEN are required');
  }

  for (const channel of next.pending) {
    const caption = buildCaption(next.post, channel, siteUrl);
    if (!config) {
      report.results.push({ channel, ok: true, caption });
      continue;
    }
    try {
      const id =
        channel === 'instagram'
          ? await publishToInstagram(config, imageUrl, caption)
          : await publishToFacebook(config, imageUrl, caption);
      const { error: logError } = await admin
        .from('social_posts')
        .insert({ post_id: next.post.id, channel, external_id: id });
      if (logError) throw logError;
      report.results.push({ channel, ok: true, id, caption });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error(`social publish failed (${next.post.id}/${channel})`, cause);
      report.results.push({ channel, ok: false, caption, error: message });
    }
  }
  return report;
}
