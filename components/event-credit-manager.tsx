"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { Search, Clock, Users, Calendar, ExternalLink, Plus } from "lucide-react"
import Link from "next/link"
import { formatMinutesToHoursAndMinutes } from "@/lib/format-time"

interface Event {
  id: string
  slug: string
  name: string
  credits_minutes: number
  max_attendees: number
  created_at: string
  is_active: boolean
  archived: boolean
  user_profiles: {
    email: string
    full_name: string | null
  }
}

interface EventCredit {
  id: string
  credits_minutes: number
  max_attendees: number
  notes: string | null
  allocated_to_event_id: string | null
  allocated_at: string | null
}

export function EventCreditManager({ events: initialEvents }: { events: Event[] }) {
  const [events, setEvents] = useState(initialEvents)
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState<string | null>(null)
  const [addingCreditsTo, setAddingCreditsTo] = useState<string | null>(null)
  const [addMinutes, setAddMinutes] = useState("")
  const [addAttendees, setAddAttendees] = useState("")

  const supabase = createClient()

  const filteredEvents = events.filter(
    (event) =>
      event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.user_profiles?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.user_profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleAddCredits = async (event: Event) => {
    if (!addMinutes || !addAttendees) {
      alert("Please enter both minutes and attendees")
      return
    }

    setLoading(event.id)

    try {
      // Update the event's credits
      const { error: updateError } = await supabase
        .from("events")
        .update({
          credits_minutes: event.credits_minutes + Number.parseInt(addMinutes),
          max_attendees: event.max_attendees + Number.parseInt(addAttendees),
        })
        .eq("id", event.id)

      if (updateError) throw updateError

      // Update local state
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? {
                ...e,
                credits_minutes: e.credits_minutes + Number.parseInt(addMinutes),
                max_attendees: e.max_attendees + Number.parseInt(addAttendees),
              }
            : e,
        ),
      )

      // Reset form
      setAddMinutes("")
      setAddAttendees("")
      setAddingCreditsTo(null)
      alert("Credits added successfully!")
    } catch (error) {
      console.error("Error adding credits:", error)
      alert("Failed to add credits")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/80">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by event name, slug, or organizer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black/50 border-border text-white"
          />
        </CardContent>
      </Card>

      {/* Event List */}
      <div className="grid gap-4">
        {filteredEvents.map((event) => (
          <Card key={event.id} className="bg-card/50 backdrop-blur-sm border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-white">{event.name}</CardTitle>
                    {event.is_active && (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                        Active
                      </Badge>
                    )}
                    {event.archived && (
                      <Badge variant="secondary" className="bg-gray-500/20 text-gray-400">
                        Archived
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{event.slug}</span>
                      <Link
                        href={`/view/${event.slug}`}
                        className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300"
                        target="_blank"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="text-sm">
                      Organizer: {event.user_profiles?.full_name || event.user_profiles?.email}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Created {new Date(event.created_at).toLocaleDateString()}
                    </div>
                  </CardDescription>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddingCreditsTo(event.id)}
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Credits
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Credits Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-border/50">
                  <Clock className="h-5 w-5 text-purple-400" />
                  <div>
                    <div className="text-sm text-slate-400">Total Credits</div>
                    <div className="text-xl font-bold text-white">
                      {formatMinutesToHoursAndMinutes(event.credits_minutes)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-border/50">
                  <Users className="h-5 w-5 text-blue-400" />
                  <div>
                    <div className="text-sm text-slate-400">Max Attendees</div>
                    <div className="text-xl font-bold text-white">{event.max_attendees}</div>
                  </div>
                </div>
              </div>

              {addingCreditsTo === event.id ? (
                <div className="p-4 bg-black/30 rounded-lg border border-purple-500/30 space-y-4">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Credits to Event
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-minutes" className="text-slate-300">
                        Minutes to Add
                      </Label>
                      <Input
                        id="add-minutes"
                        type="number"
                        min="0"
                        placeholder="e.g. 180"
                        value={addMinutes}
                        onChange={(e) => setAddMinutes(e.target.value)}
                        className="bg-black/50 border-border text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-attendees" className="text-slate-300">
                        Attendees to Add
                      </Label>
                      <Input
                        id="add-attendees"
                        type="number"
                        min="0"
                        placeholder="e.g. 100"
                        value={addAttendees}
                        onChange={(e) => setAddAttendees(e.target.value)}
                        className="bg-black/50 border-border text-white"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAddCredits(event)}
                      disabled={loading === event.id}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {loading === event.id ? "Adding..." : "Add Credits"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setAddingCreditsTo(null)
                        setAddMinutes("")
                        setAddAttendees("")
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
        {filteredEvents.length === 0 && (
          <Card className="bg-card/50 backdrop-blur-sm border-border/80">
            <CardContent className="py-8">
              <p className="text-center text-slate-400">No events found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
