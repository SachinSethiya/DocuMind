/**
 * LLM Client: Google Gemini via @google/genai.
 * Exported function names keep the legacy gemini* identifiers so existing
 * services continue to work without import changes.
 */

const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || "120000", 10);

const GEMINI_MODELS = [...new Set([PRIMARY_MODEL, FALLBACK_MODEL].filter(Boolean))];
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

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

function normalizeRole(role) {
  if (role === "model" || role === "assistant") return "model";
  return "user";
}

function contentText(m) {
  if (typeof m?.content === "string") return m.content;
  if (Array.isArray(m?.parts)) return m.parts.map((p) => p?.text || "").join("\n");
  return "";
}

function buildContents(history = [], userMessage) {
  const contents = [];
  for (const m of history || []) {
    const text = contentText(m);
    if (text) contents.push({ role: normalizeRole(m?.role), parts: [{ text }] });
  }
  contents.push({ role: "user", parts: [{ text: userMessage }] });
  return contents;
}

function extractText(response) {
  if (typeof response?.text === "string") return response.text;
  if (typeof response?.text === "function") {
    const t = response.text();
    return typeof t === "string" ? t : "";
  }
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p?.text || "").join("");
}

async function callGemini(modelName, systemPrompt, userMessage, opts = {}) {
  const config = {
    systemInstruction: systemPrompt,
    temperature: opts.temperature ?? 0.7,
    maxOutputTokens: opts.maxTokens || 2048,
  };
  if (opts.json) config.responseMimeType = "application/json";

  const response = await withTimeout(
    ai.models.generateContent({
      model: modelName,
      contents: buildContents(opts.history, userMessage),
      config,
    }),
    "Gemini request"
  );
  const text = extractText(response);
  if (!text || !String(text).trim()) {
    const err = new Error("Gemini returned an empty response.");
    err.code = "LLM_EMPTY_RESPONSE";
    err.retryable = true;
    throw err;
  }
  return text;
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

function isModelSpecificError(err) {
  const status = errorStatus(err);
  const msg = String(err?.message || "").toLowerCase();
  return (
    status === 404 ||
    (status === 400 && (msg.includes("model") || msg.includes("not found") || msg.includes("not supported"))) ||
    msg.includes("is not found") ||
    msg.includes("not supported for generatecontent") ||
    msg.includes("models/")
  );
}

function isPermanentError(err) {
  const status = errorStatus(err);
  if ([400, 401, 403, 404].includes(status)) return true;
  const msg = String(err?.message || "").toLowerCase();
  const code = String(err?.code || "").toLowerCase();
  const apiCode = String(err?.error?.code || "").toLowerCase();
  return (
    msg.includes("invalid api key") ||
    msg.includes("api key not valid") ||
    msg.includes("incorrect api key") ||
    msg.includes("permission denied") ||
    msg.includes("does not exist") ||
    msg.includes("model_not_found") ||
    msg.includes("model not found") ||
    msg.includes("insufficient_quota") ||
    msg.includes("exceeded your current quota") ||
    msg.includes("quota exceeded") ||
    msg.includes("no credits remaining") ||
    msg.includes("add credits") ||
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
 * Call Gemini with ordered primary/fallback model handling.
 * Model-specific failures (404/unsupported model) move to the fallback model.
 * Permanent non-model failures (bad key, quota) stop immediately.
 */
async function geminiChat(systemPrompt, userMessage, opts = {}) {
  if (!ai) {
    const err = new Error("No LLM available. Set GEMINI_API_KEY.");
    err.code = "LLM_NOT_CONFIGURED";
    err.retryable = false;
    throw err;
  }

  const failures = [];
  for (const modelName of GEMINI_MODELS) {
    try {
      return await callGemini(modelName, systemPrompt, userMessage, opts);
    } catch (err) {
      const status = errorStatus(err);
      const permanent = isPermanentError(err);
      const modelSpecific = isModelSpecificError(err);
      failures.push({ model: modelName, status, permanent, modelSpecific, message: safeErrorMessage(err) });
      console.warn(`[gemini] ${modelName} failed (${status || "error"}): ${safeErrorMessage(err)}`);
      if (permanent && !modelSpecific && status !== 429) break;
      if (status === 429 || status === 503) await sleep(1000);
    }
  }

  if (!failures.length) {
    throw new Error("No Gemini models configured.");
  }

  const summary = failures.map((f) => `${f.model}: ${f.status || "error"} ${f.message}`).join(" | ");
  const err = new Error(`Gemini request failed. ${summary}`);
  err.code = "LLM_ALL_FAILED";
  err.status = failures.map((f) => f.status).find((s) => isTransientStatus(s)) || failures.map((f) => f.status).filter(Boolean).pop() || 500;
  err.retryable = failures.some((f) => !f.permanent);
  throw err;
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

  throw new Error(`Gemini JSON parse failed: ${cleaned.slice(0, 300)}`);
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
