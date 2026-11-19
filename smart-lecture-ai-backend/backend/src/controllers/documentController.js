const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const { geminiChat } = require("../services/gemini");
const Document = require("../models/Document");
const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const { parseDocumentFile } = require("../services/documentParser");
const {
  analyzeDocument,
  generateSummaries,
} = require("../services/documentAnalysisService");

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";

const log = (...m) => console.log("[documentController]", ...m);
const errLog = (...m) => console.error("[documentController]", ...m);

/**
 * Background pipeline to extract, index, analyze, and summarize documents.
 */
async function processDocumentPipeline(documentId, filePath, fileName, title) {
  try {
    log(`[Pipeline] Starting for ${documentId} (${fileName})`);

    // 1. Mark processing & extract text
    await Document.findByIdAndUpdate(documentId, { status: "processing" });
    const parsed = await parseDocumentFile(filePath, fileName);

    log(`[Pipeline] Extracted ${parsed.pageCount} pages, ${parsed.totalWords} words for ${documentId}`);

    // 2. Ingest into ChromaDB vector store
    let chunkCount = parsed.chunks?.length || 0;
    try {
      if (fs.existsSync(filePath)) {
        const form = new FormData();
        form.append("file", fs.createReadStream(filePath), fileName);
        form.append("document_id", documentId.toString());
        form.append("title", title);

        const ingestResp = await axios.post(`${PYTHON_AI_URL}/ingest-document`, form, {
          headers: form.getHeaders(),
          timeout: 60000,
        });
        chunkCount = ingestResp.data?.chunk_count || chunkCount;
      }
    } catch (ingestErr) {
      log(`[Pipeline] Python vector ingest skipped/failed (${ingestErr.message}), continuing with document extraction.`);
    }

    // 3. Mark analyzing & run AI document analysis
    await Document.findByIdAndUpdate(documentId, {
      status: "analyzing",
      pageCount: parsed.pageCount,
      totalWords: parsed.totalWords,
      chunkCount: chunkCount || parsed.pages?.length || 1,
      rawText: parsed.rawText,
      pages: parsed.pages,
    });

    log(`[Pipeline] Running AI analysis & keyword/topic extraction for ${documentId}...`);
    const analysis = await analyzeDocument(title, parsed.pages, parsed.rawText);

    log(`[Pipeline] Generating structured summaries for ${documentId}...`);
    const summaries = await generateSummaries(title, parsed.pages, parsed.rawText);

    // 4. Save full analysis results and mark completed
    await Document.findByIdAndUpdate(documentId, {
      status: "completed",
      analysis: {
        overview: analysis.overview || "",
        executiveSummary: analysis.executiveSummary || "",
        keyPoints: analysis.keyPoints || [],
        importantFacts: analysis.importantFacts || [],
        definitions: analysis.definitions || [],
        importantConcepts: analysis.importantConcepts || [],
      },
      summary: {
        overview: analysis.overview || "",
        executiveSummary: summaries.shortSummary || analysis.executiveSummary || "",
        keyPoints: analysis.keyPoints || [],
        importantConcepts: analysis.importantConcepts || [],
        chapterSummaries: summaries.chapterSummaries || [],
        definitions: analysis.definitions || [],
        keyTakeaways: summaries.keyTakeaways || [],
        shortSummary: summaries.shortSummary || "",
        detailedSummary: summaries.detailedSummary || "",
        sectionWiseSummary: summaries.sectionWiseSummary || "",
        lastGeneratedAt: new Date(),
      },
      keywords: analysis.keywords || [],
      topics: analysis.topics || [],
    });

    log(`[Pipeline] ✅ Completed processing for ${documentId}`);
  } catch (err) {
    errLog(`[Pipeline] ❌ Failed for ${documentId}:`, err.message);
    await Document.findByIdAndUpdate(documentId, {
      status: "failed",
      errorMessage: err.message || "Document processing failed.",
    });
  } finally {
    // Clean up temporary upload file safely
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /api/documents/upload
// ─────────────────────────────────────────────────────────────────
exports.uploadDocument = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No document file uploaded." });
  }

  const allowedExts = [".pdf", ".docx", ".doc"];
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!allowedExts.includes(ext)) {
    // Delete invalid file
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      message: `Unsupported file format '${ext}'. DocuMind supports PDF and DOCX only.`,
    });
  }

  // Size limit check (50MB)
  if (req.file.size > 50 * 1024 * 1024) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ message: "File exceeds maximum size limit of 50 MB." });
  }

  const title = req.body.title?.trim() || path.parse(req.file.originalname).name;
  const fileFormat = ext.replace(".", "");

  // Create initial record in MongoDB
  const doc = await Document.create({
    userId: req.user._id,
    title,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    fileType: fileFormat,
    status: "uploaded",
  });

  // Run pipeline asynchronously so client can navigate away immediately
  processDocumentPipeline(doc._id, req.file.path, req.file.originalname, title).catch(
    (err) => errLog("Async pipeline error:", err.message)
  );

  res.status(201).json({
    message: "Document uploaded successfully. Processing started.",
    document: doc,
  });
};

// ─────────────────────────────────────────────────────────────────
// GET /api/documents
// List all user documents with search & filter (isolated by user)
// ─────────────────────────────────────────────────────────────────
exports.listDocuments = async (req, res) => {
  const query = { userId: req.user._id };

  if (req.query.search) {
    const s = req.query.search.trim();
    query.$or = [
      { title: { $regex: s, $options: "i" } },
      { fileName: { $regex: s, $options: "i" } },
      { keywords: { $regex: s, $options: "i" } },
    ];
  }

  if (req.query.status) {
    query.status = req.query.status;
  }

  const docs = await Document.find(query)
    .select("-rawText -chatHistory -pages")
    .sort({ createdAt: -1 });

  res.json({ documents: docs });
};

// ─────────────────────────────────────────────────────────────────
// GET /api/documents/:id
// Get single document with full metadata (user isolated)
// ─────────────────────────────────────────────────────────────────
exports.getDocument = async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) {
    return res.status(404).json({ message: "Document not found or access denied." });
  }
  res.json({ document: doc });
};

// ─────────────────────────────────────────────────────────────────
// GET /api/documents/:id/status
// Fast status polling
// ─────────────────────────────────────────────────────────────────
exports.getDocumentStatus = async (req, res) => {
  const doc = await Document.findOne(
    { _id: req.params.id, userId: req.user._id },
    "status errorMessage chunkCount totalWords pageCount"
  );
  if (!doc) {
    return res.status(404).json({ message: "Document not found." });
  }
  res.json({
    status: doc.status,
    errorMessage: doc.errorMessage,
    pageCount: doc.pageCount,
    chunkCount: doc.chunkCount,
    totalWords: doc.totalWords,
  });
};

// ─────────────────────────────────────────────────────────────────
// DELETE /api/documents/:id
// Delete document, vectors, and associated quizzes
// ─────────────────────────────────────────────────────────────────
exports.deleteDocument = async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) {
    return res.status(404).json({ message: "Document not found or access denied." });
  }

  // Remove from ChromaDB
  try {
    await axios.delete(`${PYTHON_AI_URL}/delete-document/${doc._id}`, { timeout: 8000 });
  } catch (err) {
    log(`ChromaDB delete skipped: ${err.message}`);
  }

  // Remove associated quizzes and attempts
  await Quiz.deleteMany({ documentId: doc._id, userId: req.user._id });
  await QuizAttempt.deleteMany({ document: doc._id, student: req.user._id });

  await doc.deleteOne();
  res.json({ message: "Document and associated intelligence deleted successfully." });
};

// ─────────────────────────────────────────────────────────────────
// POST /api/documents/:id/chat
// Grounded RAG Q&A with exact page numbers & citations
// ─────────────────────────────────────────────────────────────────
exports.chatWithDocument = async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ message: "Question message is required." });
  }

  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) {
    return res.status(404).json({ message: "Document not found or access denied." });
  }

  if (doc.status !== "completed" && doc.status !== "ready") {
    return res.status(400).json({
      message: `Document is currently in '${doc.status}' state. Please wait until processing completes.`,
    });
  }

  // 1. Retrieve relevant chunks with page citations from ChromaDB or pages array
  let contextChunks = [];
  try {
    const resp = await axios.post(
      `${PYTHON_AI_URL}/query-document`,
      {
        document_id: doc._id.toString(),
        query: message,
        top_k: 5,
      },
      { timeout: 12000 }
    );
    contextChunks = resp.data?.chunks || [];
  } catch (err) {
    log(`Vector query fallback for ${doc._id}: ${err.message}`);
  }

  // Fallback: If ChromaDB returns no chunks, search in doc.pages directly
  if (!contextChunks.length && doc.pages?.length) {
    const queryTokens = message.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const scoredPages = doc.pages.map((p) => {
      const pLower = (p.text || "").toLowerCase();
      let matchCount = 0;
      queryTokens.forEach((token) => {
        if (pLower.includes(token)) matchCount++;
      });
      return {
        text: p.text.slice(0, 800),
        pageNumber: p.pageNumber,
        section: `Page ${p.pageNumber}`,
        score: matchCount / (queryTokens.length || 1),
      };
    });
    scoredPages.sort((a, b) => b.score - a.score);
    contextChunks = scoredPages.slice(0, 3);
  }

  // Format context for RAG
  const contextText = contextChunks
    .map(
      (c, idx) =>
        `[Source ${idx + 1} | Page ${c.pageNumber || 1} | ${c.section || "General"}]\n${c.text}`
    )
    .join("\n\n");

  const systemPrompt = `You are DocuMind's AI Document Assistant answering questions about "${doc.title}".
CRITICAL GROUNDING RULES:
1. Answer strictly and exclusively using the provided document excerpts.
2. If the document does not contain the answer, state clearly: "I could not find information regarding this in the uploaded document."
3. Never invent facts or hallucinate citations.
4. When stating facts, explicitly reference the source page (e.g., "[Page 4]").
5. Keep explanations clear, professional, and educational.`;

  const recentHistory = (doc.chatHistory || []).slice(-6).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const userMessage = `Document Excerpts:\n\n${contextText}\n\n---\nStudent Question: ${message}`;

  let answer = "";
  try {
    answer = await geminiChat(systemPrompt, userMessage, {
      maxTokens: 800,
      temperature: 0.2,
      history: recentHistory,
    });
  } catch (err) {
    errLog("Gemini chat failed:", err.message);
    answer = contextChunks.length
      ? `Based on the document excerpts:\n\n${contextChunks.map((c) => `• [Page ${c.pageNumber || 1}]: ${c.text}`).join("\n\n")}`
      : "The AI service is temporarily unavailable. Please try again in a moment.";
  }

  const formattedSources = contextChunks.map((c) => ({
    text: (c.text || "").slice(0, 250) + ((c.text || "").length > 250 ? "..." : ""),
    score: c.score || 0.85,
    pageNumber: c.pageNumber || 1,
    section: c.section || `Page ${c.pageNumber || 1}`,
  }));

  // Persist in chat history
  await Document.findByIdAndUpdate(doc._id, {
    $push: {
      chatHistory: {
        $each: [
          { role: "user", content: message },
          { role: "assistant", content: answer, sources: formattedSources },
        ],
      },
    },
  });

  res.json({
    answer,
    sources: formattedSources,
  });
};

// ─────────────────────────────────────────────────────────────────
// DELETE /api/documents/:id/chat
// Clear chat history
// ─────────────────────────────────────────────────────────────────
exports.clearChat = async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) {
    return res.status(404).json({ message: "Document not found or access denied." });
  }

  await Document.findByIdAndUpdate(doc._id, { $set: { chatHistory: [] } });
  res.json({ message: "Chat history cleared successfully." });
};

// ─────────────────────────────────────────────────────────────────
// POST /api/documents/:id/regenerate-summary
// ─────────────────────────────────────────────────────────────────
exports.regenerateSummary = async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
  if (!doc) {
    return res.status(404).json({ message: "Document not found or access denied." });
  }

  const summaries = await generateSummaries(doc.title, doc.pages, doc.rawText);

  doc.summary = {
    overview: doc.analysis?.overview || doc.summary?.overview || "",
    executiveSummary: summaries.shortSummary || doc.summary?.executiveSummary || "",
    keyPoints: doc.analysis?.keyPoints || doc.summary?.keyPoints || [],
    importantConcepts: doc.analysis?.importantConcepts || doc.summary?.importantConcepts || [],
    chapterSummaries: summaries.chapterSummaries || [],
    definitions: doc.analysis?.definitions || [],
    keyTakeaways: summaries.keyTakeaways || [],
    shortSummary: summaries.shortSummary || "",
    detailedSummary: summaries.detailedSummary || "",
    sectionWiseSummary: summaries.sectionWiseSummary || "",
    lastGeneratedAt: new Date(),
  };

  await doc.save();
  res.json({ message: "Summary regenerated successfully.", summary: doc.summary });
};
