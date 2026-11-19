"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import type { Document as DocType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { SourceReference } from "@/components/source-reference"
import {
  Sparkles,
  FileText,
  Tag,
  BookOpen,
  Layers,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Bookmark,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function AIAnalysisPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<DocType[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDocs() {
      try {
        const res = await apiService.listDocuments()
        const completed = (res.documents || []).filter(
          (d) => d.status === "completed" || d.status === "ready"
        )
        setDocs(completed)
        if (completed.length > 0) {
          // Fetch full doc details for first one
          setSelectedDocId(completed[0]._id)
        }
      } catch (err) {
        console.error("Failed to load analyzed documents:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchDocs()
  }, [])

  const selectedDoc = docs.find((d) => d._id === selectedDocId)

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#EAB308]">
            Automated Intelligence
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
            AI Document Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Explore deep structural insights, core concepts, extracted keywords, and verified definitions across your documents.
          </p>
        </div>

        {selectedDoc && (
          <Button
            size="sm"
            onClick={() => router.push(`/dashboard/documents/${selectedDoc._id}`)}
            className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold h-9 px-4 text-xs rounded-xl shadow-sm self-start sm:self-auto"
          >
            Open in Workspace
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-muted-foreground space-y-2">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#EAB308]" />
          <p>Loading document analyses...</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto text-[#EAB308]">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">No analyzed documents yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Upload a PDF or Word document to trigger automatic analysis, keyword extraction, and structural breakdown.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push("/dashboard/upload")}
            className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold text-xs h-8"
          >
            Upload Document
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Document Picker Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 bg-card border border-border p-2 rounded-2xl">
            {docs.map((d) => (
              <button
                key={d._id}
                onClick={() => setSelectedDocId(d._id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                  selectedDocId === d._id
                    ? "bg-[#EAB308] text-black shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="truncate max-w-[160px]">{d.title}</span>
              </button>
            ))}
          </div>

          {selectedDoc && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Overview & Topics */}
              <div className="lg:col-span-2 space-y-6">
                {/* Executive Summary */}
                <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                    Executive Overview
                  </span>
                  <p className="text-sm text-foreground leading-relaxed">
                    {selectedDoc.analysis?.overview ||
                      selectedDoc.summary?.overview ||
                      selectedDoc.summary?.detailedSummary ||
                      "Full executive analysis completed."}
                  </p>
                </div>

                {/* Topics Explorer */}
                <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                    Extracted Topics & Knowledge Structure
                  </span>

                  {selectedDoc.topics && selectedDoc.topics.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {selectedDoc.topics.map((t, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-xl border border-border bg-secondary/30 space-y-2 hover:border-[#EAB308]/40 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-foreground">{t.name}</h4>
                            <SourceReference pageNumber={t.pageNumber || 1} compact />
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {t.explanation}
                          </p>
                          {t.subtopics && t.subtopics.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {t.subtopics.map((st, j) => (
                                <span
                                  key={j}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-accent text-muted-foreground"
                                >
                                  {st}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Topics parsed.</p>
                  )}
                </div>

                {/* Important Definitions */}
                {selectedDoc.analysis?.definitions && selectedDoc.analysis.definitions.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#EAB308]">
                      Key Definitions & Terminology
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedDoc.analysis.definitions.map((d, i) => (
                        <div key={i} className="p-3.5 rounded-xl border border-border bg-secondary/30 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">{d.term}</span>
                            <SourceReference pageNumber={d.pageNumber || 1} compact />
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{d.definition}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Keywords & Key Points */}
              <div className="space-y-6">
                {/* Keywords Tag Cloud */}
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Keyword Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedDoc.keywords && selectedDoc.keywords.length > 0 ? (
                      selectedDoc.keywords.map((k, i) => (
                        <span
                          key={i}
                          className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-secondary border border-border text-foreground"
                        >
                          #{k}
                        </span>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">Keywords indexed.</p>
                    )}
                  </div>
                </div>

                {/* Key Points */}
                {selectedDoc.analysis?.keyPoints && selectedDoc.analysis.keyPoints.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Important Takeaways
                    </span>
                    <ul className="space-y-2 text-xs">
                      {selectedDoc.analysis.keyPoints.map((kp, i) => (
                        <li key={i} className="flex items-start gap-2 text-foreground">
                          <span className="text-[#EAB308] font-bold">✓</span>
                          <span>{kp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Verified Facts */}
                {selectedDoc.analysis?.importantFacts && selectedDoc.analysis.importantFacts.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Document Facts
                    </span>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {selectedDoc.analysis.importantFacts.map((fact, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-secondary/50 border border-border/40 text-foreground">
                          {fact}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
