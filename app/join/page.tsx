import { JoinEventForm } from "@/components/join-event-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function JoinPage() {
  return (
    <div className="min-h-screen py-12 bg-black">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Join Event</CardTitle>
              <CardDescription>Enter the event code or URL to view live transcriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <JoinEventForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
