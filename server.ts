import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Safe Google GenAI client initialization (uses process.env.GEMINI_API_KEY)
let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI();
  }
} catch (err) {
  console.warn('[webOS IPTV Pro] Note: GEMINI_API_KEY not initialized at startup:', err);
}

// Multi-turn Gemini chat API endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model, role } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    // Role-specific system instructions
    let systemInstruction = `You are the AI Concierge for webOS IPTV Player Pro on LG Smart TVs.
You assist users with:
1. Channel recommendations, live TV schedules, movies, and boxset series.
2. Technical stream inquiries: codecs (HEVC/H.265, AVC/H.264, AV1), HDR formats (HDR10, HLG, Dolby Vision), audio (Dolby Atmos, 5.1 Surround), bitrates, and dynamic buffer tuning.
3. Troubleshooting stream latency, Wi-Fi stutter, and EPG programming.
Keep responses concise, clear, and tailored for TV viewing. Use formatting with bullet points and bold titles where helpful.`;

    if (role === 'tech') {
      systemInstruction = `You are the Technical Stream & Codec Expert for webOS IPTV Player Pro.
You specialize in:
- Deep analysis of video codecs (HEVC H.265, AVC H.264, VP9, AV1) and hardware decoders on LG webOS TVs.
- Bitrate optimization (from 3.6 Mbps SD up to 25+ Mbps 4K UHD), frame rates (50fps/60fps), and dropped frame diagnostics.
- Audio passthrough standards (eARC, Dolby Atmos, AC3/E-AC3, AAC-LC).
- Buffer size calculations (2s Ultra-Low for sports up to 180s Deep Cache for satellite feeds).
Provide accurate, technical, and actionable streaming advice.`;
    } else if (role === 'sports') {
      systemInstruction = `You are the Sports & Live Events Scout for webOS IPTV Player Pro.
You specialize in live sports broadcasting: football/soccer, basketball, tennis, motorsport, combat sports, and major tournaments.
Guide users on finding live events, kickoff times, broadcast quality, and configuring low-latency buffer presets for live sports without delay behind broadcast edge.`;
    }

    // Model selection based on user request & task complexity:
    // - 'gemini-3.1-pro-preview' for complex reasoning/analysis
    // - 'gemini-3.5-flash' for general tasks (default)
    // - 'gemini-3.1-flash-lite' for fast, quick responses
    let selectedModel = 'gemini-3.5-flash';
    if (model === 'gemini-3.1-pro-preview') {
      selectedModel = 'gemini-3.1-pro-preview';
    } else if (model === 'gemini-3.1-flash-lite') {
      selectedModel = 'gemini-3.1-flash-lite';
    } else if (model === 'gemini-3.5-flash') {
      selectedModel = 'gemini-3.5-flash';
    }

    // Format conversation history for @google/genai
    const formattedContents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    }));

    if (!ai) {
      if (process.env.GEMINI_API_KEY) {
        ai = new GoogleGenAI();
      } else {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on this server.',
        });
      }
    }

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: formattedContents,
      config: {
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        temperature: 0.7,
      },
    });

    const replyText = response.text || 'I apologize, but I could not generate a response. Please try again.';

    res.json({
      text: replyText,
      model: selectedModel,
    });
  } catch (err: any) {
    console.error('Gemini API Error:', err);
    res.status(500).json({
      error: err.message || 'Failed to process chat request through Gemini API.',
    });
  }
});

// Setup Vite in development or serve static build in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[webOS IPTV Pro] Server running on http://0.0.0.0:${PORT} (Node ${process.version})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
