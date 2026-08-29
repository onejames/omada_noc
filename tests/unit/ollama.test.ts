import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOllamaStatus, generateNeuralAiInsight } from '@/lib/ai/ollama';

describe('Local Ollama Client Module (lib/ai/ollama.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks Ollama status successfully when online', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'deepseek-r1:7b', model: 'deepseek-r1:7b', size: 4000000 },
          { name: 'qwen2.5-coder:14b', model: 'qwen2.5-coder:14b', size: 9000000 },
        ],
      }),
    });

    const status = await getOllamaStatus();
    expect(status.online).toBe(true);
    expect(status.models).toContain('deepseek-r1:7b');
    expect(status.models).toContain('qwen2.5-coder:14b');
  });

  it('handles Ollama offline connection errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const status = await getOllamaStatus();
    expect(status.online).toBe(false);
    expect(status.models).toEqual([]);
    expect(status.error).toContain('Connection refused');
  });

  it('handles HTTP error status from Ollama', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const status = await getOllamaStatus();
    expect(status.online).toBe(false);
    expect(status.error).toContain('HTTP 503');
  });

  it('generates neural AI insight and extracts Chain-of-Thought thinking process', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'deepseek-r1:7b',
        response: '<think>\nEvaluating RF channels...\n</think>\n{"healthScore": 96}',
        total_duration: 1200000,
        eval_count: 85,
      }),
    });

    const result = await generateNeuralAiInsight('system', 'user');
    expect(result.model).toBe('deepseek-r1:7b');
    expect(result.thinking).toBe('Evaluating RF channels...');
    expect(result.response).toBe('{"healthScore": 96}');
    expect(result.evalCount).toBe(85);
  });

  it('throws descriptive error when Ollama API returns error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'model not found',
    });

    await expect(generateNeuralAiInsight('system', 'user')).rejects.toThrow(/Ollama API error \(404\)/);
  });
});
