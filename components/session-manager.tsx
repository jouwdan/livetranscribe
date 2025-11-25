"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PlusCircle, Edit2, Trash2, Calendar, Clock } from "lucide-react"
import { createSession, updateSession, deleteSession } from "@/app/sessions/actions"
import { Badge } from "@/components/ui/badge"
import { DownloadTranscriptionsButton } from "@/components/download-transcriptions-button"

interface Session {
  id: string
  name: string
  description: string | null
  session_number: number
  started_at: string | null
  ended_at: string | null
  duration_minutes: number
  total_transcriptions: number
  total_words: number
  created_at: string
}

interface SessionManagerProps {
  eventId: string
  eventSlug: string
  eventName: string
  sessions: Session[]
}

export function SessionManager({ eventId, eventSlug, eventName, sessions }: SessionManagerProps) {
  const [editingSession, setEditingSession] = useState<string | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [formData, setFormData] = useState({ name: "", description: "" })

  const handleCreate = async () => {
    if (!formData.name.trim()) return

    await createSession(eventId, formData.name, formData.description)
    setCreatingSession(false)
    setFormData({ name: "", description: "" })
  }

  const handleUpdate = async (sessionId: string) => {
    if (!formData.name.trim()) return

    await updateSession(sessionId, formData.name, formData.description)
    setEditingSession(null)
    setFormData({ name: "", description: "" })
  }

  const handleDelete = async (sessionId: string) => {
    if (
      confirm("Are you sure you want to delete this session? All transcriptions for this session will also be deleted.")
    ) {
      await deleteSession(sessionId)
    }
  }

  const startEdit = (session: Session) => {
    setEditingSession(session.id)
    setFormData({ name: session.name, description: session.description || "" })
  }

  const formatDate = (date: string | null) => {
    if (!date) return "Not started"
    return new Date(date).toLocaleString()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Session Management</h1>
          <p className="text-slate-400 mt-1">{eventName}</p>
        </div>
        <Button onClick={() => setCreatingSession(true)} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          New Session
        </Button>
      </div>

      {creatingSession && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Create New Session</CardTitle>
            <CardDescription>Add a new session to organize your transcriptions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Session Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Morning Keynote, Q&A Session"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add notes about this session"
                className="mt-1.5"
                rows={5}
              />
              <p className="text-sm text-muted-foreground mt-1.5">
                Provide context about speakers, topics, or specialized terminology to improve transcription accuracy
                {formData.description ? ` (${formData.description.length} characters)` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Create Session</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCreatingSession(false)
                  setFormData({ name: "", description: "" })
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {sessions.map((session) => (
          <Card key={session.id} className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {editingSession === session.id ? (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor={`edit-name-${session.id}`}>Session Name</Label>
                        <Input
                          id={`edit-name-${session.id}`}
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`edit-desc-${session.id}`}>Description</Label>
                        <Textarea
                          id={`edit-desc-${session.id}`}
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="mt-1.5"
                          rows={5}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleUpdate(session.id)} size="sm">
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingSession(null)
                            setFormData({ name: "", description: "" })
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-foreground">
                          Session {session.session_number}: {session.name}
                        </CardTitle>
                        {session.started_at && !session.ended_at && (
                          <Badge variant="default" className="bg-green-500/10 text-green-400 border-green-500/20">
                            Active
                          </Badge>
                        )}
                        {session.ended_at && <Badge variant="secondary">Completed</Badge>}
                      </div>
                      {session.description && <CardDescription className="mt-1">{session.description}</CardDescription>}
                    </>
                  )}
                </div>
                {editingSession !== session.id && (
                  <div className="flex gap-2">
                    {session.total_transcriptions > 0 && (
                      <DownloadTranscriptionsButton
                        eventId={eventId}
                        sessionId={session.id}
                        variant="ghost"
                        size="sm"
                      />
                    )}
                    <Button variant="ghost" size="sm" onClick={() => startEdit(session)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(session.id)}
                      disabled={session.started_at !== null}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            {editingSession !== session.id && (
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1 mb-1">
                      <Calendar className="h-3 w-3" />
                      Started
                    </div>
                    <div className="font-medium">{formatDate(session.started_at)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground flex items-center gap-1 mb-1">
                      <Clock className="h-3 w-3" />
                      Duration
                    </div>
                    <div className="font-medium">
                      {session.duration_minutes > 0 ? `${session.duration_minutes} min` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Transcriptions</div>
                    <div className="font-medium">{session.total_transcriptions}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Words</div>
                    <div className="font-medium">{session.total_words}</div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
