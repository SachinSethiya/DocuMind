"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import type { Document as DocType, ChatMessage } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { SourceReference } from "@/components/source-reference"
import {
  MessageSquareText,
  Sparkles,
  Send,
  Loader2,
  Trash2,
  FileText,
  ArrowRight,
  ShieldAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function AskAIPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<DocType[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>("")
  const [selectedDoc, setSelectedDoc] = useState<DocType | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [clearing, setClearing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadDocs() {
      try {
        const res = await apiService.listDocuments()
        const readyDocs = (res.documents || []).filter(
          (d) => d.status === "completed" || d.status === "ready"
        )
        setDocs(readyDocs)
        if (readyDocs.length > 0) {
          setSelectedDocId(readyDocs[0]._id)
        }
      } catch (err) {
        console.error("Failed to load documents for chat:", err)
      } finally {
        setLoadingDocs(false)
      }
    }
    loadDocs()
  }, [])

  useEffect(() => {
    if (!selectedDocId) return
    async function fetchDocDetails() {
      try {
        const res = await apiService.getDocument(selectedDocId)
        setSelectedDoc(res.document)
        setMessages(res.document.chatHistory || [])
      } catch (err) {
        console.error("Failed to fetch document chat history:", err)
      }
    }
    fetchDocDetails()
  }, [selectedDocId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending])

  async function handleSend(text?: string) {
    const q = (text ?? input).trim()
    if (!q || sending || !selectedDocId) return

    setInput("")
    setSending(true)

    const userMsg: ChatMessage = { role: "user", content: q }
    setMessages((prev) => [...prev, userMsg])

    try {
      const res = await apiService.chatWithDocument(selectedDocId, q)
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.answer,
        sources: res.sources,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: err?.response?.data?.message || "Failed to retrieve grounded answer. Please try again.",
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setSending(false)
    }
  }

  async function handleClearChat() {
    if (!selectedDocId || !confirm("Clear conversation history for this document?")) return
    setClearing(true)
    try {
      await apiService.clearDocumentChat(selectedDocId)
      setMessages([])
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#EAB308]">
            Interactive Assistant
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
            Ask DocuMind AI
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ask natural-language questions grounded strictly in your selected document with verified page citations.
          </p>
        </div>

        {selectedDoc && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/dashboard/documents/${selectedDoc._id}`)}
            className="text-xs h-8 border-border self-start sm:self-auto"
          >
            Open in Workspace
            <ArrowRight className="h-3 w-3 ml-1.5" />
          </Button>
        )}
      </div>

      {loadingDocs ? (
        <div className="py-20 text-center text-xs text-muted-foreground space-y-2">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#EAB308]" />
          <p>Loading documents...</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto text-[#EAB308]">
            <MessageSquareText className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">No documents ready for chat</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Upload a document first to enable AI document interaction and page citations.
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
        <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[550px] rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {/* Top Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-border bg-secondary/30 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground shrink-0">
                Document Context:
              </span>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="bg-card border border-border rounded-xl px-3 py-1 text-xs font-semibold text-foreground max-w-xs sm:max-w-md truncate outline-none focus:border-[#EAB308]"
              >
                {docs.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.title} ({d.pageCount} pages)
                  </option>
                ))}
              </select>
            </div>

            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                disabled={clearing}
                className="h-7 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear Chat
              </Button>
            )}
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-[#EAB308]/15 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-[#EAB308]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Ask questions about {selectedDoc?.title || "this document"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    AI will search the document and cite exact page references with every answer.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {[
                    "Explain the main concept of this document.",
                    "What are the important definitions mentioned?",
                    "What are the key takeaways from Chapter 1?",
                    "Summarize the conclusion in simple terms.",
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(suggestion)}
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

            {sending && (
              <div className="flex gap-3">
                <div className="h-7 w-7 rounded-lg bg-[#EAB308]/20 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-[#EAB308]" />
                </div>
                <div className="bg-secondary/70 border border-border rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#EAB308]" />
                  Retrieving grounded context & citations...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 border-t border-border bg-secondary/30 shrink-0">
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5 focus-within:border-[#EAB308]/50">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Ask a question about this document..."
                disabled={sending}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
              />
              <Button
                size="sm"
                onClick={() => handleSend()}
                disabled={!input.trim() || sending}
                className="h-7 w-7 p-0 bg-[#EAB308] text-black hover:bg-[#EAB308]/90 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
