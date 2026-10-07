export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export type AssistantRole = 'concierge' | 'tech' | 'sports';
export type GeminiModelId = 'gemini-3.5-flash' | 'gemini-3.1-flash-lite' | 'gemini-3.1-pro-preview';

export class AiService {
  /**
   * Send multi-turn conversation to server-side /api/chat route
   */
  static async sendMessage(
    messages: { role: 'user' | 'model'; content: string }[],
    model: GeminiModelId = 'gemini-3.5-flash',
    role: AssistantRole = 'concierge'
  ): Promise<{ text: string; model: string }> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model,
        role,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server returned HTTP ${response.status}`);
    }

    return response.json();
  }
}
