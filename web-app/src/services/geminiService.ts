import { AiGovernanceMode, DataResidencyRegion, GeminiModelVersion } from '../types';

export interface GeminiPayload {
  contents: any[];
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  generationConfig?: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: any;
  };
}

class GeminiQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private minInterval = 1000; // 1s rate limiter spacing
  private lastCallTime = 0;

  public async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const elapsed = now - this.lastCallTime;
          if (elapsed < this.minInterval) {
            await new Promise((r) => setTimeout(r, this.minInterval - elapsed));
          }
          this.lastCallTime = Date.now();
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processNext();
    });
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const nextTask = this.queue.shift();
    if (nextTask) {
      try {
        await nextTask();
      } finally {
        this.isProcessing = false;
        this.processNext();
      }
    } else {
      this.isProcessing = false;
    }
  }
}

const geminiQueue = new GeminiQueue();

export class GeminiService {
  public static DEFAULT_MODEL: GeminiModelVersion = 'gemini-2.0-flash';

  public static cleanModelName(name: string): string {
    if (!name) return 'gemini-2.0-flash';
    let clean = name.trim();
    if (clean.includes('/models/')) {
      clean = clean.split('/models/').pop() || clean;
    } else if (clean.startsWith('models/')) {
      clean = clean.replace(/^models\//, '');
    }
    return clean;
  }

  public static getEndpointUrl(
    apiKey: string,
    mode: AiGovernanceMode = 'DATA_SHARING_FREE',
    region: DataResidencyRegion = 'us-central1',
    vertexProjectId?: string,
    modelName: string = this.DEFAULT_MODEL
  ): { url: string; headers: Record<string, string> } {
    const cleanModel = this.cleanModelName(modelName);

    if (mode === 'ENTERPRISE_ZERO_TRAINING' && vertexProjectId) {
      const regionalHost = `${region}-aiplatform.googleapis.com`;
      const url = `https://${regionalHost}/v1/projects/${vertexProjectId}/locations/${region}/publishers/google/models/${cleanModel}:generateContent`;
      return {
        url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;
    return {
      url,
      headers: { 'Content-Type': 'application/json' },
    };
  }

  public static async callWithBackoff(
    payload: GeminiPayload,
    apiKey: string,
    mode: AiGovernanceMode = 'DATA_SHARING_FREE',
    region: DataResidencyRegion = 'us-central1',
    vertexProjectId?: string,
    modelName: string = this.DEFAULT_MODEL
  ): Promise<any> {
    if (!apiKey && !(mode === 'ENTERPRISE_ZERO_TRAINING' && vertexProjectId)) {
      throw new Error('Please configure a Google AI Studio API key or Vertex Project ID in Settings (⚙️).');
    }

    return geminiQueue.enqueue(async () => {
      const { url, headers } = this.getEndpointUrl(apiKey, mode, region, vertexProjectId, modelName);
      const delays = [2000, 4000, 8000, 16000];

      let lastErrorStatus = 0;
      let lastErrorMessage = '';

      for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            lastErrorStatus = res.status;
            const errData = await res.json().catch(() => ({}));
            lastErrorMessage = errData?.error?.message || res.statusText || `HTTP ${res.status}`;

            if (res.status === 429) {
              const retryMatch = lastErrorMessage.match(/retry in ([\d\.]+)s/i);
              const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : delays[attempt] / 1000;
              console.warn(`[GeminiService] Rate limit (429). Waiting ${waitSec}s... (Attempt ${attempt + 1})`);
              await new Promise((r) => setTimeout(r, waitSec * 1000));
              continue;
            }

            if (res.status === 404 && modelName !== 'gemini-2.0-flash') {
              console.warn(`[GeminiService] Model ${modelName} returned 404. Auto-falling back to gemini-2.0-flash.`);
              return await this.callWithBackoff(payload, apiKey, mode, region, vertexProjectId, 'gemini-2.0-flash');
            }

            if (attempt < delays.length) {
              await new Promise((r) => setTimeout(r, delays[attempt]));
              continue;
            }
            throw new Error(`Gemini API Error (${res.status}): ${lastErrorMessage}`);
          }

          const data = await res.json();
          return data;
        } catch (err: any) {
          if (attempt === delays.length) throw err;
          await new Promise((r) => setTimeout(r, delays[attempt]));
        }
      }
      throw new Error(`Failed after ${delays.length} retries. Last error: ${lastErrorMessage} (${lastErrorStatus})`);
    });
  }

  public static async testConnection(
    apiKey: string,
    mode: AiGovernanceMode = 'DATA_SHARING_FREE',
    region: DataResidencyRegion = 'us-central1',
    vertexProjectId?: string,
    modelName: string = this.DEFAULT_MODEL
  ): Promise<{ valid: boolean; message: string }> {
    try {
      const payload: GeminiPayload = {
        contents: [{ role: 'user', parts: [{ text: 'Respond with the single word: READY' }] }],
      };
      const response = await this.callWithBackoff(payload, apiKey, mode, region, vertexProjectId, modelName);
      const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text.toUpperCase().includes('READY')) {
        return {
          valid: true,
          message: `✅ Connection verified successfully with model '${this.cleanModelName(modelName)}'!`,
        };
      }
      return { valid: true, message: `✅ Connection successful! (${text.trim()})` };
    } catch (err: any) {
      return { valid: false, message: `❌ Connection test failed: ${err.message || err}` };
    }
  }
}
