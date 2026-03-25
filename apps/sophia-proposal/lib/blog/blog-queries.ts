import { getD1Client } from '@/lib/db/client';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  author: string;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listPublishedPosts(): Promise<BlogPost[]> {
  const db = await getD1Client();
  const { data } = await db
    .from<BlogPost>('blog_posts')
    .select('id, slug, title, excerpt, author, tags, published_at')
    .eq('published', 1)
    .order('published_at', { ascending: false })
    .limit(50);
  return (data ?? []).map(parseTags);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const db = await getD1Client();
  const { data } = await db
    .from<BlogPost>('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', 1)
    .single();
  return data ? parseTags(data) : null;
}

function parseTags(post: BlogPost): BlogPost {
  if (typeof post.tags === 'string') {
    try {
      post.tags = JSON.parse(post.tags as unknown as string);
    } catch {
      post.tags = [];
    }
  }
  return post;
}
