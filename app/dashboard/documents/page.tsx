"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import type { Document as DocType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText,
  FileType,
  Search,
  UploadCloud,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Filter,
  Sparkles,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

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

export default function MyDocumentsPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<DocType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadDocuments = useCallback(async () => {
    try {
      const filter = statusFilter === "all" ? undefined : statusFilter
      const res = await apiService.listDocuments(search, filter)
      setDocs(res.documents || [])
    } catch (err) {
      console.error("Failed to load documents:", err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    loadDocuments()
    // Poll if any doc is in processing/analyzing state
    pollRef.current = setInterval(() => {
      setDocs((prev) => {
        const hasPending = prev.some(
          (d) => d.status === "processing" || d.status === "analyzing" || d.status === "uploading"
        )
        if (hasPending) loadDocuments()
        return prev
      })
    }, 3500)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadDocuments])

  async function handleDelete(e: React.MouseEvent, id: string, title: string) {
    e.stopPropagation()
    if (!confirm(`Are you sure you want to delete "${title}" and its associated vectors & quizzes?`)) {
      return
    }

    setDeletingId(id)
    try {
      await apiService.deleteDocument(id)
      setDocs((prev) => prev.filter((d) => d._id !== id))
    } catch (err) {
      alert("Failed to delete document.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#EAB308]">
            Document Repository
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
            My Documents
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your uploaded documents, open dedicated study workspaces, or trigger AI operations.
          </p>
        </div>

        <Button
          onClick={() => router.push("/dashboard/upload")}
          className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold h-9 px-4 text-xs rounded-xl shadow-sm self-start sm:self-auto"
        >
          <UploadCloud className="h-4 w-4 mr-1.5" />
          Upload New Document
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, filename, or keyword..."
            className="pl-9 h-9 text-xs bg-card"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl p-1 shrink-0">
          {[
            { label: "All", value: "all" },
            { label: "Completed", value: "completed" },
            { label: "Processing", value: "processing" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setStatusFilter(item.value)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                statusFilter === item.value
                  ? "bg-[#EAB308]/15 text-[#EAB308] font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document Cards List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#EAB308]" />
          <p>Loading your documents...</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center space-y-3">
          <div className="h-11 w-11 rounded-2xl bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
            <FileText className="h-5 w-5 text-[#EAB308]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">No documents found</h3>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
              {search
                ? `No documents matching "${search}". Try clearing your search filter.`
                : "Get started by uploading your first PDF or DOCX file."}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => router.push("/dashboard/upload")}
            className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold text-xs h-8 rounded-xl"
          >
            Upload Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((doc) => {
            const isDocx = doc.fileType === "docx" || doc.fileType === "doc"
            const previewSummary =
              doc.summary?.shortSummary ||
              doc.summary?.executiveSummary ||
              doc.analysis?.executiveSummary ||
              "AI summary ready in document workspace."

            return (
              <div
                key={doc._id}
                onClick={() => router.push(`/dashboard/documents/${doc._id}`)}
                className="group relative rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-[#EAB308]/40 hover:shadow-warm transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center shrink-0 group-hover:bg-[#EAB308]/15 transition-colors">
                        {isDocx ? (
                          <FileType className="h-4.5 w-4.5 text-[#EAB308]" />
                        ) : (
                          <FileText className="h-4.5 w-4.5 text-[#EAB308]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate" title={doc.title}>
                          {doc.title}
                        </h3>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {doc.fileName}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-3">
                    <span className="uppercase font-semibold px-2 py-0.5 rounded-md bg-secondary text-foreground">
                      {doc.fileType}
                    </span>
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
                        <span>{doc.chunkCount} Chunks</span>
                      </>
                    )}
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Summary preview */}
                  <div className="mt-3.5 p-3 rounded-xl bg-secondary/40 border border-border/50 text-[11.5px] text-muted-foreground line-clamp-3 leading-relaxed">
                    {previewSummary}
                  </div>

                  {/* Keywords Tags */}
                  {doc.keywords && doc.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {doc.keywords.slice(0, 4).map((k) => (
                        <span
                          key={k}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-accent text-muted-foreground border border-border"
                        >
                          #{k}
                        </span>
                      ))}
                      {doc.keywords.length > 4 && (
                        <span className="text-[10px] text-muted-foreground px-1 self-center">
                          +{doc.keywords.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => handleDelete(e, doc._id, doc.title)}
                    disabled={deletingId === doc._id}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                  >
                    {deletingId === doc._id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold rounded-lg"
                  >
                    Open Workspace
                    <ArrowRight className="h-3 w-3 ml-1.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
