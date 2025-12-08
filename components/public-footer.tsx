import Link from "next/link"
import { AudioLines, Github } from "lucide-react"

export function PublicFooter() {
  return (
    <footer className="border-t border-white/10 mt-24 backdrop-blur-xl bg-black/50">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <AudioLines className="h-5 w-5 text-purple-400" />
            <span className="font-semibold">LiveTranscribe</span>
          </div>
          <div className="flex gap-8 text-sm text-muted-foreground">
            <a
              href="https://github.com/yourusername/livetranscribe"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link href="/auth/login" className="hover:text-foreground transition-colors">
              Login
            </Link>
            <Link href="/auth/sign-up" className="hover:text-foreground transition-colors">
              Sign Up
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">Open Source • Self-Hostable</p>
        </div>
      </div>
    </footer>
  )
}
