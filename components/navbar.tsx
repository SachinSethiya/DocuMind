"use client"

import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, User, FileText, Menu, Sparkles } from "lucide-react"

export function Navbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const router = useRouter()
  const { user, logout } = useAppStore()

  if (!user) return null

  return (
    <nav className="h-[58px] border-b border-border bg-card px-4 sm:px-5 flex items-center justify-between shrink-0 shadow-warm">
      {/* Brand */}
      <div className="flex items-center gap-2">
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2.5 hover:opacity-85 transition-opacity"
        >
          <div className="h-7 w-7 rounded-lg bg-[#EAB308] flex items-center justify-center shadow-sm">
            <FileText className="h-4 w-4 text-black" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[15px] font-bold tracking-tight text-foreground leading-none">
              DocuMind
            </span>
            <span className="text-[9.5px] text-muted-foreground tracking-tight font-medium">
              Document Intelligence
            </span>
          </div>
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2.5">
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">
          <Sparkles className="h-3 w-3 text-[#EAB308]" />
          AI Learning Engine
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 rounded-full p-0 hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[#EAB308]/15 text-[#EAB308] text-xs font-bold border border-[#EAB308]/20">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 shadow-warm-md border-border" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <p className="text-[13px] font-semibold text-foreground truncate">{user.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[13px] cursor-pointer"
              onClick={() => router.push("/dashboard/profile")}
            >
              <User className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[13px] cursor-pointer text-red-500 hover:text-red-600 focus:text-red-600"
              onClick={() => {
                logout()
                router.push("/")
              }}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
