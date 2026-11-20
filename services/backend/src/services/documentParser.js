const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const axios = require("axios");
const FormData = require("form-data");
const mammoth = require("mammoth");

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";
const AI_MODELS_DIR = path.resolve(__dirname, "..", "ai_models");

/**
 * Execute Python document_processor directly via CLI as an instant fallback.
 */
function extractWithPythonCli(filePath) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys, json
sys.path.insert(0, r"${AI_MODELS_DIR.replace(/\\/g, "\\\\")}")
from document_processor import process_document
res = process_document(r"${filePath.replace(/\\/g, "\\\\")}")
print(json.dumps(res))
`;
    execFile(
      "python",
      ["-c", pythonScript],
      { maxBuffer: 50 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(stderr || error.message));
        }
        try {
          // Find the last JSON line
          const lines = stdout.trim().split("\n");
          let jsonStr = "";
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().startsWith("{")) {
              jsonStr = lines.slice(i).join("\n");
              break;
            }
          }
          const data = JSON.parse(jsonStr || stdout);
          resolve({
            rawText: data.raw_text || "",
            pageCount: data.page_count || 1,
            pages: data.pages || [{ pageNumber: 1, text: data.raw_text || "" }],
            chunks: data.chunks || [],
            totalWords: data.total_words || 0,
          });
        } catch (parseErr) {
          reject(new Error(`Failed to parse python output: ${parseErr.message}\n${stdout}`));
        }
      }
    );
  });
}

/**
 * Extract using Python AI microservice HTTP endpoint.
 */
async function extractWithPythonHttp(filePath, fileName) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), fileName || path.basename(filePath));

  const response = await axios.post(`${PYTHON_AI_URL}/parse-document`, form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });

  return {
    rawText: response.data.raw_text || "",
    pageCount: response.data.page_count || 1,
    pages: response.data.pages || [],
    chunks: response.data.chunks || [],
    totalWords: response.data.total_words || 0,
  };
}

/**
 * Fallback DOCX extraction using mammoth.
 */
async function extractDocxMammoth(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  const rawText = result.value.trim();
  const paragraphs = rawText.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  const WORDS_PER_PAGE = 350;
  const pages = [];
  let currentPage = 1;
  let currentWords = 0;
  let pageParagraphs = [];

  for (const para of paragraphs) {
    const wordCount = para.split(/\s+/).length;
    currentWords += wordCount;
    pageParagraphs.push(para);

    if (currentWords >= WORDS_PER_PAGE) {
      pages.push({
        pageNumber: currentPage,
        text: pageParagraphs.join("\n\n"),
      });
      currentPage += 1;
      currentWords = 0;
      pageParagraphs = [];
    }
  }

  if (pageParagraphs.length > 0 || pages.length === 0) {
    pages.push({
      pageNumber: currentPage,
      text: pageParagraphs.join("\n\n"),
    });
  }

  return {
    rawText,
    pageCount: pages.length,
    pages,
    totalWords: rawText.split(/\s+/).filter(Boolean).length,
  };
}

/**
 * Unified document parser with cascading fallbacks:
 * 1. Python AI HTTP microservice
 * 2. Local Python PyMuPDF / python-docx CLI
 * 3. Node.js mammoth / plain text
 */
async function parseDocumentFile(filePath, fileName) {
  // Try 1: Python AI HTTP
  try {
    return await extractWithPythonHttp(filePath, fileName);
  } catch (httpErr) {
    // Expected when python-ai server is not running on port 8000
  }

  // Try 2: Local Python CLI
  try {
    return await extractWithPythonCli(filePath);
  } catch (cliErr) {
    console.warn("[documentParser] Python CLI extraction failed, falling back to node parser:", cliErr.message);
  }

  // Try 3: Format-specific Node fallback
  const ext = path.extname(filePath || fileName || "").toLowerCase();
  if (ext === ".docx" || ext === ".doc") {
    return await extractDocxMammoth(filePath);
  }

  // Fallback: Read as text
  const text = fs.readFileSync(filePath, "utf-8");
  return {
    rawText: text.trim(),
    pageCount: 1,
    pages: [{ pageNumber: 1, text: text.trim() }],
    totalWords: text.split(/\s+/).filter(Boolean).length,
  };
}

module.exports = {
  parseDocumentFile,
  extractWithPythonHttp,
  extractWithPythonCli,
  extractDocxMammoth,
};
