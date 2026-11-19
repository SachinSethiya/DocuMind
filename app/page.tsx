"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  FileText,
  Brain,
  CheckCircle,
  Sparkles,
  Search,
  BookOpen,
  LineChart,
  Layers,
  HelpCircle,
  ShieldCheck,
  Zap,
} from "lucide-react"

function ProductPreview() {
  return (
    <div className="w-full max-w-5xl mx-auto mt-14 px-4 sm:px-6">
      <div className="rounded-2xl border border-border shadow-warm-md overflow-hidden bg-card">
        {/* Browser Top Bar */}
        <div className="h-10 bg-secondary border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-[#EAB308]" />
              DocuMind Workspace — Attention_Is_All_You_Need.pdf
            </span>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
            Analysis Completed · 15 Pages
          </span>
        </div>

        {/* Workspace Mockup */}
        <div className="flex flex-col md:flex-row" style={{ minHeight: 360 }}>
          {/* Sidebar */}
          <div className="w-full md:w-52 border-b md:border-b-0 md:border-r border-border bg-sidebar shrink-0 p-3.5 space-y-1.5">
            {[
              { name: "Overview", icon: Layers, active: true },
              { name: "Executive Summary", icon: FileText, active: false },
              { name: "Topics & Keywords", icon: Sparkles, active: false },
              { name: "Ask AI", icon: Search, active: false },
              { name: "Quiz Generator", icon: Brain, active: false },
              { name: "My Performance", icon: LineChart, active: false },
            ].map((tab) => (
              <div
                key={tab.name}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-colors ${
                  tab.active
                    ? "bg-[#EAB308]/15 text-[#EAB308] font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <tab.icon className={`h-3.5 w-3.5 ${tab.active ? "text-[#EAB308]" : "text-muted-foreground"}`} />
                <span>{tab.name}</span>
              </div>
            ))}
          </div>

          {/* Main Pane */}
          <div className="flex-1 p-5 space-y-4 overflow-hidden bg-background">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <span className="text-[10.5px] uppercase font-bold tracking-wider text-[#EAB308]">
                  AI Document Intelligence
                </span>
                <h3 className="text-base font-semibold text-foreground">
                  Attention Is All You Need — Vaswani et al.
                </h3>
              </div>
              <div className="flex gap-2">
                <span className="text-[11px] bg-secondary px-2.5 py-1 rounded-lg border border-border text-muted-foreground">
                  PDF · 1.2 MB
                </span>
                <span className="text-[11px] bg-[#EAB308]/10 text-[#EAB308] font-medium px-2.5 py-1 rounded-lg border border-[#EAB308]/20">
                  32 Vector Chunks
                </span>
              </div>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Key Concept</span>
                <p className="text-xs font-semibold text-foreground">Self-Attention Mechanism</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  Connects all positions of input sequences with constant operations.
                </p>
                <span className="inline-block text-[10px] text-[#EAB308] font-mono mt-1">Ref: Page 3</span>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Grounded Chat</span>
                <p className="text-xs font-semibold text-foreground">Multi-Head Attention</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  Jointly attends to information from different representation subspaces.
                </p>
                <span className="inline-block text-[10px] text-[#EAB308] font-mono mt-1">Ref: Page 5</span>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Active Quiz</span>
                <p className="text-xs font-semibold text-foreground">Difficulty: Medium (88%)</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  5 MCQs & 2 descriptive questions evaluated with instant AI feedback.
                </p>
                <span className="inline-block text-[10px] text-emerald-500 font-mono mt-1">Passed (88/100)</span>
              </div>
            </div>

            {/* Extracted Keywords Pills */}
            <div className="pt-1">
              <p className="text-[11px] font-semibold text-muted-foreground mb-2">Extracted Keywords:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Self-Attention",
                  "Positional Encoding",
                  "Encoder-Decoder",
                  "Feed-Forward",
                  "BLEU Score",
                  "Layer Normalization",
                ].map((k) => (
                  <span
                    key={k}
                    className="text-[11px] px-2.5 py-0.5 rounded-full bg-secondary text-foreground border border-border font-medium"
                  >
                    #{k}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAppStore()

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-[#EAB308]/20 selection:text-foreground">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#EAB308] flex items-center justify-center shadow-sm">
              <FileText className="h-4 w-4 text-black" />
            </div>
            <span className="text-[15px] font-bold tracking-tight">DocuMind</span>
          </div>

          <nav className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground text-[13px] h-8"
              onClick={() => router.push("/auth/login")}
            >
              Sign in
            </Button>
            <Button
              size="sm"
              className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold text-[13px] h-8 px-4 rounded-lg"
              onClick={() => router.push("/auth/signup")}
            >
              Get started
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-16 pb-6 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-6 rounded-full bg-[#EAB308]/12 border border-[#EAB308]/30 text-[12px] font-semibold text-[#EAB308]">
            <Sparkles className="h-3 w-3" />
            AI-Powered Document Intelligence Platform
          </div>

          <h1 className="text-[44px] sm:text-[58px] lg:text-[68px] font-bold tracking-[-0.04em] leading-[1.05] mb-5 text-foreground">
            Your Documents,
            <br />
            <span className="text-[#EAB308]">Smarter Than Ever</span>
          </h1>

          <p className="text-[16px] sm:text-[18px] text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8">
            Upload any document, uncover important insights, ask AI-powered questions,
            and turn information into knowledge.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Button
              size="lg"
              className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 h-11 px-8 text-[14px] font-semibold rounded-xl shadow-warm-md transition-all hover:scale-[1.01]"
              onClick={() => router.push("/auth/signup")}
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-6 text-[14px] rounded-xl border-border text-muted-foreground hover:text-foreground"
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Explore Features
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            {["PDF & DOCX Support", "Exact Page Citations", "AI Quiz Generator", "Performance Analytics"].map((item) => (
              <div key={item} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5 text-[#EAB308] shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <ProductPreview />
      </section>

      {/* Feature Sections */}
      <section id="features" className="py-20 px-6 border-t border-border bg-secondary/20">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#EAB308] mb-2">
              Transform Your Workflow
            </p>
            <h2 className="text-[30px] sm:text-[36px] font-bold tracking-tight">
              Turn Documents into Interactive Knowledge
            </h2>
            <p className="text-muted-foreground mt-2 text-[15px] max-w-lg mx-auto">
              Everything you need to digest complex papers, manuals, books, and study material.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Layers,
                title: "Intelligent Document Analysis",
                desc: "Automatically extracts document structure, headings, definitions, key facts, and core concepts with page preservation.",
              },
              {
                icon: FileText,
                title: "AI-Powered Summaries",
                desc: "Generate short executive summaries, comprehensive detailed narratives, or section-wise chapter breakdowns with map-reduce scaling.",
              },
              {
                icon: Search,
                title: "Smart Document Chat",
                desc: "Ask any question in natural language and receive grounded answers complete with verified source page citations.",
              },
              {
                icon: Brain,
                title: "Automated Quiz Generation",
                desc: "Create customizable quizzes (Easy, Medium, Hard) featuring both multiple-choice and open-ended descriptive questions.",
              },
              {
                icon: LineChart,
                title: "Learning Performance Tracking",
                desc: "Monitor accuracy trends, topic mastery, and weak areas with data-driven practice recommendations.",
              },
              {
                icon: ShieldCheck,
                title: "Strict User Data Isolation",
                desc: "Your uploaded documents and conversations are completely private and indexed strictly in your isolated workspace.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group p-5 rounded-2xl bg-card border border-border shadow-warm hover:border-[#EAB308]/40 hover:shadow-warm-md transition-all duration-150"
              >
                <div className="h-10 w-10 rounded-xl bg-[#EAB308]/12 flex items-center justify-center shrink-0 mb-4 group-hover:bg-[#EAB308]/20 transition-colors">
                  <f.icon className="h-5 w-5 text-[#EAB308]" />
                </div>
                <h3 className="font-semibold text-[15px] mb-2 text-foreground">{f.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Steps */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#EAB308] mb-2">
              Simple 3-Step Process
            </p>
            <h2 className="text-[28px] sm:text-[34px] font-bold tracking-tight">
              How DocuMind Works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Upload Document",
                desc: "Drag and drop any PDF or Microsoft Word DOCX document. File sizes up to 50 MB supported.",
              },
              {
                step: "02",
                title: "Automatic Intelligence",
                desc: "DocuMind parses the text, extracts key topics, tags vocabulary, builds vector indexes, and summarizes chapters.",
              },
              {
                step: "03",
                title: "Interact & Test Yourself",
                desc: "Chat with the document, navigate cited pages, and take tailored difficulty-based quizzes to reinforce learning.",
              },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-border bg-card p-6 relative">
                <span className="text-3xl font-extrabold text-[#EAB308]/30">{s.step}</span>
                <h3 className="font-semibold text-base mt-2 mb-2 text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center bg-card rounded-2xl border border-border p-10 sm:p-14 shadow-warm-md">
          <div className="h-12 w-12 rounded-2xl bg-[#EAB308]/15 flex items-center justify-center mx-auto mb-5">
            <Brain className="h-6 w-6 text-[#EAB308]" />
          </div>
          <h2 className="text-[26px] sm:text-[32px] font-bold tracking-tight text-foreground mb-3">
            Turn your documents into knowledge today.
          </h2>
          <p className="text-muted-foreground text-[14px] mb-8 max-w-md mx-auto leading-relaxed">
            Upload your first PDF or Word document and discover insights in seconds with DocuMind.
          </p>
          <Button
            size="lg"
            className="bg-[#EAB308] text-black hover:bg-[#EAB308]/90 font-semibold h-11 px-8 rounded-xl shadow-md"
            onClick={() => router.push("/auth/signup")}
          >
            Create Free Account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[12.5px] text-muted-foreground gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#EAB308]" />
            <span className="font-bold text-foreground">DocuMind</span>
            <span>— AI-Powered Document Intelligence</span>
          </div>
          <p>© {new Date().getFullYear()} DocuMind. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
