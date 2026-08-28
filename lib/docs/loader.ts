import fs from 'fs';
import path from 'path';
import { DocItem } from '@/types/docs';

const DOCS_DIRECTORY = path.join(process.cwd(), 'docs');

const PRIORITY_MAP: Record<string, number> = {
  readme: 0,
  overview: 0,
  prd: 1,
  authentication: 2,
  reporting: 3,
  techstack: 4,
  implementationplan: 5,
  posting: 6,
};

/**
 * Extracts a human-readable title from markdown content or filename
 */
function extractTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].replace(/^[^\w\s]+/, '').trim();
  }
  const base = filename.replace(/\.md$/i, '');
  return base.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()).trim();
}

/**
 * Extracts a clean short preview excerpt from markdown content
 */
function extractExcerpt(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('```') &&
      !trimmed.startsWith('---') &&
      !trimmed.startsWith('>') &&
      !trimmed.startsWith('|') &&
      !trimmed.startsWith('•') &&
      !trimmed.startsWith('-')
    ) {
      return trimmed.slice(0, 160) + (trimmed.length > 160 ? '...' : '');
    }
  }
  return 'Documentation specification and system architecture dossier.';
}

/**
 * Categorizes a document based on its slug or content
 */
function categorizeDoc(slug: string): string {
  switch (slug) {
    case 'readme':
    case 'overview':
      return 'System Overview';
    case 'prd':
      return 'Product & Strategy';
    case 'authentication':
      return 'Security & RBAC';
    case 'reporting':
      return 'Observability & AI';
    case 'techstack':
      return 'Architecture & Stack';
    case 'implementationplan':
      return 'Engineering Roadmap';
    case 'posting':
      return 'Job & Competencies';
    default:
      return 'General Documentation';
  }
}

/**
 * Compiles and returns all markdown documentation from the docs/ directory dynamically.
 */
export function getAllDocs(customDir?: string): DocItem[] {
  const targetDir = customDir || DOCS_DIRECTORY;

  if (!fs.existsSync(/*turbopackIgnore: true*/ targetDir)) {
    return [];
  }

  const entries = fs.readdirSync(/*turbopackIgnore: true*/ targetDir);
  const mdFiles = entries.filter((file) => file.endsWith('.md') && !file.startsWith('.'));

  const docs: DocItem[] = [];

  // If running on root repository, include root README.md as the landing page
  if (!customDir) {
    const rootReadmePath = path.join(process.cwd(), 'README.md');
    if (fs.existsSync(/*turbopackIgnore: true*/ rootReadmePath)) {
      try {
        const stats = fs.statSync(/*turbopackIgnore: true*/ rootReadmePath);
        if (stats.isFile()) {
          const rawContent = fs.readFileSync(/*turbopackIgnore: true*/ rootReadmePath, 'utf-8');
          docs.push({
            slug: 'readme',
            filename: 'README.md',
            title: extractTitle(rawContent, 'README.md'),
            category: 'System Overview',
            excerpt: extractExcerpt(rawContent),
            content: rawContent,
            size: stats.size,
            updatedAt: stats.mtime.toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed to compile root README.md:', err);
      }
    }
  }

  for (const filename of mdFiles) {
    const filePath = path.join(/*turbopackIgnore: true*/ targetDir, filename);
    try {
      const stats = fs.statSync(/*turbopackIgnore: true*/ filePath);
      if (!stats.isFile()) continue;

      const rawContent = fs.readFileSync(/*turbopackIgnore: true*/ filePath, 'utf-8');
      const slug = filename.replace(/\.md$/i, '').toLowerCase();
      const title = extractTitle(rawContent, filename);
      const excerpt = extractExcerpt(rawContent);
      const category = categorizeDoc(slug);

      docs.push({
        slug,
        filename,
        title,
        category,
        excerpt,
        content: rawContent,
        size: stats.size,
        updatedAt: stats.mtime.toISOString(),
      });
    } catch (err) {
      console.error(`Failed to compile doc ${filename}:`, err);
    }
  }

  // Sort by priority map, then alphabetically by title
  docs.sort((a, b) => {
    const priorityA = PRIORITY_MAP[a.slug] !== undefined ? PRIORITY_MAP[a.slug] : 100;
    const priorityB = PRIORITY_MAP[b.slug] !== undefined ? PRIORITY_MAP[b.slug] : 100;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.title.localeCompare(b.title);
  });

  return docs;
}

/**
 * Retrieves a single compiled document by slug.
 */
export function getDocBySlug(slug: string, customDir?: string): DocItem | null {
  const normalizedSlug = slug.toLowerCase().replace(/\.md$/i, '');
  const docs = getAllDocs(customDir);
  return (
    docs.find(
      (d) =>
        d.slug === normalizedSlug ||
        (normalizedSlug === 'overview' && d.slug === 'readme') ||
        (normalizedSlug === 'readme' && d.slug === 'readme')
    ) || null
  );
}
