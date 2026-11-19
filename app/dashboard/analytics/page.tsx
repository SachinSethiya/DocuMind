"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import type { AnalyticsOverview } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  LineChart as LineChartIcon,
  TrendingUp,
  Brain,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Trophy,
  Loader2,
  Clock,
  ArrowRight,
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

const DIFFICULTY_COLORS = {
  easy: "#10B981",    // emerald
  medium: "#EAB308",  // amber
  hard: "#EF4444",    // red
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await apiService.getUserAnalytics()
        setData(res)
      } catch (err) {
        console.error("Failed to load user analytics:", err)
      } finally {
        setLoading(false)
      }
    }
    loadAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-muted-foreground space-y-2">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#EAB308]" />
        <p>Loading learning analytics...</p>
      </div>
    )
  }

  const hasAttempts = data && data.totalQuizzesAttempted > 0

  // Chart data formatting
  const scoreHistoryData = (data?.scoreHistory || []).map((h, i) => ({
    name: `Quiz ${h.attemptNumber || i + 1}`,
    score: h.score,
    accuracy: h.accuracy,
    title: h.title,
    date: h.date ? format(new Date(h.date), "MMM d") : `Q${i + 1}`,
  }))

  const topicChartData = (data?.topicBreakdown || []).map((t) => ({
    topic: t.topic.length > 18 ? t.topic.slice(0, 15) + "..." : t.topic,
    accuracy: t.accuracy,
    attempts: t.attempts,
    avgScore: t.avgScore,
  }))

  const difficultyChartData = [
    {
      difficulty: "Easy",
      avgScore: data?.difficultyBreakdown?.easy?.avgScore || 0,
      accuracy: data?.difficultyBreakdown?.easy?.accuracy || 0,
      attempts: data?.difficultyBreakdown?.easy?.attempts || 0,
      fill: DIFFICULTY_COLORS.easy,
    },
    {
      difficulty: "Medium",
      avgScore: data?.difficultyBreakdown?.medium?.avgScore || 0,
      accuracy: data?.difficultyBreakdown?.medium?.accuracy || 0,
      attempts: data?.difficultyBreakdown?.medium?.attempts || 0,
      fill: DIFFICULTY_COLORS.medium,
    },
    {
      difficulty: "Hard",
      avgScore: data?.difficultyBreakdown?.hard?.avgScore || 0,
      accuracy: data?.difficultyBreakdown?.hard?.accuracy || 0,
      attempts: data?.difficultyBreakdown?.hard?.attempts || 0,
      fill: DIFFICULTY_COLORS.hard,
    },
  ]

  const pieData = [
    { name: "Correct Answers", value: data?.totalCorrectAnswers || 0, fill: "#10B981" },
    { name: "Incorrect Answers", value: data?.totalIncorrectAnswers || 0, fill: "#F87171" },
  ]

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#EAB308]">
            Learning Intelligence
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
            My Learning & Performance Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track concept mastery, question accuracy, difficulty distribution, and AI-driven study recommendations.
          </p>
        </div>

        <Button
          onClick={() => router.push("/dashboard/quizzes")}
          className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold h-9 px-4 text-xs rounded-xl shadow-sm self-start sm:self-auto"
        >
          <Brain className="h-4 w-4 mr-1.5" />
          Take a Quiz
        </Button>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4.5 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Overall Accuracy</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {hasAttempts ? `${data.overallAccuracy}%` : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {data?.totalCorrectAnswers || 0} / {data?.totalQuestionsAttempted || 0} correct
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4.5 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Average Quiz Score</span>
            <div className="h-7 w-7 rounded-lg bg-[#EAB308]/15 text-[#EAB308] flex items-center justify-center">
              <Trophy className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {hasAttempts ? `${data.averageScore}%` : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground">Across all difficulties</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4.5 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Quizzes</span>
            <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Brain className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {data?.totalQuizzesAttempted || 0}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {data?.totalQuestionsAttempted || 0} questions attempted
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4.5 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Indexed Documents</span>
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {data?.totalDocuments || 0}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {data?.completedDocuments || 0} analyzed & ready
          </p>
        </div>
      </div>

      {/* AI Recommendations Banner */}
      {data?.recommendations && data.recommendations.length > 0 && (
        <div className="rounded-2xl border border-[#EAB308]/30 bg-[#EAB308]/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#D97706] font-bold text-xs uppercase tracking-wider">
            <Sparkles className="h-4 w-4" />
            <span>AI Practice & Knowledge Recommendations</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {data.recommendations.map((rec, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-card border border-[#EAB308]/20 text-foreground leading-relaxed flex items-start gap-2.5"
              >
                <span className="text-[#EAB308] font-bold text-sm shrink-0">→</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasAttempts ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <Brain className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <h3 className="text-sm font-semibold text-foreground">No quiz attempts recorded yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Take your first quiz from the Quiz Generator or Document Workspace to start generating learning analytics and visualizations.
          </p>
          <Button
            size="sm"
            onClick={() => router.push("/dashboard/quizzes")}
            className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold text-xs h-8"
          >
            Launch Quiz Generator
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Row 1 Charts: Performance Trend & Topic Accuracy */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Performance Over Time */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">Quiz Score Progression</h3>
                  <p className="text-[11px] text-muted-foreground">Historical score trend across attempts</p>
                </div>
                <TrendingUp className="h-4 w-4 text-[#EAB308]" />
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={scoreHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EAB308" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#EAB308" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#888" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderColor: "#27272a",
                        borderRadius: "12px",
                        fontSize: "11px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#EAB308"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#scoreGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Accuracy by Topic */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">Topic Accuracy & Mastery</h3>
                  <p className="text-[11px] text-muted-foreground">Accuracy percentage across studied document topics</p>
                </div>
                <Brain className="h-4 w-4 text-purple-400" />
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topicChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="topic" tick={{ fontSize: 10, fill: "#888" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#888" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderColor: "#27272a",
                        borderRadius: "12px",
                        fontSize: "11px",
                      }}
                    />
                    <Bar dataKey="accuracy" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2 Charts: Difficulty Breakdown & Question Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 3: Difficulty Breakdown (2 Cols) */}
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">Performance by Difficulty Level</h3>
                  <p className="text-[11px] text-muted-foreground">Easy vs. Medium vs. Hard accuracy and volume</p>
                </div>
                <Trophy className="h-4 w-4 text-emerald-400" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {difficultyChartData.map((d) => (
                  <div key={d.difficulty} className="p-3.5 rounded-xl border border-border bg-secondary/30 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {d.difficulty}
                    </span>
                    <div className="text-lg font-extrabold text-foreground">{d.accuracy}%</div>
                    <p className="text-[11px] text-muted-foreground">{d.attempts} attempts recorded</p>
                  </div>
                ))}
              </div>

              <div className="h-48 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={difficultyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="difficulty" tick={{ fontSize: 10, fill: "#888" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#888" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderColor: "#27272a",
                        borderRadius: "12px",
                        fontSize: "11px",
                      }}
                    />
                    <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                      {difficultyChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Question Distribution Donut (1 Col) */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-foreground">Answer Accuracy Ratio</h3>
                <p className="text-[11px] text-muted-foreground">Correct vs. incorrect questions</p>
              </div>

              <div className="h-52 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderColor: "#27272a",
                        borderRadius: "12px",
                        fontSize: "11px",
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-xs font-bold text-foreground">Recent Quiz Activity</h3>
            <div className="divide-y divide-border/60 text-xs">
              {data.recentActivity.map((act) => (
                <div key={act.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-foreground">{act.documentTitle}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Topic: {act.topic} · <span className="capitalize">{act.difficulty}</span> difficulty
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${
                        act.score >= 70
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      }`}
                    >
                      {act.score}%
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(act.completedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
