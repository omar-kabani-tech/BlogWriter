export type PostStatus = 'draft' | 'published';

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  status: PostStatus;
  category: string;
  tags: string[];
  featuredImage?: string;
  seo?: {
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    slug: string;
  };
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type Screen = 'auth' | 'dashboard' | 'posts' | 'new-post' | 'edit-post' | 'categories' | 'calendar' | 'ai-generator';
