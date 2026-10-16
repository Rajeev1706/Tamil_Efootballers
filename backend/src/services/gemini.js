/**
 * Gemini AI service — multi-model + multi-key fallback chain
 *
 * Fallback order (model quality first, then key rotation):
 *   gemini-2.5-pro   → Key1 → Key2 → Key3
 *   gemini-2.5-flash → Key1 → Key2 → Key3
 *   gemini-2.0-flash → Key1 → Key2 → Key3
 *   gemini-2.0-flash-lite → Key1 → Key2 → Key3
 *   → predefined template (never fails)
 */

const MODELS = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
]

function getApiKeys() {
  const keys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean)
  if (keys.length === 0) throw new Error("No GEMINI_API_KEY_* env vars found")
  return keys
}

/**
 * Try one Gemini model + key combination.
 * Returns the generated text or throws on error.
 */
async function callGemini(model, apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 600,
        topP: 0.95,
      },
    }),
    signal: AbortSignal.timeout(20_000), // 20s timeout per attempt
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!text) throw new Error("Empty response from Gemini")
  return text
}

/**
 * Generate text with full fallback chain.
 * Tries every (model × key) combination before returning null.
 * @returns {Promise<{text: string, model: string|null, usedFallback: boolean}>}
 */
export async function generateWithFallback(prompt) {
  let keys
  try {
    keys = getApiKeys()
  } catch {
    return { text: null, model: null, usedFallback: true }
  }

  for (const model of MODELS) {
    for (const key of keys) {
      try {
        console.log(`[gemini] trying ${model} / key ***${key.slice(-4)}`)
        const text = await callGemini(model, key, prompt)
        console.log(`[gemini] ✓ success with ${model}`)
        return { text, model, usedFallback: false }
      } catch (err) {
        console.warn(`[gemini] ✗ ${model} key ***${key.slice(-4)}: ${err.message}`)
      }
    }
  }

  console.warn("[gemini] all attempts failed — will use predefined template")
  return { text: null, model: null, usedFallback: true }
}