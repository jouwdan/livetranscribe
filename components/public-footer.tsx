import Link from "next/link"
import { AudioLines } from "lucide-react"

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
            <Link href="/beta" className="hover:text-foreground transition-colors">
              Beta Access
            </Link>
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
          <p className="text-sm text-muted-foreground">
            AI Powered by{" "}
            <a
              href="https://livetranscribe.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-500 hover:text-purple-700 transition-colors"
            >
              LiveTranscribe.net
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
