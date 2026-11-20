/**
 * LLM Client: OpenAI (gpt-4.1-mini).
 * Exported function names keep the legacy gemini* identifiers so existing
 * services continue to work without import changes.
 */

const OpenAI = require("openai");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || "120000", 10);

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${LLM_TIMEOUT_MS}ms`);
      err.status = 504;
      err.code = "LLM_TIMEOUT";
      reject(err);
    }, LLM_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function historyToMessages(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .map((m) => {
      let role = m?.role;
      let content = "";
      if (typeof m?.content === "string") content = m.content;
      else if (Array.isArray(m?.parts)) content = m.parts.map((p) => p?.text || "").join("\n");
      if (role === "model") role = "assistant";
      if (!["system", "user", "assistant"].includes(role)) role = "user";
      return content ? { role, content } : null;
    })
    .filter(Boolean);
}

async function callOpenAI(systemPrompt, userMessage, opts = {}) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...historyToMessages(opts.history),
    { role: "user", content: userMessage },
  ];

  const params = {
    model: OPENAI_MODEL,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_completion_tokens: opts.maxTokens || 2048,
  };
  if (opts.json) params.response_format = { type: "json_object" };

  const completion = await withTimeout(openai.chat.completions.create(params), "OpenAI request");
  const content = completion?.choices?.[0]?.message?.content;
  if (!content || !String(content).trim()) {
    const err = new Error("OpenAI returned an empty response.");
    err.code = "LLM_EMPTY_RESPONSE";
    err.retryable = true;
    throw err;
  }
  return content;
}

function errorStatus(err) {
  const raw = err?.status ?? err?.response?.status ?? err?.error?.status;
  const status = parseInt(raw, 10);
  return Number.isFinite(status) ? status : undefined;
}

function safeErrorMessage(err) {
  const msg = err?.message || String(err);
  // Avoid leaking provider payloads that could contain request metadata.
  return msg.length > 300 ? `${msg.slice(0, 300)}...` : msg;
}

function isTransientStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isPermanentError(err) {
  const status = errorStatus(err);
  if ([400, 401, 403, 404].includes(status)) return true;
  const msg = String(err?.message || "").toLowerCase();
  const code = String(err?.code || "").toLowerCase();
  const apiCode = String(err?.error?.code || "").toLowerCase();
  return (
    msg.includes("invalid api key") ||
    msg.includes("incorrect api key") ||
    msg.includes("insufficient_quota") ||
    msg.includes("exceeded your current quota") ||
    msg.includes("permission denied") ||
    msg.includes("does not exist") ||
    msg.includes("model_not_found") ||
    msg.includes("model not found") ||
    code.includes("invalid_api_key") ||
    code.includes("insufficient_quota") ||
    apiCode.includes("invalid_api_key") ||
    apiCode.includes("insufficient_quota")
  );
}

function isRetryableLLMError(err) {
  if (!err) return true;
  if (err.code === "LLM_PERMANENT" || err.code === "LLM_NOT_CONFIGURED") return false;
  if (err.retryable === false) return false;
  return !isPermanentError(err);
}

/**
 * Call OpenAI with classified error handling.
 * Permanent failures (bad key, quota, model missing) are not retried upstream.
 */
async function geminiChat(systemPrompt, userMessage, opts = {}) {
  if (!openai) {
    const err = new Error("No LLM available. Set OPENAI_API_KEY.");
    err.code = "LLM_NOT_CONFIGURED";
    err.retryable = false;
    throw err;
  }

  try {
    return await callOpenAI(systemPrompt, userMessage, opts);
  } catch (err) {
    const status = errorStatus(err);
    const permanent = isPermanentError(err);
    err.code = permanent ? "LLM_PERMANENT" : err.code || "LLM_ERROR";
    err.status = status;
    err.retryable = !permanent;
    throw err;
  }
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
  const source = String(text || "");
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === ",") {
      let j = i + 1;
      while (j < source.length && /\s/.test(source[j])) j += 1;
      if (source[j] === "}" || source[j] === "]") continue;
    }

    out += ch;
  }

  return out;
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

  throw new Error(`OpenAI JSON parse failed: ${cleaned.slice(0, 300)}`);
}

async function geminiJSON(systemPrompt, userMessage, opts = {}) {
  const raw = await geminiChat(
    systemPrompt + "\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code blocks.",
    userMessage,
    { ...opts, json: true }
  );
  return parseJSONResponse(raw);
}

module.exports = { geminiChat, geminiJSON, parseJSONResponse, isRetryableLLMError };
