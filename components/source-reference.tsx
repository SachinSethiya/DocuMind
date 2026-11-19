"use client"

import React, { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileText, ExternalLink, Bookmark } from "lucide-react"

interface SourceReferenceProps {
  pageNumber?: number
  section?: string
  text?: string
  score?: number
  documentTitle?: string
  compact?: boolean
}

export function SourceReference({
  pageNumber = 1,
  section = "Document Section",
  text = "",
  score,
  documentTitle,
  compact = false,
}: SourceReferenceProps) {
  const [open, setOpen] = useState(false)

  if (compact) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#EAB308]/10 hover:bg-[#EAB308]/20 border border-[#EAB308]/25 text-[#EAB308] text-[11px] font-medium transition-colors"
          title={`View excerpt from Page ${pageNumber}`}
        >
          <FileText className="h-3 w-3" />
          <span>Page {pageNumber}</span>
        </button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md sm:max-w-lg bg-card border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                <Bookmark className="h-4 w-4 text-[#EAB308]" />
                Source Reference: Page {pageNumber}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-xs leading-relaxed">
              <div className="flex items-center justify-between text-muted-foreground border-b border-border/50 pb-2">
                <span>Section: <strong className="text-foreground">{section}</strong></span>
                {score !== undefined && (
                  <Badge variant="outline" className="text-[10px]">
                    {Math.round(score * 100)}% match
                  </Badge>
                )}
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border text-foreground font-mono text-[11.5px] max-h-60 overflow-y-auto whitespace-pre-wrap">
                {text || "Reference excerpt from the uploaded document."}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-border/70 bg-card p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <Bookmark className="h-3.5 w-3.5 text-[#EAB308]" />
            <span>Source: Page {pageNumber}</span>
          </div>
          {score !== undefined && (
            <span className="text-[10px] text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
              {Math.round(score * 100)}% relevance
            </span>
          )}
        </div>

        <p className="text-[11.5px] text-muted-foreground truncate">
          Relevant Section: <span className="text-foreground font-medium">{section}</span>
        </p>

        {text && (
          <p className="text-[11.5px] text-muted-foreground line-clamp-2 italic bg-secondary/30 p-2 rounded-lg border border-border/40">
            "{text}"
          </p>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          className="h-7 px-2.5 text-[11px] text-[#EAB308] hover:bg-[#EAB308]/10 border-[#EAB308]/30 w-full"
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          View Source Excerpt
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-[#EAB308]" />
              Source Excerpt: Page {pageNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs leading-relaxed">
            <div className="flex items-center justify-between text-muted-foreground border-b border-border/50 pb-2">
              <span>Section: <strong className="text-foreground">{section}</strong></span>
              {documentTitle && <span className="truncate max-w-[200px]">{documentTitle}</span>}
            </div>
            <div className="p-3.5 rounded-lg bg-secondary/50 border border-border text-foreground font-mono text-[12px] max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {text || "Full excerpt preserved from the source document."}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
