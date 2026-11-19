"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { apiService } from "@/lib/api"
import type { Document as DocType, AnalyticsOverview } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  UploadCloud,
  Brain,
  MessageSquareText,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
  FileCheck2,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

function formatBytes(bytes: number) {
  if (!bytes) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function StatusBadge({ status }: { status: DocType["status"] }) {
  if (status === "completed" || status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </span>
    )
  }
  if (status === "processing" || status === "analyzing" || status === "uploading") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
        <Loader2 className="h-3 w-3 animate-spin" />
        {status === "analyzing" ? "Analyzing" : "Processing"}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
      <AlertCircle className="h-3 w-3" />
      Failed
    </span>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAppStore()
  const [docs, setDocs] = useState<DocType[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [docsRes, analyticsRes] = await Promise.allSettled([
          apiService.listDocuments(),
          apiService.getUserAnalytics(),
        ])
        if (docsRes.status === "fulfilled") {
          setDocs(docsRes.value.documents || [])
        }
        if (analyticsRes.status === "fulfilled") {
          setAnalytics(analyticsRes.value)
        }
      } catch (err) {
        console.error("Dashboard data load error:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (!user) return null

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const totalDocs = analytics?.totalDocuments ?? docs.length
  const completedDocs = analytics?.completedDocuments ?? docs.filter((d) => d.status === "completed" || d.status === "ready").length
  const totalQuizzes = analytics?.totalQuizzesAttempted ?? 0
  const avgScore = analytics?.averageScore ?? 0

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header & Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[#EAB308]">
            {greeting}, {user.name}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-0.5">
            DocuMind Intelligence Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Interact with your documents, generate quizzes, and monitor learning retention.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            onClick={() => router.push("/dashboard/upload")}
            className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold h-9 px-4 text-xs rounded-xl shadow-sm"
          >
            <UploadCloud className="h-4 w-4 mr-1.5" />
            Upload Document
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/chat")}
            className="h-9 px-3.5 text-xs rounded-xl border-border hover:bg-accent"
          >
            <MessageSquareText className="h-4 w-4 mr-1.5 text-[#EAB308]" />
            Ask AI
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4.5 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Documents</span>
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">{totalDocs}</div>
          <p className="text-[11px] text-muted-foreground">{completedDocs} processed & indexed</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4.5 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Processed Status</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <FileCheck2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {totalDocs > 0 ? `${Math.round((completedDocs / totalDocs) * 100)}%` : "0%"}
          </div>
          <p className="text-[11px] text-muted-foreground">Ready for AI interaction</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4.5 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Quizzes Completed</span>
            <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Brain className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">{totalQuizzes}</div>
          <p className="text-[11px] text-muted-foreground">
            {analytics?.totalQuestionsAttempted ?? 0} questions attempted
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4.5 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Average Quiz Score</span>
            <div className="h-7 w-7 rounded-lg bg-[#EAB308]/15 text-[#EAB308] flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {totalQuizzes > 0 ? `${avgScore}%` : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground">Overall learning accuracy</p>
        </div>
      </div>

      {/* AI Recommendation Alert if weak topics exist */}
      {analytics?.recommendations && analytics.recommendations.length > 0 && (
        <div className="rounded-2xl border border-[#EAB308]/30 bg-[#EAB308]/5 p-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-[#EAB308] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#D97706]">
              DocuMind Study Recommendation
            </h4>
            <p className="text-xs text-foreground/90 leading-relaxed">
              {analytics.recommendations[0]}
            </p>
          </div>
        </div>
      )}

      {/* Main Content Split: Recent Documents & Recent Quizzes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Documents (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#EAB308]" />
              Recent Documents
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/documents")}
              className="text-xs text-[#EAB308] hover:bg-[#EAB308]/10 h-8"
            >
              View all ({docs.length})
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-[#EAB308]" />
              Loading your documents...
            </div>
          ) : docs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3 bg-card/50">
              <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center mx-auto text-muted-foreground">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No documents uploaded yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload a PDF or DOCX file to experience AI summaries, Q&A, and quizzes.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => router.push("/dashboard/upload")}
                className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold text-xs h-8"
              >
                Upload your first document
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {docs.slice(0, 5).map((doc) => (
                <div
                  key={doc._id}
                  onClick={() => router.push(`/dashboard/documents/${doc._id}`)}
                  className="group flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:border-[#EAB308]/40 hover:shadow-warm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0 group-hover:bg-[#EAB308]/10 transition-colors">
                      <FileText className="h-4.5 w-4.5 text-[#EAB308]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-foreground truncate max-w-xs sm:max-w-md">
                        {doc.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        <span className="uppercase font-medium">{doc.fileType}</span>
                        <span>•</span>
                        <span>{formatBytes(doc.fileSize)}</span>
                        {doc.pageCount > 0 && (
                          <>
                            <span>•</span>
                            <span>{doc.pageCount} pages</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={doc.status} />
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors hidden sm:block" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Quiz Activity (1 Col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Brain className="h-4 w-4 text-[#EAB308]" />
              Recent Quizzes
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/analytics")}
              className="text-xs text-muted-foreground hover:text-foreground h-8"
            >
              Analytics
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            {!analytics?.recentActivity || analytics.recentActivity.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Brain className="h-7 w-7 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground">No quiz attempts recorded yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/dashboard/quizzes")}
                  className="text-xs h-7 border-border mt-1"
                >
                  Generate a Quiz
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {analytics.recentActivity.map((act) => (
                  <div key={act.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground truncate max-w-[180px]">
                        {act.documentTitle}
                      </p>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          act.score >= 70
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        }`}
                      >
                        {act.score}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="capitalize">{act.difficulty} difficulty</span>
                      <span>{formatDistanceToNow(new Date(act.completedAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
