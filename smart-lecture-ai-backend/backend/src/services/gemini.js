/**
 * LLM Client: Gemini primary + Groq fallback.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
];
const GEMINI_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== process.env.GEMINI_MODEL)]
  : DEFAULT_GEMINI_MODELS;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const groqClient = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(modelName, systemPrompt, userMessage, opts = {}) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
  });

  const chat = model.startChat({ history: opts.history || [] });
  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}

async function callGroq(systemPrompt, userMessage, opts = {}) {
  const completion = await groqClient.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: opts.maxTokens || 2048,
    temperature: opts.temperature ?? 0.7,
  });
  return completion.choices[0].message.content;
}

function errorStatus(err) {
  return err?.status || err?.response?.status || err?.code;
}

function safeErrorMessage(err) {
  const msg = err?.message || String(err);
  // Avoid leaking provider payloads that could contain request metadata.
  return msg.length > 300 ? `${msg.slice(0, 300)}...` : msg;
}

/**
 * Call Gemini with automatic fallback across configured models, then Groq.
 * Any provider error moves to the next candidate instead of aborting generation.
 */
async function geminiChat(systemPrompt, userMessage, opts = {}) {
  let lastGeminiError = null;

  if (genAI) {
    for (const modelName of GEMINI_MODELS) {
      try {
        return await callGemini(modelName, systemPrompt, userMessage, opts);
      } catch (err) {
        lastGeminiError = err;
        const status = errorStatus(err);
        console.warn(`[gemini] ${modelName} failed (${status || "error"}): ${safeErrorMessage(err)}`);
        if (status === 429 || status === 503) await sleep(1000);
      }
    }
  }

  if (groqClient) {
    console.warn("[gemini] Gemini models exhausted, falling back to Groq...");
    try {
      return await callGroq(systemPrompt, userMessage, opts);
    } catch (groqErr) {
      const geminiMsg = lastGeminiError ? ` Gemini: ${safeErrorMessage(lastGeminiError)}.` : "";
      throw new Error(`All LLM providers failed.${geminiMsg} Groq: ${safeErrorMessage(groqErr)}`);
    }
  }

  if (lastGeminiError) {
    throw new Error(`Gemini request failed and GROQ_API_KEY is not configured. ${safeErrorMessage(lastGeminiError)}`);
  }
  throw new Error("No LLM available. Set GEMINI_API_KEY or GROQ_API_KEY.");
}

function stripCodeFences(text) {
  let cleaned = String(text || "").trim();
  const fence = cleaned.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
  if (fence) return fence[1].trim();
  // Remove a leading fence if the model opened one but did not close it cleanly.
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/i, "");
  return cleaned.trim();
}

function extractJsonCandidate(text) {
  const source = stripCodeFences(text);
  const startCandidates = [source.indexOf("{"), source.indexOf("[")].filter((i) => i >= 0);
  if (!startCandidates.length) return source;
  const start = Math.min(...startCandidates);
  const open = source[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

function sanitizeJsonText(text) {
  return String(text || "")
    .replace(/,\s*([}\]])/g, "$1") // trailing commas
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":'); // unquoted keys
}

function parseJSONResponse(raw) {
  const cleaned = stripCodeFences(raw);
  const candidates = [cleaned, extractJsonCandidate(cleaned)].filter(Boolean);
  let lastErr = null;

  for (const candidate of candidates) {
    for (const text of [candidate, sanitizeJsonText(candidate)]) {
      try {
        return JSON.parse(text);
      } catch (err) {
        lastErr = err;
      }
    }
  }

  throw new Error(`geminiJSON: could not parse response as JSON: ${cleaned.slice(0, 300)}`);
}

async function geminiJSON(systemPrompt, userMessage, opts = {}) {
  const raw = await geminiChat(
    systemPrompt + "\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code blocks.",
    userMessage,
    opts
  );
  return parseJSONResponse(raw);
}

module.exports = { geminiChat, geminiJSON, parseJSONResponse };
