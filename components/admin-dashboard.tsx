"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { Search, Plus, Users, Clock, CreditCard, Trash2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { formatMinutesToHoursAndMinutes } from "@/lib/format-time"

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  is_admin: boolean
  created_at: string
}

interface EventCredit {
  id: string
  credits_minutes: number
  max_attendees: number
  notes: string | null
  allocated_to_event_id: string | null
  allocated_at: string | null
  created_at: string
  events?: {
    name: string
    slug: string
  } | null
}

export function AdminDashboard({ users: initialUsers }: { users: UserProfile[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [minutesToAdd, setMinutesToAdd] = useState<{ [key: string]: number }>({})
  const [maxAttendeesToSet, setMaxAttendeesToSet] = useState<{ [key: string]: number }>({})
  const [creditNotes, setCreditNotes] = useState<{ [key: string]: string }>({})
  const [creditQuantity, setCreditQuantity] = useState<{ [key: string]: number }>({})
  const [userCredits, setUserCredits] = useState<{ [key: string]: EventCredit[] }>({})
  const [loading, setLoading] = useState<string | null>(null)

  const supabase = createClient()

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const fetchUserCredits = async (userId: string) => {
    const { data, error } = await supabase
      .from("event_credits")
      .select(`
        *,
        events:allocated_to_event_id (
          name,
          slug
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching credits:", error)
      return
    }

    setUserCredits((prev) => ({ ...prev, [userId]: data || [] }))
  }

  const handleAllocateCredit = async (userId: string) => {
    const minutes = minutesToAdd[userId]
    const maxAttendees = maxAttendeesToSet[userId]
    const notes = creditNotes[userId]
    const quantity = creditQuantity[userId] || 1

    if (!minutes || minutes <= 0 || !maxAttendees || maxAttendees <= 0) {
      alert("Please enter valid minutes and max attendees")
      return
    }

    if (quantity < 1 || quantity > 100) {
      alert("Please enter a quantity between 1 and 100")
      return
    }

    setLoading(userId)

    try {
      const creditsToInsert = Array.from({ length: quantity }, () => ({
        user_id: userId,
        credits_minutes: minutes,
        max_attendees: maxAttendees,
        notes: notes || "Admin allocated credit",
      }))

      const { error } = await supabase.from("event_credits").insert(creditsToInsert)

      if (error) throw error

      await fetchUserCredits(userId)

      setMinutesToAdd((prev) => ({ ...prev, [userId]: 0 }))
      setMaxAttendeesToSet((prev) => ({ ...prev, [userId]: 0 }))
      setCreditNotes((prev) => ({ ...prev, [userId]: "" }))
      setCreditQuantity((prev) => ({ ...prev, [userId]: 1 }))

      alert(`${quantity} event credit${quantity > 1 ? "s" : ""} allocated successfully!`)
    } catch (error) {
      console.error("Error allocating credit:", error)
      alert("Failed to allocate credit")
    } finally {
      setLoading(null)
    }
  }

  const handleDeleteCredit = async (creditId: string, userId: string) => {
    if (!confirm("Are you sure you want to delete this event credit? This action cannot be undone.")) {
      return
    }

    setLoading(creditId)

    try {
      const { error } = await supabase.from("event_credits").delete().eq("id", creditId)

      if (error) throw error

      await fetchUserCredits(userId)

      alert("Event credit deleted successfully!")
    } catch (error) {
      console.error("Error deleting credit:", error)
      alert("Failed to delete credit")
    } finally {
      setLoading(null)
    }
  }

  const handleUnallocateCredit = async (creditId: string, userId: string) => {
    if (!confirm("Unallocate this credit from its event? The credit will become available again.")) {
      return
    }

    setLoading(creditId)

    try {
      const { error } = await supabase
        .from("event_credits")
        .update({
          allocated_to_event_id: null,
          allocated_at: null,
        })
        .eq("id", creditId)

      if (error) throw error

      await fetchUserCredits(userId)

      alert("Credit unallocated successfully!")
    } catch (error) {
      console.error("Error unallocating credit:", error)
      alert("Failed to unallocate credit")
    } finally {
      setLoading(null)
    }
  }

  const handleEditUser = async (userId: string) => {
    if (editingUser === userId) {
      setEditingUser(null)
    } else {
      setEditingUser(userId)
      setCreditQuantity((prev) => ({ ...prev, [userId]: 1 }))
      await fetchUserCredits(userId)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/80">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by name, email or user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black/50 border-border text-white"
          />
        </CardContent>
      </Card>

      {/* User List */}
      <div className="grid gap-4">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="bg-card/50 backdrop-blur-sm border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-white flex items-center gap-2">
                    {user.full_name || user.email}
                    {user.is_admin && (
                      <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                        Admin
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="space-y-1">
                    {user.full_name && <div className="text-sm">{user.email}</div>}
                    <div className="font-mono text-xs">{user.id}</div>
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditUser(user.id)}
                  className="text-slate-400 hover:text-white"
                >
                  {editingUser === user.id ? "Cancel" : "Manage Credits"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingUser === user.id && (
                <div className="space-y-4">
                  {/* Existing Credits */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Event Credits
                    </h4>
                    {userCredits[user.id] && userCredits[user.id].length > 0 ? (
                      <div className="space-y-2">
                        {userCredits[user.id].map((credit) => (
                          <div key={credit.id} className="p-3 bg-black/30 rounded-lg border border-border/50 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-white">
                                    {credit.notes || "Event Credit"}
                                  </span>
                                  {credit.allocated_to_event_id ? (
                                    <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                                      In Use
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                                      Available
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatMinutesToHoursAndMinutes(credit.credits_minutes)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {credit.max_attendees} attendees
                                  </span>
                                </div>
                                {credit.allocated_to_event_id && credit.events && (
                                  <div className="flex items-center gap-2 text-xs text-purple-400">
                                    <span>Allocated to: {credit.events.name}</span>
                                    <Link
                                      href={`/view/${credit.events.slug}`}
                                      className="inline-flex items-center gap-1 hover:text-purple-300"
                                      target="_blank"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {credit.allocated_to_event_id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleUnallocateCredit(credit.id, user.id)}
                                    disabled={loading === credit.id}
                                    className="h-8 px-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                                    title="Unallocate from event"
                                  >
                                    Unallocate
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteCredit(credit.id, user.id)}
                                  disabled={loading === credit.id || !!credit.allocated_to_event_id}
                                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  title={
                                    credit.allocated_to_event_id ? "Cannot delete allocated credit" : "Delete credit"
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No event credits yet</p>
                    )}
                  </div>

                  {/* Allocate New Credit Form */}
                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <h4 className="text-sm font-medium text-white">Allocate Event Credit</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor={`minutes-${user.id}`} className="text-slate-400">
                          Duration (Minutes)
                        </Label>
                        <Input
                          id={`minutes-${user.id}`}
                          type="number"
                          min="0"
                          value={minutesToAdd[user.id] || ""}
                          onChange={(e) =>
                            setMinutesToAdd((prev) => ({
                              ...prev,
                              [user.id]: Number.parseInt(e.target.value) || 0,
                            }))
                          }
                          className="bg-black/50 border-border text-white"
                          placeholder="Enter minutes"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`attendees-${user.id}`} className="text-slate-400">
                          Attendee Limit
                        </Label>
                        <Input
                          id={`attendees-${user.id}`}
                          type="number"
                          min="0"
                          value={maxAttendeesToSet[user.id] || ""}
                          onChange={(e) =>
                            setMaxAttendeesToSet((prev) => ({
                              ...prev,
                              [user.id]: Number.parseInt(e.target.value) || 0,
                            }))
                          }
                          className="bg-black/50 border-border text-white"
                          placeholder="Max attendees"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`quantity-${user.id}`} className="text-slate-400">
                          Quantity
                        </Label>
                        <Input
                          id={`quantity-${user.id}`}
                          type="number"
                          min="1"
                          max="100"
                          value={creditQuantity[user.id] || 1}
                          onChange={(e) =>
                            setCreditQuantity((prev) => ({
                              ...prev,
                              [user.id]: Number.parseInt(e.target.value) || 1,
                            }))
                          }
                          className="bg-black/50 border-border text-white"
                          placeholder="How many"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`notes-${user.id}`} className="text-slate-400">
                        Package Description (Optional)
                      </Label>
                      <Textarea
                        id={`notes-${user.id}`}
                        value={creditNotes[user.id] || ""}
                        onChange={(e) =>
                          setCreditNotes((prev) => ({
                            ...prev,
                            [user.id]: e.target.value,
                          }))
                        }
                        className="bg-black/50 border-border text-white"
                        placeholder="e.g., Small Event Package - 3 hours, up to 100 attendees"
                      />
                    </div>
                    <Button
                      onClick={() => handleAllocateCredit(user.id)}
                      disabled={loading === user.id}
                      className="gap-2 bg-purple-600 hover:bg-purple-700"
                    >
                      <Plus className="h-4 w-4" />
                      Allocate{" "}
                      {creditQuantity[user.id] && creditQuantity[user.id] > 1 ? `${creditQuantity[user.id]}x ` : ""}
                      Credit{creditQuantity[user.id] > 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredUsers.length === 0 && (
          <Card className="bg-card/50 backdrop-blur-sm border-border/80">
            <CardContent className="py-8">
              <p className="text-center text-slate-400">No users found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
