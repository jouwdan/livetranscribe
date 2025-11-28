import type { ReactNode } from "react"
import Link from "next/link"
import { AudioLines, ArrowLeft } from "lucide-react"

export default function AuthPagesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-black to-slate-900 flex flex-col text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/30 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 text-white font-semibold">
          <AudioLines className="h-5 w-5 text-purple-400" />
          LiveTranscribe
        </Link>
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to site
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  )
}
