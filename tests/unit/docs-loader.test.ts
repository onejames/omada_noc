import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getAllDocs, getDocBySlug } from '@/lib/docs/loader';

describe('Documentation Loader Module (lib/docs/loader.ts)', () => {
  it('reads and compiles actual docs including root README as landing page', () => {
    const docs = getAllDocs();
    expect(docs.length).toBeGreaterThanOrEqual(6);

    // Root README is #1 landing page
    expect(docs[0].slug).toBe('readme');
    expect(docs[0].category).toBe('System Overview');
    expect(docs[0].filename).toBe('README.md');

    const prdDoc = docs.find((d) => d.slug === 'prd');
    expect(prdDoc).toBeDefined();
    expect(prdDoc?.title).toContain('Product Requirements');
    expect(prdDoc?.category).toBe('Product & Strategy');
    expect(prdDoc?.filename).toBe('PRD.md');
    expect(prdDoc?.content).toContain('Omada');
  });

  it('retrieves single doc by slug correctly and returns null for non-existent slug', () => {
    const readmeDoc = getDocBySlug('readme');
    expect(readmeDoc).not.toBeNull();
    expect(readmeDoc?.slug).toBe('readme');

    const authDoc = getDocBySlug('authentication');
    expect(authDoc).not.toBeNull();
    expect(authDoc?.slug).toBe('authentication');
    expect(authDoc?.category).toBe('Security & RBAC');

    const nonExistent = getDocBySlug('non-existent-doc-slug');
    expect(nonExistent).toBeNull();
  });

  it('handles custom directory, categorizes various doc types, and sorts them properly', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omada-docs-test-'));

    // Create several test markdown files
    fs.writeFileSync(path.join(tempDir, 'PRD.md'), '# Product Requirements Document\n\nOverview of the system.');
    fs.writeFileSync(path.join(tempDir, 'featureExpansion.md'), '# Hardware & Spectrum\n\nExpansion and spectrum.');
    fs.writeFileSync(path.join(tempDir, 'authentication.md'), '# Security & RBAC Guide\n\nSecurity tokens and hashing.');
    fs.writeFileSync(path.join(tempDir, 'reporting.md'), '# Executive Reporting\n\nAggregations and telemetry.');
    fs.writeFileSync(path.join(tempDir, 'techStack.md'), '# Tech Stack\n\nNext.js and Vitest.');
    fs.writeFileSync(path.join(tempDir, 'implementationPlan.md'), '# Roadmap\n\nPhase 1 to Phase 6.');
    fs.writeFileSync(path.join(tempDir, 'posting.md'), '# Job Description\n\nLead Full Stack Engineer.');
    fs.writeFileSync(path.join(tempDir, 'customGuide.md'), 'General title without hash\n\nSome custom content.');

    const docs = getAllDocs(tempDir);
    expect(docs.length).toBe(8);

    // Verify ordering follows priority map (prd -> featureexpansion -> auth -> reporting -> techstack -> implementationplan -> posting -> custom)
    expect(docs[0].slug).toBe('prd');
    expect(docs[1].slug).toBe('featureexpansion');
    expect(docs[1].category).toBe('Hardware & Spectrum');
    expect(docs[2].slug).toBe('authentication');
    expect(docs[3].slug).toBe('reporting');
    expect(docs[4].slug).toBe('techstack');
    expect(docs[5].slug).toBe('implementationplan');
    expect(docs[6].slug).toBe('posting');
    expect(docs[7].slug).toBe('customguide');
    expect(docs[7].category).toBe('General Documentation');

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns empty array when directory does not exist or has no markdown files', () => {
    const emptyDocs = getAllDocs('/non/existent/directory/path');
    expect(emptyDocs).toEqual([]);
  });

  it('handles file read errors gracefully without throwing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omada-docs-err-'));
    fs.writeFileSync(path.join(tempDir, 'corrupted.md'), '# Corrupted Doc\n\nContent');

    const statSpy = vi.spyOn(fs, 'statSync').mockImplementationOnce(() => {
      throw new Error('Disk read failure');
    });

    const docs = getAllDocs(tempDir);
    expect(Array.isArray(docs)).toBe(true);

    statSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('handles overview slug mapping and root readme read error gracefully', () => {
    const overviewDoc = getDocBySlug('overview');
    expect(overviewDoc).not.toBeNull();
    expect(overviewDoc?.slug).toBe('readme');

    const readmeExtDoc = getDocBySlug('README.md');
    expect(readmeExtDoc).not.toBeNull();

    // Mock read error on root README
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
      throw new Error('README read failure');
    });

    const docs = getAllDocs();
    expect(Array.isArray(docs)).toBe(true);

    readSpy.mockRestore();
  });
});
