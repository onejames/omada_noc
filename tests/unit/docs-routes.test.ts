import { describe, it, expect, vi } from 'vitest';
import { GET as getDocsRoute } from '@/app/api/docs/route';
import { GET as getSingleDocRoute } from '@/app/api/docs/[slug]/route';
import * as docsLoader from '@/lib/docs/loader';
import { NextRequest } from 'next/server';

describe('Documentation API Routes (/api/docs)', () => {
  it('GET /api/docs returns compiled documentation list', async () => {
    const res = await getDocsRoute();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(5);
    expect(Array.isArray(data.docs)).toBe(true);
  });

  it('GET /api/docs handles compilation errors with HTTP 500', async () => {
    const spy = vi.spyOn(docsLoader, 'getAllDocs').mockImplementationOnce(() => {
      throw new Error('Fatal filesystem error');
    });

    const res = await getDocsRoute();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Fatal filesystem error');

    spy.mockRestore();
  });

  it('GET /api/docs/[slug] returns single doc when found', async () => {
    const req = new NextRequest('http://localhost/api/docs/prd');
    const res = await getSingleDocRoute(req, { params: Promise.resolve({ slug: 'prd' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.doc).toBeDefined();
    expect(data.doc.slug).toBe('prd');
  });

  it('GET /api/docs/[slug] returns 404 when doc is not found', async () => {
    const req = new NextRequest('http://localhost/api/docs/missing-slug');
    const res = await getSingleDocRoute(req, { params: Promise.resolve({ slug: 'missing-slug' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Document 'missing-slug' not found");
  });

  it('GET /api/docs/[slug] handles internal error with HTTP 500', async () => {
    const spy = vi.spyOn(docsLoader, 'getDocBySlug').mockImplementationOnce(() => {
      throw new Error('Database lookup failure');
    });

    const req = new NextRequest('http://localhost/api/docs/prd');
    const res = await getSingleDocRoute(req, { params: Promise.resolve({ slug: 'prd' }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Database lookup failure');

    spy.mockRestore();
  });
});
