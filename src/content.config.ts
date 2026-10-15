import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './source/_posts' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    date: z.coerce.date().default(new Date('2025-09-28T00:00:00')),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    topics: z.array(z.object({
      slug: z.string(),
      title: z.string(),
      description: z.string().optional(),
    })).default([]),
  }),
});

export const collections = { posts };
