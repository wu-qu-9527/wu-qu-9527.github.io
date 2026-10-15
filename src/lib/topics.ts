import type { CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'posts'>;

export function collectTopics(posts: Post[]) {
  const topics = new Map<string, {
    slug: string;
    title: string;
    description?: string;
    posts: Post[];
  }>();

  for (const post of posts) {
    for (const topic of post.data.topics) {
      const entry = topics.get(topic.slug) ?? {
        slug: topic.slug,
        title: topic.title,
        description: topic.description,
        posts: [],
      };
      entry.posts.push(post);
      topics.set(topic.slug, entry);
    }
  }

  return [...topics.values()].map((topic) => ({
    ...topic,
    posts: topic.posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime()),
  })).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
}

export function topicPath(slug: string) {
  return `/topics/${encodeURIComponent(slug)}/`;
}
