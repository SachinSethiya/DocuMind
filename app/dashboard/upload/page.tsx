"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import type { Document as DocType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  UploadCloud,
  FileText,
  FileType,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function UploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [error, setError] = useState("")
  const [createdDoc, setCreatedDoc] = useState<DocType | null>(null)
  const [docStatus, setDocStatus] = useState<string>("")
  const inputRef = useRef<HTMLInputElement>(null)

  function validateAndSelect(f: File) {
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase()
    const allowed = [".pdf", ".docx", ".doc"]
    if (!allowed.includes(ext)) {
      setError(`Unsupported file format '${ext}'. DocuMind supports PDF (.pdf) and Word (.docx) documents only.`)
      return
    }

    if (f.size > 50 * 1024 * 1024) {
      setError("File exceeds the maximum limit of 50 MB.")
      return
    }

    setError("")
    setFile(f)
    setTitle(f.name.replace(/\.[^/.]+$/, ""))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) validateAndSelect(droppedFile)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError("")
    setUploadPct(10)

    try {
      const res = await apiService.uploadDocument(file, title.trim() || file.name, (pct) => {
        setUploadPct(pct)
      })

      const doc = res.document
      setCreatedDoc(doc)
      setDocStatus(doc.status || "processing")

      // Poll status for a smooth user experience
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await apiService.getDocumentStatus(doc._id)
          setDocStatus(statusRes.status)
          if (statusRes.status === "completed" || statusRes.status === "ready" || statusRes.status === "failed") {
            clearInterval(pollInterval)
          }
        } catch {
          // ignore transient poll error
        }
      }, 2500)
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to upload document. Please check the file and try again.")
      setUploading(false)
    }
  }

  function resetForm() {
    setFile(null)
    setTitle("")
    setError("")
    setCreatedDoc(null)
    setUploading(false)
    setUploadPct(0)
    setDocStatus("")
  }

  const isDocx = file?.name.toLowerCase().endsWith(".docx") || file?.name.toLowerCase().endsWith(".doc")

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#EAB308]">
          Document Ingestion
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
          Upload Document
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload any PDF or Word (.docx) document to automatically analyze structure, extract topics, generate summaries, and enable AI Q&A.
        </p>
      </div>

      {createdDoc ? (
        /* Post-Upload Progress / Success Card */
        <div className="rounded-2xl border border-border bg-card p-7 space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#EAB308]/15 flex items-center justify-center">
              {docStatus === "completed" || docStatus === "ready" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <Loader2 className="h-5 w-5 text-[#EAB308] animate-spin" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{createdDoc.title}</h2>
              <p className="text-xs text-muted-foreground">
                {createdDoc.fileName} · {formatBytes(createdDoc.fileSize)}
              </p>
            </div>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-secondary/50 border border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Processing Pipeline:</span>
              <span className="font-semibold capitalize text-foreground flex items-center gap-1.5">
                {docStatus === "completed" || docStatus === "ready" ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Analysis Completed
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    {docStatus === "analyzing" ? "Extracting Topics & Summaries..." : "Parsing Document Text & Embeddings..."}
                  </>
                )}
              </span>
            </div>
            <Progress
              value={
                docStatus === "completed" || docStatus === "ready"
                  ? 100
                  : docStatus === "analyzing"
                  ? 75
                  : 45
              }
              className="h-2"
            />
            <p className="text-[11px] text-muted-foreground/80 pt-1">
              {docStatus === "completed" || docStatus === "ready"
                ? "Document is fully processed. Vectors, keywords, summaries, and topics are ready."
                : "Background AI jobs are running. You can navigate away at any time without interrupting the process."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={() => router.push(`/dashboard/documents/${createdDoc._id}`)}
              className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold h-10 px-5 rounded-xl shadow-sm"
            >
              Open Document Workspace
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={resetForm}
              className="h-10 px-4 rounded-xl border-border hover:bg-accent text-xs"
            >
              Upload Another Document
            </Button>
          </div>
        </div>
      ) : (
        /* Upload Area */
        <div className="rounded-2xl border border-border bg-card p-6 space-y-6 shadow-sm">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !file && inputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-3.5 rounded-2xl border-2 border-dashed p-10 transition-all select-none cursor-pointer",
              dragging
                ? "border-[#EAB308] bg-[#EAB308]/5"
                : file
                ? "border-[#EAB308]/50 bg-[#EAB308]/5"
                : "border-border hover:border-[#EAB308]/40 hover:bg-accent/40"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.doc"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0]
                if (selected) validateAndSelect(selected)
              }}
            />

            {file ? (
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-[#EAB308]/15 flex items-center justify-center">
                  {isDocx ? (
                    <FileType className="h-6 w-6 text-[#EAB308]" />
                  ) : (
                    <FileText className="h-6 w-6 text-[#EAB308]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatBytes(file.size)} · {isDocx ? "Microsoft Word" : "PDF Document"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                    setTitle("")
                  }}
                  className="h-7 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Remove selected file
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground">
                  <UploadCloud className="h-6 w-6 text-[#EAB308]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Click to browse or drag and drop your document
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports PDF (.pdf) and Word (.docx) documents up to 50 MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {file && (
            <div className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Document Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a custom title (optional)"
                  className="bg-background"
                />
              </div>

              {uploading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Uploading document...</span>
                    <span>{uploadPct}%</span>
                  </div>
                  <Progress value={uploadPct} className="h-1.5" />
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold h-10 rounded-xl"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading & Ingesting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Upload & Start AI Analysis
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Feature Highlights Footer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#EAB308] shrink-0" />
              <span>Isolated User Storage</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#EAB308] shrink-0" />
              <span>Automatic Chapter Summary</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#EAB308] shrink-0" />
              <span>Grounded Page References</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
