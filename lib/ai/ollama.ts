/**
 * Local Ollama Client & Neural Inference Engine
 *
 * Interfaces with a locally running Ollama instance (default: http://127.0.0.1:11434)
 * to execute real generative LLM reasoning over live network telemetry.
 */

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  thinking?: string;
  totalDurationMs?: number;
  evalCount?: number;
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaModelInfo {
  name: string;
  model: string;
  size: number;
}

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
}

export function getOllamaDefaultModel(): string {
  return process.env.OLLAMA_MODEL || 'deepseek-r1:7b';
}

/**
 * Checks if local Ollama server is running and returns available models.
 */
export async function getOllamaStatus(baseUrl = getOllamaBaseUrl()): Promise<{
  online: boolean;
  models: string[];
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { online: false, models: [], error: `Ollama returned HTTP ${res.status}` };
    }

    const data = (await res.json()) as { models?: OllamaModelInfo[] };
    const models = (data.models || []).map((m) => m.name || m.model);
    return { online: true, models };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection refused';
    return {
      online: false,
      models: [],
      error: `Ollama unreachable at ${baseUrl} (${msg})`,
    };
  }
}

/**
 * Executes real neural inference with DeepSeek-R1 or another local Ollama model.
 * Extracts Chain-of-Thought reasoning (<think>...</think>) from DeepSeek-R1.
 */
export async function generateNeuralAiInsight(
  systemPrompt: string,
  userPrompt: string,
  model = getOllamaDefaultModel(),
  baseUrl = getOllamaBaseUrl()
): Promise<OllamaGenerateResponse> {
  const startTime = Date.now();

  const controller = new AbortController();
  // Allow up to 90s for local 7B / 14B inference on GPU/CPU
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `${systemPrompt}\n\nUser Request & Telemetry Payload:\n${userPrompt}`,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 2048,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Ollama API error (${res.status}): ${errBody || res.statusText}`);
    }

    const data = (await res.json()) as {
      response?: string;
      model?: string;
      total_duration?: number;
      eval_count?: number;
    };

    const rawResponse = data.response || '';
    const totalDurationMs = Date.now() - startTime;

    // Extract DeepSeek-R1 Chain-of-Thought (<think>...</think>)
    let thinking: string | undefined;
    let finalResponse = rawResponse;

    const thinkMatch = rawResponse.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      thinking = thinkMatch[1].trim();
      finalResponse = rawResponse.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    }

    return {
      model: data.model || model,
      response: finalResponse,
      thinking,
      totalDurationMs,
      evalCount: data.eval_count,
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Ollama neural inference timed out after 90s on model '${model}'.`);
    }
    throw err;
  }
}
