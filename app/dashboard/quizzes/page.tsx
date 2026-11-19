"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiService } from "@/lib/api"
import type { Document as DocType, Quiz, QuizAttempt, QuizQuestion } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { SourceReference } from "@/components/source-reference"
import {
  Brain,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Trophy,
  Clock,
  ChevronRight,
  ListFilter,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function QuizzesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const docParam = searchParams.get("documentId")

  const [docs, setDocs] = useState<DocType[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)

  // Quiz Generator Configuration State
  const [selectedDocId, setSelectedDocId] = useState<string>("")
  const [selectedTopic, setSelectedTopic] = useState<string>("All Topics")
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium")
  const [questionType, setQuestionType] = useState<"mcq" | "descriptive" | "mixed">("mcq")
  const [numQuestions, setNumQuestions] = useState<number>(5)
  const [generating, setGenerating] = useState(false)

  // Active Quiz State
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null)
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submissionResult, setSubmissionResult] = useState<QuizAttempt | null>(null)
  const [startTime, setStartTime] = useState<number>(0)

  useEffect(() => {
    async function loadDocs() {
      try {
        const res = await apiService.listDocuments()
        const ready = (res.documents || []).filter(
          (d) => d.status === "completed" || d.status === "ready"
        )
        setDocs(ready)
        if (ready.length > 0) {
          const preselect = docParam && ready.some((d) => d._id === docParam) ? docParam : ready[0]._id
          setSelectedDocId(preselect)
        }
      } catch (err) {
        console.error("Failed to load documents for quiz:", err)
      } finally {
        setLoadingDocs(false)
      }
    }
    loadDocs()
  }, [docParam])

  const selectedDoc = docs.find((d) => d._id === selectedDocId)

  // Generate Quiz Handler
  async function handleGenerateQuiz() {
    if (!selectedDocId) return
    setGenerating(true)
    setSubmissionResult(null)
    setAnswers({})
    setCurrentQIndex(0)

    try {
      const res = await apiService.generateQuiz({
        documentId: selectedDocId,
        topic: selectedTopic,
        difficulty,
        questionType,
        numQuestions,
      })
      setActiveQuiz(res.quiz)
      setStartTime(Date.now())
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to generate quiz.")
    } finally {
      setGenerating(false)
    }
  }

  // Submit Quiz Handler
  async function handleSubmitQuiz() {
    if (!activeQuiz) return
    setSubmitting(true)

    const timeSpent = Math.round((Date.now() - startTime) / 1000)
    const formattedAnswers = activeQuiz.questions.map((q, idx) => {
      const val = answers[idx]
      if (q.type === "mcq") {
        return typeof val === "number" ? val : -1
      }
      return val || ""
    })

    try {
      const res = await apiService.submitQuiz(activeQuiz._id || activeQuiz.id, formattedAnswers, timeSpent)
      setSubmissionResult(res.attempt)
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to submit quiz attempt.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#EAB308]">
          Assessment & Retention
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
          DocuMind Quiz Engine
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate difficulty-based multiple choice and descriptive quizzes strictly from your documents.
        </p>
      </div>

      {loadingDocs ? (
        <div className="py-20 text-center text-xs text-muted-foreground space-y-2">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#EAB308]" />
          <p>Loading documents...</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <Brain className="h-10 w-10 text-[#EAB308] mx-auto" />
          <h3 className="text-sm font-semibold text-foreground">No indexed documents found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Upload a document first to generate grounded MCQs and descriptive test questions.
          </p>
          <Button
            size="sm"
            onClick={() => router.push("/dashboard/upload")}
            className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold text-xs h-8"
          >
            Upload Document
          </Button>
        </div>
      ) : !activeQuiz && !submissionResult ? (
        /* ─── QUIZ CONFIGURATION FORM ─── */
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-2.5 pb-4 border-b border-border/60">
            <div className="h-8 w-8 rounded-lg bg-[#EAB308]/15 flex items-center justify-center">
              <Brain className="h-4.5 w-4.5 text-[#EAB308]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Configure Your Quiz</h2>
              <p className="text-xs text-muted-foreground">Customize difficulty, topic focus, and question types.</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* Document Select */}
            <div>
              <label className="font-semibold text-foreground block mb-1.5">Select Document</label>
              <select
                value={selectedDocId}
                onChange={(e) => {
                  setSelectedDocId(e.target.value)
                  setSelectedTopic("All Topics")
                }}
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-[#EAB308]"
              >
                {docs.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.title} ({d.pageCount} pages · {d.fileType.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Topic Select */}
            {selectedDoc?.topics && selectedDoc.topics.length > 0 && (
              <div>
                <label className="font-semibold text-foreground block mb-1.5">Topic Focus</label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-[#EAB308]"
                >
                  <option value="All Topics">All Document Topics</option>
                  {selectedDoc.topics.map((t, i) => (
                    <option key={i} value={t.name}>
                      {t.name} (Page {t.pageNumber || 1})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Difficulty Level: Easy, Medium, Hard */}
            <div>
              <label className="font-semibold text-foreground block mb-1.5">Difficulty Level</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "easy", label: "Easy", desc: "Definitions & factual recall" },
                  { key: "medium", label: "Medium", desc: "Conceptual & comparisons" },
                  { key: "hard", label: "Hard", desc: "Analytical multi-step reasoning" },
                ].map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDifficulty(d.key as any)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      difficulty === d.key
                        ? "border-[#EAB308] bg-[#EAB308]/10 text-foreground"
                        : "border-border bg-background hover:bg-accent text-muted-foreground"
                    )}
                  >
                    <span className="font-bold text-xs block text-foreground">{d.label}</span>
                    <span className="text-[10px] text-muted-foreground">{d.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Question Type: MCQ, Descriptive, Mixed */}
            <div>
              <label className="font-semibold text-foreground block mb-1.5">Question Type</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "mcq", label: "MCQ Only", desc: "4 options with 1 correct answer" },
                  { key: "descriptive", label: "Descriptive", desc: "Open-ended with AI evaluation" },
                  { key: "mixed", label: "Mixed Format", desc: "Combination of MCQ and descriptive" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setQuestionType(t.key as any)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      questionType === t.key
                        ? "border-[#EAB308] bg-[#EAB308]/10 text-foreground"
                        : "border-border bg-background hover:bg-accent text-muted-foreground"
                    )}
                  >
                    <span className="font-bold text-xs block text-foreground">{t.label}</span>
                    <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Number of Questions */}
            <div>
              <label className="font-semibold text-foreground block mb-1.5">
                Number of Questions ({numQuestions})
              </label>
              <div className="flex gap-2">
                {[3, 5, 8, 10].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setNumQuestions(count)}
                    className={cn(
                      "px-4 py-2 rounded-xl border text-xs font-semibold transition-all",
                      numQuestions === count
                        ? "bg-[#EAB308] text-black border-[#EAB308]"
                        : "bg-background border-border text-foreground hover:bg-accent"
                    )}
                  >
                    {count} Questions
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerateQuiz}
            disabled={generating}
            className="w-full bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-bold h-11 rounded-xl shadow-sm text-xs"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Grounded Questions from Document...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Start Generated Quiz
              </>
            )}
          </Button>
        </div>
      ) : activeQuiz && !submissionResult ? (
        /* ─── INTERACTIVE QUIZ SESSION ─── */
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Quiz Session Top Bar */}
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <span className="text-[10.5px] uppercase font-bold text-[#EAB308]">
                {activeQuiz.difficulty} Difficulty · {activeQuiz.topic}
              </span>
              <h2 className="text-sm font-bold text-foreground">{activeQuiz.title}</h2>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-foreground">
                Question {currentQIndex + 1} of {activeQuiz.questions.length}
              </span>
              <Progress
                value={((currentQIndex + 1) / activeQuiz.questions.length) * 100}
                className="w-28 h-1.5 mt-1"
              />
            </div>
          </div>

          {/* Current Question Body */}
          {(() => {
            const q = activeQuiz.questions[currentQIndex]
            if (!q) return null

            return (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="h-6 w-6 rounded-lg bg-[#EAB308]/15 text-[#EAB308] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {currentQIndex + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground leading-relaxed">
                      {q.question}
                    </h3>
                  </div>
                  <SourceReference pageNumber={q.pageNumber || 1} compact />
                </div>

                {/* MCQ Options */}
                {q.type === "mcq" ? (
                  <div className="space-y-2 pt-2">
                    {q.options?.map((opt, optIdx) => {
                      const optLetter = ["A", "B", "C", "D"][optIdx]
                      const isSelected = answers[currentQIndex] === optIdx

                      return (
                        <button
                          key={optIdx}
                          onClick={() => setAnswers((prev) => ({ ...prev, [currentQIndex]: optIdx }))}
                          className={cn(
                            "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left text-xs transition-all",
                            isSelected
                              ? "border-[#EAB308] bg-[#EAB308]/10 text-foreground font-semibold"
                              : "border-border bg-background hover:bg-accent text-muted-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "h-6 w-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0",
                              isSelected
                                ? "bg-[#EAB308] text-black"
                                : "bg-secondary text-foreground border border-border"
                            )}
                          >
                            {optLetter}
                          </span>
                          <span className="flex-1">{opt}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  /* Descriptive Answer Area */
                  <div className="space-y-2 pt-2">
                    <Textarea
                      rows={4}
                      value={answers[currentQIndex] || ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [currentQIndex]: e.target.value }))
                      }
                      placeholder="Type your explanation or analytical response here..."
                      className="text-xs leading-relaxed bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Target concepts discussed on Page {q.pageNumber || 1}. Answer will be evaluated by AI.
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Navigation & Submit Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentQIndex === 0}
              className="text-xs h-9 border-border"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              {currentQIndex < activeQuiz.questions.length - 1 ? (
                <Button
                  size="sm"
                  onClick={() => setCurrentQIndex((prev) => prev + 1)}
                  className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold text-xs h-9"
                >
                  Next Question
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSubmitQuiz}
                  disabled={submitting}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs h-9 px-5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Evaluating Answers...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      Submit Quiz
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ─── QUIZ RESULTS & DETAILED REVIEW ─── */
        submissionResult && (
          <div className="space-y-6">
            {/* Score Banner */}
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 text-center space-y-4 shadow-sm">
              <div className="h-14 w-14 rounded-2xl bg-[#EAB308]/15 flex items-center justify-center mx-auto">
                <Trophy className="h-7 w-7 text-[#EAB308]" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                  Quiz Assessment Completed
                </span>
                <h2 className="text-3xl font-extrabold text-foreground mt-0.5">
                  Score: {submissionResult.score}%
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  You answered {submissionResult.correct} out of {submissionResult.total} questions correctly ({submissionResult.accuracy}% accuracy).
                </p>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setActiveQuiz(null)
                    setSubmissionResult(null)
                  }}
                  className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-bold text-xs h-9 px-5 rounded-xl"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Take Another Quiz
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/dashboard/analytics")}
                  className="text-xs h-9 px-4 rounded-xl border-border"
                >
                  View Performance Analytics
                </Button>
              </div>
            </div>

            {/* Answer-by-Answer Detailed Review */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground">Detailed Question Review</h3>

              {submissionResult.answers?.map((ans, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="h-6 w-6 rounded-lg bg-secondary text-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="text-xs font-semibold text-foreground leading-relaxed">
                          {ans.question}
                        </h4>
                        <span
                          className={cn(
                            "inline-block text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full border",
                            ans.correct
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-red-500/10 text-red-500 border-red-500/20"
                          )}
                        >
                          {ans.type === "descriptive"
                            ? `Descriptive Score: ${ans.score}/100`
                            : ans.correct
                            ? "✓ Correct"
                            : "✗ Incorrect"}
                        </span>
                      </div>
                    </div>

                    <SourceReference pageNumber={ans.pageNumber || 1} compact />
                  </div>

                  {ans.type === "mcq" ? (
                    <div className="p-3 rounded-xl bg-secondary/40 border border-border text-xs space-y-1">
                      <p className="text-muted-foreground">
                        Your answer: <strong className="text-foreground">{ans.selected}</strong>
                      </p>
                      <p className="text-[11.5px] text-muted-foreground leading-relaxed pt-1">
                        <strong>Explanation:</strong> {ans.explanation}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-secondary/40 border border-border text-xs space-y-2">
                      <p className="text-muted-foreground">
                        Your response: <span className="text-foreground italic">{ans.userAnswer || "No answer provided"}</span>
                      </p>
                      {ans.feedback && (
                        <p className="text-[11.5px] text-foreground leading-relaxed">
                          <strong>AI Feedback:</strong> {ans.feedback}
                        </p>
                      )}
                      {ans.missingKeyPoints && ans.missingKeyPoints.length > 0 && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          <strong>Missing Points:</strong> {ans.missingKeyPoints.join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
