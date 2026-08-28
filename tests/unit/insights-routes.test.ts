import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as runInsightHandler } from '@/app/api/admin/insights/run/route';
import { GET as historyInsightHandler } from '@/app/api/admin/insights/history/route';
import * as sessionModule from '@/lib/auth/session';
import * as insightsModule from '@/lib/ai/insights';
import * as dbQueries from '@/lib/db/queries';

describe('Admin AI Insights API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/insights/run', () => {
    it('rejects unauthenticated requests with 401', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);

      const res = await runInsightHandler();
      expect(res.status).toBe(401);
    });

    it('rejects non-admin users with 403', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-user',
        username: 'regular',
        email: 'user@test.com',
        role: 'USER',
        lastActive: Date.now(),
      });

      const res = await runInsightHandler();
      expect(res.status).toBe(403);
    });

    it('executes comparative insight and returns 200 for admins', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-admin',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        lastActive: Date.now(),
      });

      vi.spyOn(insightsModule, 'runComparativeAiInsight').mockResolvedValue({
        id: 'ins-1',
        createdAt: '2026-08-28T12:00:00Z',
        triggeredByUserId: 'u-admin',
        healthScore: 92,
        previousScore: null,
        scoreDelta: 0,
        trendDirection: 'INITIAL',
        executiveSummary: 'Initial test',
        resolvedIssues: [],
        persistingIssues: [],
        newIssues: [],
        actionableSuggestions: [],
        metricsSnapshot: {},
      });

      const res = await runInsightHandler();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.insight.healthScore).toBe(92);
    });

    it('handles unexpected exceptions and returns 500', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-admin',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        lastActive: Date.now(),
      });

      vi.spyOn(insightsModule, 'runComparativeAiInsight').mockRejectedValue(new Error('Diagnostic failed'));

      const res = await runInsightHandler();
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Diagnostic failed');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/insights/history', () => {
    it('rejects unauthenticated requests with 401', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);
      const req = new Request('http://localhost/api/admin/insights/history');
      const res = await historyInsightHandler(req);
      expect(res.status).toBe(401);
    });

    it('rejects non-admin users with 403', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-user',
        username: 'regular',
        email: 'user@test.com',
        role: 'USER',
        lastActive: Date.now(),
      });
      const req = new Request('http://localhost/api/admin/insights/history');
      const res = await historyInsightHandler(req);
      expect(res.status).toBe(403);
    });

    it('returns history array for admin session', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-admin',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        lastActive: Date.now(),
      });

      vi.spyOn(dbQueries, 'getRecentAiInsights').mockResolvedValue([
        {
          id: 'ins-1',
          createdAt: '2026-08-28T12:00:00Z',
          triggeredByUserId: 'u-admin',
          healthScore: 92,
          previousScore: null,
          scoreDelta: 0,
          trendDirection: 'INITIAL',
          executiveSummary: 'Test',
          resolvedIssues: [],
          persistingIssues: [],
          newIssues: [],
          actionableSuggestions: [],
          metricsSnapshot: {},
        },
      ]);

      const req = new Request('http://localhost/api/admin/insights/history?limit=5');
      const res = await historyInsightHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.history.length).toBe(1);
    });

    it('handles unexpected exceptions and returns 500', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
        userId: 'u-admin',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        lastActive: Date.now(),
      });

      vi.spyOn(dbQueries, 'getRecentAiInsights').mockRejectedValue(new Error('DB read error'));

      const req = new Request('http://localhost/api/admin/insights/history');
      const res = await historyInsightHandler(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('DB read error');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
