"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { Search, Plus, Minus, Users, Clock } from "lucide-react"

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  credits_minutes: number
  max_attendees: number
  is_admin: boolean
  created_at: string
  credits_last_updated: string
}

export function AdminDashboard({ users: initialUsers }: { users: UserProfile[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [minutesToAdd, setMinutesToAdd] = useState<{ [key: string]: number }>({})
  const [maxAttendeesToSet, setMaxAttendeesToSet] = useState<{ [key: string]: number }>({})
  const [loading, setLoading] = useState<string | null>(null)

  const supabase = createClient()

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleAddCredits = async (userId: string) => {
    const minutes = minutesToAdd[userId]
    const maxAttendees = maxAttendeesToSet[userId]

    if (!minutes || minutes <= 0) return

    setLoading(userId)

    try {
      // Call the database function to add credits
      const { error } = await supabase.rpc("add_user_credits", {
        p_user_id: userId,
        p_minutes: minutes,
        p_max_attendees: maxAttendees || null,
      })

      if (error) throw error

      // Update local state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                credits_minutes: user.credits_minutes + minutes,
                max_attendees: maxAttendees || user.max_attendees,
                credits_last_updated: new Date().toISOString(),
              }
            : user,
        ),
      )

      setMinutesToAdd((prev) => ({ ...prev, [userId]: 0 }))
      setMaxAttendeesToSet((prev) => ({ ...prev, [userId]: 0 }))
      setEditingUser(null)
    } catch (error) {
      console.error("Error adding credits:", error)
      alert("Failed to add credits")
    } finally {
      setLoading(null)
    }
  }

  const handleDeductCredits = async (userId: string) => {
    const minutes = minutesToAdd[userId]

    if (!minutes || minutes <= 0) return

    setLoading(userId)

    try {
      const { error } = await supabase.rpc("deduct_user_credits", {
        p_user_id: userId,
        p_duration_minutes: minutes,
      })

      if (error) throw error

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                credits_minutes: Math.max(0, user.credits_minutes - minutes),
                credits_last_updated: new Date().toISOString(),
              }
            : user,
        ),
      )

      setMinutesToAdd((prev) => ({ ...prev, [userId]: 0 }))
      setEditingUser(null)
    } catch (error) {
      console.error("Error deducting credits:", error)
      alert("Failed to deduct credits")
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
                  onClick={() => setEditingUser(editingUser === user.id ? null : user.id)}
                  className="text-slate-400 hover:text-white"
                >
                  {editingUser === user.id ? "Cancel" : "Manage"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Credits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-border/50">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <div>
                    <div className="text-sm text-slate-400">Credits</div>
                    <div className="text-xl font-bold text-white">{user.credits_minutes} min</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-border/50">
                  <Users className="h-5 w-5 text-purple-400" />
                  <div>
                    <div className="text-sm text-slate-400">Max Attendees</div>
                    <div className="text-xl font-bold text-white">{user.max_attendees}</div>
                  </div>
                </div>
              </div>

              {/* Edit Form */}
              {editingUser === user.id && (
                <div className="space-y-4 pt-4 border-t border-border/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`minutes-${user.id}`} className="text-slate-400">
                        Minutes to Add/Deduct
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
                        Max Attendees
                      </Label>
                      <Input
                        id={`attendees-${user.id}`}
                        type="number"
                        min="0"
                        value={maxAttendeesToSet[user.id] || user.max_attendees}
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
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAddCredits(user.id)}
                      disabled={loading === user.id || !minutesToAdd[user.id]}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Credits
                    </Button>
                    <Button
                      onClick={() => handleDeductCredits(user.id)}
                      disabled={loading === user.id || !minutesToAdd[user.id]}
                      variant="destructive"
                      className="gap-2"
                    >
                      <Minus className="h-4 w-4" />
                      Deduct Credits
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
