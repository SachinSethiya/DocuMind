"use client"

import { useRouter, usePathname } from "next/navigation"
import { useRef, useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  LayoutDashboard,
  UploadCloud,
  Files,
  Sparkles,
  MessageSquareText,
  Brain,
  LineChart,
  User,
  Lightbulb,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Dashboard",       href: "/dashboard",           icon: LayoutDashboard },
  { label: "Upload Document", href: "/dashboard/upload",    icon: UploadCloud },
  { label: "My Documents",    href: "/dashboard/documents", icon: Files },
  { label: "AI Analysis",     href: "/dashboard/analysis",  icon: Sparkles },
  { label: "Ask AI",          href: "/dashboard/chat",      icon: MessageSquareText },
  { label: "Quiz Generator",  href: "/dashboard/quizzes",   icon: Brain },
  { label: "My Performance",  href: "/dashboard/analytics", icon: LineChart },
  { label: "Profile",         href: "/dashboard/profile",   icon: User },
] as const

const MIN_W = 180
const MAX_W = 320
const DEFAULT_W = 230
const COLLAPSE_THRESHOLD = 190

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const [width, setWidth] = useState(DEFAULT_W)

  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(DEFAULT_W)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const next = Math.min(Math.max(startWidth.current + e.clientX - startX.current, MIN_W), MAX_W)
      setWidth(next)
    }
    const onUp = () => {
      isResizing.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [])

  const collapsed = useMemo(() => width < COLLAPSE_THRESHOLD, [width])

  const startResize = (e: React.MouseEvent) => {
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  return (
    <aside
      className="relative flex h-full flex-col border-r border-border bg-sidebar shrink-0 select-none"
      style={{ width }}
    >
      <ScrollArea className="flex-1 py-4">
        <nav className="px-2.5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href))

            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href)
                  onNavigate?.()
                }}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 text-left group",
                  active
                    ? "bg-[#EAB308]/15 text-[#EAB308] font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[17px] w-[17px] shrink-0 transition-colors",
                    active
                      ? "text-[#EAB308]"
                      : "text-muted-foreground/70 group-hover:text-foreground"
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      {!collapsed && (
        <div className="p-3 border-t border-border">
          <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-[#EAB308]/10 to-[#D97706]/8 border border-[#EAB308]/20 p-3.5 min-h-[90px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D97706] mb-1.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              DocuMind AI
            </p>
            <p className="text-[11.5px] text-muted-foreground leading-relaxed pr-6">
              Ask questions with page citations and generate personalized quizzes.
            </p>
            <div className="absolute bottom-3 right-3 h-7 w-7 rounded-lg bg-[#EAB308]/15 flex items-center justify-center">
              <Lightbulb className="h-3.5 w-3.5 text-[#D97706]" />
            </div>
          </div>
        </div>
      )}

      {/* Drag handle */}
      <div
        onMouseDown={startResize}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-10"
      />
    </aside>
  )
}
