// utils/openaiClient.js
// Lightweight OpenAI client shim for browser/service worker environments (MV3).
// If you later bundle the official SDK, you can replace this shim with:
//   import OpenAI from 'openai';
//   export function getOpenAIClient(apiKey) { return new OpenAI({ apiKey, dangerouslyAllowBrowser: true }); }

export function getOpenAIClient(apiKey) {
  return {
    chat: {
      completions: {
        async create(body) {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`OpenAI error ${res.status}: ${text || res.statusText}`);
          }
          return res.json();
        },
      },
    },
  };
}

