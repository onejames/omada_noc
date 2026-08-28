export interface DocItem {
  slug: string;
  filename: string;
  title: string;
  category?: string;
  excerpt: string;
  content: string;
  size: number;
  updatedAt: string;
}

export interface DocsApiResponse {
  success: boolean;
  total: number;
  docs: DocItem[];
  error?: string;
}

export interface SingleDocApiResponse {
  success: boolean;
  doc?: DocItem;
  error?: string;
}
