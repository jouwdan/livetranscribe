import type { Metadata } from "next"
import BetaClientPage from "./beta-client"

export const metadata: Metadata = {
  title: "Beta Access - LiveTranscribe",
  description:
    "Join our beta program and get early access to LiveTranscribe. We're offering limited access to community groups and organizations committed to accessibility.",
}

export default function BetaPage() {
  return <BetaClientPage />
}
