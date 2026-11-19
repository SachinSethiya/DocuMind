"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import type {
  Document as DocType,
  ChatMessage,
  QuizQuestion,
  QuizAttempt,
  AnswerEvaluation,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SourceReference } from "@/components/source-reference"
import {
  ArrowLeft,
  FileText,
  Layers,
  Sparkles,
  MessageSquareText,
  Brain,
  HelpCircle,
  History,
  Send,
  Loader2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Tag,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

function formatBytes(bytes: number) {
  if (!bytes) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function DocumentWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [doc, setDoc] = useState<DocType | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<
    "overview" | "summary" | "topics" | "chat" | "mcqs" | "descriptive" | "history"
  >("overview")

  // Summary state
  const [summaryMode, setSummaryMode] = useState<"short" | "detailed" | "section">("detailed")
  const [regeneratingSummary, setRegeneratingSummary] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [sendingChat, setSendingChat] = useState(false)
  const [clearingChat, setClearingChat] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // MCQs state
  const [mcqs, setMcqs] = useState<QuizQuestion[]>([])
  const [loadingMcqs, setLoadingMcqs] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({})
  const [revealedExplanations, setRevealedExplanations] = useState<Record<number, boolean>>({})

  // Descriptive questions state
  const [descriptiveQs, setDescriptiveQs] = useState<QuizQuestion[]>([])
  const [loadingDescriptive, setLoadingDescriptive] = useState(false)
  const [userDescriptiveAnswers, setUserDescriptiveAnswers] = useState<Record<number, string>>({})
  const [evaluations, setEvaluations] = useState<Record<number, AnswerEvaluation>>({})
  const [evaluatingIndex, setEvaluatingIndex] = useState<number | null>(null)
  const [revealedExpected, setRevealedExpected] = useState<Record<number, boolean>>({})

  // Quiz History state
  const [history, setHistory] = useState<QuizAttempt[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)

  // Question generation configuration
  const [mcqConfig, setMcqConfig] = useState({
    count: 5,
    customCount: "",
    difficulty: "medium" as "easy" | "medium" | "hard" | "mixed",
    topicMode: "entire" as "entire" | "important" | "specific",
    selectedTopic: "",
  })
  const [descConfig, setDescConfig] = useState({
    count: 5,
    customCount: "",
    difficulty: "medium" as "easy" | "medium" | "hard" | "mixed",
    subtype: "mixed" as "shortAnswer" | "longAnswer" | "conceptual" | "analytical" | "mixed",
    topicMode: "entire" as "entire" | "important" | "specific",
    selectedTopic: "",
  })
  const [generationError, setGenerationError] = useState("")
  const [generationWarning, setGenerationWarning] = useState("")

  const loadDocument = useCallback(async () => {
    try {
      const res = await apiService.getDocument(id)
      setDoc(res.document)
      setMessages(res.document.chatHistory || [])
    } catch (err) {
      console.error("Failed to load document:", err)
      router.push("/dashboard/documents")
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    loadDocument()
  }, [loadDocument])

  useEffect(() => {
    if (activeTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, sendingChat, activeTab])

  // Load History when tab is activated
  useEffect(() => {
    if (activeTab === "history" && doc) {
      async function fetchHistory() {
        setLoadingHistory(true)
        try {
          const res = await apiService.getQuizHistory(doc!._id)
          setHistory(res.attempts || [])
        } catch (err) {
          console.error("Failed to load history:", err)
        } finally {
          setLoadingHistory(false)
        }
      }
      fetchHistory()
    }
  }, [activeTab, doc])

  // Chat send handler
  async function handleSendChat(textToSend?: string) {
    const q = (textToSend ?? chatInput).trim()
    if (!q || sendingChat || !doc) return

    setChatInput("")
    setSendingChat(true)

    const userMsg: ChatMessage = { role: "user", content: q }
    setMessages((prev) => [...prev, userMsg])

    try {
      const resp = await apiService.chatWithDocument(doc._id, q)
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: resp.answer,
        sources: resp.sources,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: err?.response?.data?.message || "Failed to retrieve answer. Please try again.",
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setSendingChat(false)
    }
  }

  // Clear chat
  async function handleClearChat() {
    if (!doc || !confirm("Clear all conversation history for this document?")) return
    setClearingChat(true)
    try {
      await apiService.clearDocumentChat(doc._id)
      setMessages([])
    } finally {
      setClearingChat(false)
    }
  }

  // Regenerate summary
  async function handleRegenerateSummary() {
    if (!doc) return
    setRegeneratingSummary(true)
    try {
      const res = await apiService.regenerateSummary(doc._id)
      setDoc((prev) => (prev ? { ...prev, summary: res.summary } : null))
    } catch (err) {
      alert("Failed to regenerate summary. Please try again.")
    } finally {
      setRegeneratingSummary(false)
    }
  }

  function topicOptions() {
    return (doc?.topics || []).map((t) => t.name).filter(Boolean)
  }

  function resolveTopicPayload(config: typeof mcqConfig) {
    if (config.topicMode === "specific" && config.selectedTopic) {
      return { topic: config.selectedTopic, selectedTopics: [config.selectedTopic] }
    }
    if (config.topicMode === "important") {
      const important = topicOptions().slice(0, 5)
      return { topic: "Important Topics", selectedTopics: important }
    }
    return { topic: "All Topics", selectedTopics: [] }
  }

  function configuredCount(config: typeof mcqConfig) {
    const custom = parseInt(config.customCount, 10)
    if (Number.isInteger(custom) && custom > 0) return Math.min(20, custom)
    return config.count
  }

  async function handleGenerateMcqs() {
    if (!doc) return
    const count = configuredCount(mcqConfig)
    setLoadingMcqs(true)
    setGenerationError("")
    setGenerationWarning("")
    try {
      const res = await apiService.generateQuiz({
        documentId: doc._id,
        numQuestions: count,
        difficulty: mcqConfig.difficulty,
        questionType: "mcq",
        ...resolveTopicPayload(mcqConfig),
      })
      setMcqs(res.quiz?.questions || [])
      setSelectedOptions({})
      setRevealedExplanations({})
      setGenerationWarning(res.warning || "")
    } catch (err: any) {
      setGenerationError(err?.response?.data?.message || "Failed to generate MCQs. Please try again.")
      setMcqs([])
    } finally {
      setLoadingMcqs(false)
    }
  }

  async function handleGenerateDescriptive() {
    if (!doc) return
    const count = configuredCount(descConfig)
    setLoadingDescriptive(true)
    setGenerationError("")
    setGenerationWarning("")
    try {
      const res = await apiService.generateQuiz({
        documentId: doc._id,
        numQuestions: count,
        difficulty: descConfig.difficulty,
        questionType: "descriptive",
        questionSubtype: descConfig.subtype,
        ...resolveTopicPayload(descConfig),
      })
      setDescriptiveQs(res.quiz?.questions || [])
      setUserDescriptiveAnswers({})
      setEvaluations({})
      setRevealedExpected({})
      setGenerationWarning(res.warning || "")
    } catch (err: any) {
      setGenerationError(err?.response?.data?.message || "Failed to generate descriptive questions. Please try again.")
      setDescriptiveQs([])
    } finally {
      setLoadingDescriptive(false)
    }
  }

  // Evaluate single descriptive answer
  async function handleEvaluateDescriptive(qIndex: number, question: QuizQuestion) {
    const userAnswer = userDescriptiveAnswers[qIndex] || ""
    if (!userAnswer.trim()) {
      alert("Please write your answer before requesting AI evaluation.")
      return
    }

    setEvaluatingIndex(qIndex)
    try {
      const evaluation = await apiService.evaluateAnswer({
        question: question.question,
        expectedAnswer: question.expectedAnswer || "",
        keyPoints: question.keyPoints || [],
        userAnswer,
        pageNumber: question.pageNumber,
      })
      setEvaluations((prev) => ({ ...prev, [qIndex]: evaluation }))
    } catch (err) {
      alert("Failed to evaluate answer.")
    } finally {
      setEvaluatingIndex(null)
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-muted-foreground space-y-2">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#EAB308]" />
        <p>Loading document workspace...</p>
      </div>
    )
  }

  if (!doc) return null

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Breadcrumb & Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/documents")}
            className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="h-9 w-9 rounded-xl bg-[#EAB308]/15 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-[#EAB308]" />
          </div>

          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate" title={doc.title}>
              {doc.title}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="uppercase font-semibold">{doc.fileType}</span>
              <span>•</span>
              <span>{formatBytes(doc.fileSize)}</span>
              {doc.pageCount > 0 && (
                <>
                  <span>•</span>
                  <span>{doc.pageCount} Pages</span>
                </>
              )}
              {doc.chunkCount > 0 && (
                <>
                  <span>•</span>
                  <span>{doc.chunkCount} Indexed Chunks</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Button
            size="sm"
            onClick={() =>
              router.push(`/dashboard/quizzes?documentId=${doc._id}`)
            }
            className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold h-8 text-xs rounded-lg shadow-sm"
          >
            <Brain className="h-3.5 w-3.5 mr-1.5" />
            Launch Quiz
          </Button>
        </div>
      </div>

      {/* Workspace Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-card border border-border p-1.5 rounded-2xl w-full">
        {[
          { key: "overview", label: "Overview", icon: Layers },
          { key: "summary", label: "Summary", icon: FileText },
          { key: "topics", label: "Topics & Keywords", icon: Sparkles },
          { key: "chat", label: "Ask AI", icon: MessageSquareText },
          { key: "mcqs", label: "MCQs", icon: HelpCircle },
          { key: "descriptive", label: "Descriptive Qs", icon: Brain },
          { key: "history", label: "Quiz History", icon: History },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all",
              activeTab === tab.key
                ? "bg-[#EAB308]/15 text-[#EAB308] font-bold shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5 shrink-0" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: OVERVIEW
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Overview / Executive Summary */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                Document Executive Overview
              </span>
              <p className="text-sm text-foreground leading-relaxed">
                {doc.analysis?.overview ||
                  doc.summary?.overview ||
                  doc.summary?.detailedSummary ||
                  "Automatic document analysis has extracted structured knowledge from this file."}
              </p>
            </div>

            {/* Key Insights */}
            {(() => {
              const insights = doc.summary?.keyFindings?.length
                ? doc.summary.keyFindings
                : doc.analysis?.importantFacts?.length
                  ? doc.analysis.importantFacts
                  : doc.summary?.finalTakeaways || []
              if (!insights.length) return null
              return (
                <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                    Key Insights
                  </span>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {insights.slice(0, 8).map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#EAB308] mt-1.5 shrink-0" />
                        <span className="text-foreground leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })()}

            {/* Key Points */}
            {doc.analysis?.keyPoints && doc.analysis.keyPoints.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                  Key Points & Findings
                </span>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {doc.analysis.keyPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#EAB308] mt-1.5 shrink-0" />
                      <span className="text-foreground leading-relaxed">{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Important Definitions with Page Citations */}
            {doc.analysis?.definitions && doc.analysis.definitions.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                  Important Terminology & Definitions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {doc.analysis.definitions.map((d, i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-border bg-secondary/30 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-foreground">{d.term}</h4>
                        <SourceReference pageNumber={d.pageNumber || 1} compact />
                      </div>
                      <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                        {d.definition}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Quick Actions
              </span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setActiveTab("summary")} className="text-xs h-8 border-border">
                  View Full Summary
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActiveTab("topics")} className="text-xs h-8 border-border">
                  Explore Topics
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActiveTab("chat")} className="text-xs h-8 border-border">
                  Ask AI
                </Button>
                <Button size="sm" onClick={() => setActiveTab("mcqs")} className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold text-xs h-8">
                  Generate MCQs
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActiveTab("descriptive")} className="text-xs h-8 border-border">
                  Generate Descriptive Questions
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Metadata & Important Facts */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Document Specs
              </span>
              <div className="divide-y divide-border/60 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Original Name</span>
                  <span className="font-medium text-foreground truncate max-w-[150px]">{doc.fileName}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Total Words</span>
                  <span className="font-medium text-foreground">{doc.totalWords.toLocaleString()}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Page Count</span>
                  <span className="font-medium text-foreground">{doc.pageCount}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Processing Status</span>
                  <span className="capitalize font-semibold text-emerald-500">{doc.status}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-muted-foreground">Uploaded</span>
                  <span className="font-medium text-foreground">
                    {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>

            {/* Facts */}
            {doc.analysis?.importantFacts && doc.analysis.importantFacts.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                  Verified Document Facts
                </span>
                <div className="space-y-2">
                  {doc.analysis.importantFacts.map((fact, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-secondary/50 border border-border/50 text-[11.5px] text-foreground">
                      {fact}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Topics */}
            {doc.topics && doc.topics.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                  Top Topics
                </span>
                <div className="space-y-2">
                  {[...doc.topics]
                    .sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0))
                    .slice(0, 8)
                    .map((topic, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveTab("topics")}
                        className="w-full text-left p-2.5 rounded-lg bg-secondary/40 border border-border/50 hover:border-[#EAB308]/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">{topic.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{topic.importanceScore || 0}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{topic.explanation}</p>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: SUMMARY (Short, Detailed, Section-wise)
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border p-3.5 rounded-2xl">
            {/* Format Toggles */}
            <div className="flex items-center gap-1.5 bg-secondary p-1 rounded-xl">
              {[
                { key: "detailed", label: "Detailed Summary" },
                { key: "short", label: "Short Summary" },
                { key: "section", label: "Section-wise Breakdown" },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSummaryMode(s.key as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    summaryMode === s.key
                      ? "bg-[#EAB308] text-black font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerateSummary}
              disabled={regeneratingSummary}
              className="text-xs h-8 border-border hover:bg-accent self-start sm:self-auto"
            >
              {regeneratingSummary ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-[#EAB308]" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Regenerate Summary
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            {summaryMode === "short" && (
              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                  Core Thesis & Executive Summary
                </span>
                {doc.summary?.documentOverview && (
                  <p className="text-sm text-foreground leading-relaxed">{doc.summary.documentOverview}</p>
                )}
                {doc.summary?.mainObjective && (
                  <div className="p-3 rounded-xl bg-secondary/40 border border-border/50">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Main Objective</span>
                    <p className="text-xs text-foreground mt-1 leading-relaxed">{doc.summary.mainObjective}</p>
                  </div>
                )}
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {doc.summary?.shortSummary ||
                    doc.summary?.executiveSummary ||
                    "Short summary available."}
                </p>
              </div>
            )}

            {summaryMode === "detailed" && (
              <div className="space-y-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                  Comprehensive Detailed Narrative
                </span>
                {doc.summary?.documentOverview && (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-1">Document Overview</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{doc.summary.documentOverview}</p>
                  </div>
                )}
                {doc.summary?.mainObjective && (
                  <div className="p-3 rounded-xl bg-secondary/40 border border-border/50">
                    <h4 className="text-xs font-bold text-foreground">Main Objective</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{doc.summary.mainObjective}</p>
                  </div>
                )}
                {doc.summary?.importantConcepts && doc.summary.importantConcepts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-2">Important Concepts</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {doc.summary.importantConcepts.map((c, i) => (
                        <span key={i} className="text-[11px] px-2.5 py-1 rounded-lg bg-accent border border-border/50 text-foreground">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                {doc.summary?.keyPoints && doc.summary.keyPoints.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-2">Key Points</h4>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {doc.summary.keyPoints.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2"><span className="text-[#EAB308]">•</span><span>{pt}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {doc.summary?.importantDefinitions && doc.summary.importantDefinitions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-2">Important Definitions</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {doc.summary.importantDefinitions.map((d, i) => (
                        <div key={i} className="p-3 rounded-xl border border-border bg-secondary/30">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-foreground">{d.term}</span>
                            <SourceReference pageNumber={d.pageNumber || 1} compact />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{d.definition}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {doc.summary?.keyFindings && doc.summary.keyFindings.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-2">Key Findings</h4>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {doc.summary.keyFindings.map((f, i) => (
                        <li key={i} className="flex items-start gap-2"><span className="text-[#EAB308]">•</span><span>{f}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans pt-2 border-t border-border/60">
                  {doc.summary?.detailedSummary || doc.analysis?.overview || "Detailed summary available."}
                </div>
              </div>
            )}

            {summaryMode === "section" && (
              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                  Chapter & Section-wise Breakdown
                </span>
                {doc.summary?.chapterSummaries && doc.summary.chapterSummaries.length > 0 ? (
                  <div className="space-y-3">
                    {doc.summary.chapterSummaries.map((cs, i) => (
                      <div key={i} className="p-4 rounded-xl border border-border bg-secondary/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-foreground">{cs.title}</h4>
                          <SourceReference pageNumber={cs.pageNumber || 1} compact />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{cs.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                    {doc.summary?.sectionWiseSummary || "Section-wise summary available."}
                  </div>
                )}
                {doc.summary?.importantDefinitions && doc.summary.importantDefinitions.length > 0 && (
                  <div className="pt-3 border-t border-border/60">
                    <h4 className="text-xs font-bold text-foreground mb-2">Important Definitions</h4>
                    <div className="space-y-2">
                      {doc.summary.importantDefinitions.map((d, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 text-xs">
                          <span className="font-semibold text-foreground">{d.term}</span>
                          <span className="text-muted-foreground flex-1">{d.definition}</span>
                          <SourceReference pageNumber={d.pageNumber || 1} compact />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Key Takeaways */}
            {doc.summary?.keyTakeaways && doc.summary.keyTakeaways.length > 0 && (
              <div className="pt-4 border-t border-border/60 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Key Takeaways
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {doc.summary.keyTakeaways.map((takeaway, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-foreground bg-accent/40 p-2.5 rounded-lg border border-border/40">
                      <span className="text-[#EAB308] font-bold">✓</span>
                      <span>{takeaway}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: TOPICS & KEYWORDS
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === "topics" && (
        <div className="space-y-6">
          {/* Keywords Tag Cloud */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
              Extracted Keywords & Terminology
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              {doc.keywords && doc.keywords.length > 0 ? (
                doc.keywords.map((kw, i) => (
                  <span
                    key={i}
                    onClick={() => {
                      setActiveTab("chat")
                      handleSendChat(`Explain the term "${kw}" in the context of this document.`)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-[#EAB308]/15 border border-border hover:border-[#EAB308]/30 text-xs font-semibold text-foreground cursor-pointer transition-all"
                  >
                    <Tag className="h-3 w-3 text-[#EAB308]" />
                    #{kw}
                  </span>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Keywords indexed.</p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tip: Click any keyword to ask DocuMind AI for a detailed explanation.
            </p>
          </div>

          {/* Topics Hierarchy */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
              Structured Topic Explorer
            </span>

            {doc.topics && doc.topics.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...doc.topics]
                  .sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0))
                  .map((t, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3 hover:border-[#EAB308]/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-foreground truncate">{t.name}</h4>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#EAB308]/15 text-[#EAB308] font-semibold shrink-0">
                              {t.importanceScore || 0}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">{t.section || `Page ${t.pageNumber || 1}`}</p>
                        </div>
                        <SourceReference pageNumber={t.pageNumber || 1} section={t.section || t.name} compact />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{t.explanation}</p>
                      {t.subtopics && t.subtopics.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {t.subtopics.map((sub, j) => (
                            <span key={j} className="text-[10px] px-2 py-0.5 rounded-md bg-accent text-muted-foreground border border-border/50">
                              {sub}
                            </span>
                          ))}
                        </div>
                      )}
                      {t.relatedKeywords && t.relatedKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {t.relatedKeywords.slice(0, 6).map((kw, j) => (
                            <span key={j} className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border/40">
                              #{kw}
                            </span>
                          ))}
                        </div>
                      )}
                      {t.pageReferences && t.pageReferences.length > 1 && (
                        <p className="text-[10px] text-muted-foreground">Pages: {t.pageReferences.slice(0, 8).join(", ")}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] border-border"
                          onClick={() => {
                            setActiveTab("chat")
                            handleSendChat(`Explain "${t.name}" in detail and cite the relevant pages.`)
                          }}
                        >
                          Ask AI
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] border-border"
                          onClick={() => {
                            setMcqConfig((prev) => ({ ...prev, topicMode: "specific", selectedTopic: t.name }))
                            setActiveTab("mcqs")
                          }}
                        >
                          Generate MCQs
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] border-border"
                          onClick={() => {
                            setDescConfig((prev) => ({ ...prev, topicMode: "specific", selectedTopic: t.name }))
                            setActiveTab("descriptive")
                          }}
                        >
                          Generate Questions
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Topics parsed.</p>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: ASK AI (Document Chat with Page References)
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[500px] rounded-2xl border border-border bg-card overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#EAB308]" />
              <span className="text-xs font-semibold text-foreground">
                Grounded Document Assistant
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-mono px-2 py-0.5 rounded-full border border-emerald-500/20">
                Verified Page Citations
              </span>
            </div>

            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                disabled={clearingChat}
                className="h-7 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear Chat
              </Button>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-[#EAB308]/15 flex items-center justify-center">
                  <MessageSquareText className="h-6 w-6 text-[#EAB308]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Ask anything about this document</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    AI retrieves verified chunks and provides accurate page citations with every answer.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {[
                    "Explain the main concept of this document.",
                    "What are the most important points in this document?",
                    "Give me a clear definition of the key topics.",
                    "What are the conclusions or final takeaways?",
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendChat(suggestion)}
                      className="text-left text-[11.5px] px-3 py-1.5 rounded-xl border border-border bg-secondary/50 hover:bg-[#EAB308]/10 hover:border-[#EAB308]/30 transition-all text-muted-foreground hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isUser = msg.role === "user"
                return (
                  <div key={i} className={cn("flex gap-3", isUser && "justify-end")}>
                    {!isUser && (
                      <div className="h-7 w-7 rounded-lg bg-[#EAB308]/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="h-4 w-4 text-[#EAB308]" />
                      </div>
                    )}
                    <div className={cn("max-w-[85%] space-y-2", isUser && "items-end flex flex-col")}>
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 text-xs leading-relaxed",
                          isUser
                            ? "bg-[#EAB308] text-black font-medium rounded-tr-sm"
                            : "bg-secondary/70 border border-border text-foreground rounded-tl-sm whitespace-pre-wrap"
                        )}
                      >
                        {msg.content}
                      </div>

                      {/* Source Citations */}
                      {!isUser && msg.sources && msg.sources.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {msg.sources.map((src, sIdx) => (
                            <SourceReference
                              key={sIdx}
                              pageNumber={src.pageNumber || 1}
                              section={src.section || "Relevant Section"}
                              text={src.text}
                              score={src.score}
                              compact
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}

            {sendingChat && (
              <div className="flex gap-3">
                <div className="h-7 w-7 rounded-lg bg-[#EAB308]/20 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-[#EAB308]" />
                </div>
                <div className="bg-secondary/70 border border-border rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#EAB308]" />
                  Searching document & constructing grounded answer...
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-border bg-secondary/30 shrink-0">
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5 focus-within:border-[#EAB308]/50">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSendChat()
                  }
                }}
                placeholder="Ask any question about this document..."
                disabled={sendingChat}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
              />
              <Button
                size="sm"
                onClick={() => handleSendChat()}
                disabled={!chatInput.trim() || sendingChat}
                className="h-7 w-7 p-0 bg-[#EAB308] text-black hover:bg-[#EAB308]/90 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: MCQs (Multiple Choice Practice)
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === "mcqs" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Number of Questions</span>
                <div className="flex items-center gap-1.5">
                  {[5, 10, 15, 20].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMcqConfig((prev) => ({ ...prev, count: n, customCount: "" }))}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                        mcqConfig.count === n && !mcqConfig.customCount
                          ? "bg-[#EAB308] text-black border-[#EAB308]"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                  <Input
                    value={mcqConfig.customCount}
                    onChange={(e) => setMcqConfig((prev) => ({ ...prev, customCount: e.target.value }))}
                    placeholder="Custom"
                    className="h-8 w-20 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Difficulty</span>
                <select
                  value={mcqConfig.difficulty}
                  onChange={(e) => setMcqConfig((prev) => ({ ...prev, difficulty: e.target.value as any }))}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Topics</span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={mcqConfig.topicMode}
                    onChange={(e) => setMcqConfig((prev) => ({ ...prev, topicMode: e.target.value as any }))}
                    className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                  >
                    <option value="entire">Entire Document</option>
                    <option value="important">Important Topics</option>
                    <option value="specific">Select Topic</option>
                  </select>
                  {mcqConfig.topicMode === "specific" && (
                    <select
                      value={mcqConfig.selectedTopic}
                      onChange={(e) => setMcqConfig((prev) => ({ ...prev, selectedTopic: e.target.value }))}
                      className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground max-w-[180px]"
                    >
                      <option value="">Choose topic</option>
                      {topicOptions().map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <Button
                onClick={handleGenerateMcqs}
                disabled={loadingMcqs || (mcqConfig.topicMode === "specific" && !mcqConfig.selectedTopic)}
                className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold text-xs h-8 rounded-lg self-end"
              >
                {loadingMcqs ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Generate MCQs
              </Button>
            </div>
            {generationError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">{generationError}</div>
            )}
            {generationWarning && !generationError && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">{generationWarning}</div>
            )}
          </div>

          {loadingMcqs ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#EAB308]" />
              <p>Generating grounded MCQs from document...</p>
            </div>
          ) : mcqs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground bg-card border border-border rounded-2xl">
              No MCQs available. Click above to generate questions.
            </div>
          ) : (
            <div className="space-y-4">
              {mcqs.map((q, idx) => {
                const selected = selectedOptions[idx]
                const isAnswered = selected !== undefined
                const isCorrect = isAnswered && selected === q.correctAnswer

                return (
                  <div key={q.id || idx} className="rounded-2xl border border-border bg-card p-5 space-y-3.5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="h-6 w-6 rounded-lg bg-secondary text-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <h3 className="text-xs font-semibold text-foreground leading-relaxed">
                            {q.question}
                          </h3>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {q.topic || "General"}{q.difficulty ? ` · ${q.difficulty}` : ""}{q.section ? ` · ${q.section}` : ""}
                          </p>
                        </div>
                      </div>
                      <SourceReference pageNumber={q.pageNumber || 1} compact />
                    </div>

                    {/* 4 Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options?.map((opt, optIdx) => {
                        const optLetter = ["A", "B", "C", "D"][optIdx]
                        const isThisSelected = selected === optIdx
                        const isThisCorrect = optIdx === q.correctAnswer

                        let btnCls = "border-border bg-secondary/40 text-foreground hover:bg-accent"
                        if (isAnswered) {
                          if (isThisCorrect) {
                            btnCls = "border-emerald-500 bg-emerald-500/10 text-emerald-500 font-semibold"
                          } else if (isThisSelected) {
                            btnCls = "border-red-500 bg-red-500/10 text-red-500 font-semibold"
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            onClick={() => {
                              setSelectedOptions((prev) => ({ ...prev, [idx]: optIdx }))
                              setRevealedExplanations((prev) => ({ ...prev, [idx]: true }))
                            }}
                            className={cn(
                              "flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs transition-all",
                              btnCls
                            )}
                          >
                            <span className="h-5 w-5 rounded-md bg-card border border-border flex items-center justify-center text-[10px] font-bold shrink-0">
                              {optLetter}
                            </span>
                            <span className="flex-1">{opt}</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Explanation Reveal */}
                    {revealedExplanations[idx] && (
                      <div
                        className={cn(
                          "p-3 rounded-xl border text-xs leading-relaxed mt-2",
                          isCorrect
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-secondary border-border text-foreground"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1 font-semibold">
                          <span>{isCorrect ? "✓ Correct!" : "Explanation"}</span>
                          <span className="text-[10px] text-muted-foreground">Source: Page {q.pageNumber || 1}</span>
                        </div>
                        <p className="text-[11.5px] leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 6: DESCRIPTIVE QUESTIONS (with AI Answer Evaluation)
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === "descriptive" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Number of Questions</span>
                <div className="flex items-center gap-1.5">
                  {[5, 10, 15, 20].map((n) => (
                    <button
                      key={n}
                      onClick={() => setDescConfig((prev) => ({ ...prev, count: n, customCount: "" }))}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                        descConfig.count === n && !descConfig.customCount
                          ? "bg-[#EAB308] text-black border-[#EAB308]"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                  <Input
                    value={descConfig.customCount}
                    onChange={(e) => setDescConfig((prev) => ({ ...prev, customCount: e.target.value }))}
                    placeholder="Custom"
                    className="h-8 w-20 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Difficulty</span>
                <select
                  value={descConfig.difficulty}
                  onChange={(e) => setDescConfig((prev) => ({ ...prev, difficulty: e.target.value as any }))}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Question Type</span>
                <select
                  value={descConfig.subtype}
                  onChange={(e) => setDescConfig((prev) => ({ ...prev, subtype: e.target.value as any }))}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="mixed">Mixed</option>
                  <option value="shortAnswer">Short Answer</option>
                  <option value="longAnswer">Long Answer</option>
                  <option value="conceptual">Conceptual</option>
                  <option value="analytical">Analytical</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Topics</span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={descConfig.topicMode}
                    onChange={(e) => setDescConfig((prev) => ({ ...prev, topicMode: e.target.value as any }))}
                    className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                  >
                    <option value="entire">Entire Document</option>
                    <option value="important">Important Topics</option>
                    <option value="specific">Select Topic</option>
                  </select>
                  {descConfig.topicMode === "specific" && (
                    <select
                      value={descConfig.selectedTopic}
                      onChange={(e) => setDescConfig((prev) => ({ ...prev, selectedTopic: e.target.value }))}
                      className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground max-w-[180px]"
                    >
                      <option value="">Choose topic</option>
                      {topicOptions().map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <Button
                onClick={handleGenerateDescriptive}
                disabled={loadingDescriptive || (descConfig.topicMode === "specific" && !descConfig.selectedTopic)}
                className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold text-xs h-8 rounded-lg self-end"
              >
                {loadingDescriptive ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Generate Questions
              </Button>
            </div>
            {generationError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">{generationError}</div>
            )}
            {generationWarning && !generationError && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">{generationWarning}</div>
            )}
          </div>

          {loadingDescriptive ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#EAB308]" />
              <p>Generating descriptive questions...</p>
            </div>
          ) : descriptiveQs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground bg-card border border-border rounded-2xl">
              No descriptive questions available. Click above to generate questions.
            </div>
          ) : (
            <div className="space-y-5">
              {descriptiveQs.map((q, idx) => {
                const evalData = evaluations[idx]
                const isEvaluating = evaluatingIndex === idx

                return (
                  <div key={q.id || idx} className="rounded-2xl border border-border bg-card p-5 space-y-3.5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="h-6 w-6 rounded-lg bg-secondary text-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <h3 className="text-xs font-semibold text-foreground leading-relaxed">
                            {q.question}
                          </h3>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Topic: {q.topic || "General"} · Page {q.pageNumber || 1}
                            {q.subtype && q.subtype !== "mcq" ? ` · ${q.subtype}` : ""}
                            {q.estimatedAnswerLength ? ` · ${q.estimatedAnswerLength}` : ""}
                            {q.difficulty ? ` · ${q.difficulty}` : ""}
                          </p>
                        </div>
                      </div>
                      <SourceReference pageNumber={q.pageNumber || 1} compact />
                    </div>

                    {/* Key Points expected */}
                    {q.keyPoints && q.keyPoints.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/50 text-[11px] space-y-1">
                        <span className="font-semibold text-foreground">Target Key Concepts:</span>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {q.keyPoints.map((kp, kIdx) => (
                            <span key={kIdx} className="px-2 py-0.5 rounded-md bg-accent text-muted-foreground">
                              • {kp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Answer Input */}
                    <div className="space-y-2">
                      <Textarea
                        rows={3}
                        value={userDescriptiveAnswers[idx] || ""}
                        onChange={(e) =>
                          setUserDescriptiveAnswers((prev) => ({ ...prev, [idx]: e.target.value }))
                        }
                        placeholder="Write your explanation here..."
                        className="text-xs leading-relaxed bg-background"
                      />

                      <div className="flex items-center justify-between">
                        <Button
                          size="sm"
                          onClick={() => handleEvaluateDescriptive(idx, q)}
                          disabled={isEvaluating || !userDescriptiveAnswers[idx]?.trim()}
                          className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold text-xs h-8 rounded-lg"
                        >
                          {isEvaluating ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              Evaluating with AI...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                              Evaluate Answer
                            </>
                          )}
                        </Button>

                        <button
                          onClick={() =>
                            setRevealedExpected((prev) => ({ ...prev, [idx]: !prev[idx] }))
                          }
                          className="text-[11px] text-[#EAB308] hover:underline"
                        >
                          {revealedExpected[idx] ? "Hide Expected Answer" : "Reveal Expected Answer"}
                        </button>
                      </div>
                    </div>

                    {/* AI Evaluation Result Card */}
                    {evalData && (
                      <div className="p-4 rounded-xl border border-border bg-secondary/50 space-y-2.5 mt-2">
                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                          <span className="text-xs font-bold text-foreground">AI Evaluation Result</span>
                          <div className="flex items-center gap-2">
                            {evalData.accuracy !== undefined && (
                              <span className="text-[11px] text-muted-foreground">Accuracy {evalData.accuracy}%</span>
                            )}
                            <span
                              className={cn(
                                "text-xs font-bold px-2 py-0.5 rounded-full border",
                                evalData.score >= 70
                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              )}
                            >
                              Score: {evalData.score}/100
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{evalData.feedback}</p>

                        {evalData.coveredPoints && evalData.coveredPoints.length > 0 && (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            <strong>Covered:</strong> {evalData.coveredPoints.join(", ")}
                          </div>
                        )}

                        {evalData.missingKeyPoints && evalData.missingKeyPoints.length > 0 && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400">
                            <strong>Missing Points:</strong> {evalData.missingKeyPoints.join(", ")}
                          </div>
                        )}

                        {evalData.incorrectStatements && evalData.incorrectStatements.length > 0 && (
                          <div className="text-[11px] text-red-500">
                            <strong>Incorrect Statements:</strong> {evalData.incorrectStatements.join(", ")}
                          </div>
                        )}

                        {(evalData.suggestions || evalData.suggestedImprovements) && (
                          <p className="text-[11px] text-muted-foreground italic">
                            Improvement tip: {evalData.suggestions || evalData.suggestedImprovements}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Expected Answer Collapsible */}
                    {revealedExpected[idx] && (
                      <div className="p-3.5 rounded-xl border border-border/60 bg-accent/30 text-xs text-foreground space-y-1">
                        <span className="font-semibold block text-[11px] text-[#EAB308]">
                          Expected Answer Reference:
                        </span>
                        <p className="text-muted-foreground leading-relaxed">
                          {q.expectedAnswer || q.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 7: QUIZ HISTORY FOR THIS DOCUMENT
      ─────────────────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Document Quiz Attempts
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Past performance and question evaluations recorded for this document.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/dashboard/quizzes?documentId=${doc._id}`)}
              className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold h-8 text-xs rounded-lg"
            >
              Take a New Quiz
            </Button>
          </div>

          {loadingHistory ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#EAB308]" />
              <p>Loading attempt history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted-foreground bg-card border border-border rounded-2xl space-y-2">
              <Brain className="h-7 w-7 text-muted-foreground/40 mx-auto" />
              <p>No quizzes attempted for this document yet.</p>
              <Button
                size="sm"
                onClick={() => router.push(`/dashboard/quizzes?documentId=${doc._id}`)}
                className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold text-xs h-8"
              >
                Generate First Quiz
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((att) => {
                const quiz = typeof att.quiz === "object" ? att.quiz : null
                const attemptId = att._id || att.id || ""
                const isOpen = expandedHistoryId === attemptId
                return (
                  <div key={attemptId} className="rounded-xl border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => setExpandedHistoryId(isOpen ? null : attemptId)}
                      className="w-full text-left p-4 space-y-2 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-foreground truncate">
                            {quiz?.title || att.topic || "Document Quiz"}
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(att.createdAt), { addSuffix: true })} · {att.total} questions
                            {att.timeSpent ? ` · ${Math.round(att.timeSpent / 60)}m` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {quiz?.questionType || "quiz"}{quiz?.questionSubtype && quiz.questionSubtype !== "mcq" ? ` · ${quiz.questionSubtype}` : ""}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-bold px-2.5 py-1 rounded-full border",
                              att.score >= 70
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            )}
                          >
                            {att.score}%
                          </span>
                          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span>{att.correct}/{att.total} correct</span>
                        <span>·</span>
                        <span>Accuracy {att.accuracy}%</span>
                        {quiz?.selectedTopics?.length ? <><span>·</span><span>{quiz.selectedTopics.join(", ")}</span></> : null}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border p-4 space-y-3 bg-secondary/20">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Answer Review</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] border-border"
                            onClick={() => router.push(`/dashboard/quizzes?documentId=${doc._id}`)}
                          >
                            Retake Quiz
                          </Button>
                        </div>
                        <div className="space-y-3">
                          {(att.answers || []).map((ans, idx) => (
                            <div key={idx} className="p-3 rounded-xl border border-border bg-card space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold text-foreground">{ans.question}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {ans.type || "mcq"} · Page {ans.pageNumber || 1}{ans.topic ? ` · ${ans.topic}` : ""}
                                  </p>
                                </div>
                                <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", ans.correct ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20")}>
                                  {ans.correct ? "Correct" : "Review"}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground space-y-1">
                                {ans.type === "descriptive" ? (
                                  <p><span className="font-semibold text-foreground">Your answer:</span> {ans.userAnswer || "No answer"}</p>
                                ) : (
                                  <p><span className="font-semibold text-foreground">Selected:</span> {ans.selected || "No answer"}</p>
                                )}
                                {ans.score !== undefined && <p><span className="font-semibold text-foreground">Score:</span> {ans.score}/100</p>}
                                {ans.feedback && <p>{ans.feedback}</p>}
                                {ans.missingKeyPoints?.length ? <p><span className="font-semibold text-foreground">Missing:</span> {ans.missingKeyPoints.join(", ")}</p> : null}
                                {ans.incorrectStatements?.length ? <p><span className="font-semibold text-foreground">Incorrect:</span> {ans.incorrectStatements.join(", ")}</p> : null}
                                {ans.suggestions && <p className="italic">Tip: {ans.suggestions}</p>}
                                {ans.explanation && <p><span className="font-semibold text-foreground">Explanation:</span> {ans.explanation}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
