"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { Users, Edit, Search, Calendar, Clock, ShieldCheck } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

interface User {
  id: string
  email: string
  full_name: string | null
  is_admin: boolean
  created_at: string
  total_events: number
  total_usage_minutes: number
}

export function UserManager({ users: initialUsers }: { users: User[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editFullName, setEditFullName] = useState("")
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditFullName(user.full_name || "")
    setEditIsAdmin(user.is_admin)
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return

    setLoading(true)

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          full_name: editFullName || null,
          is_admin: editIsAdmin,
        })
        .eq("id", editingUser.id)

      if (error) throw error

      // Refresh users list
      const { data: updatedUsers } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false })

      if (updatedUsers) {
        setUsers(
          updatedUsers.map((u) => {
            const existingUser = users.find((user) => user.id === u.id)
            return {
              ...u,
              total_events: existingUser?.total_events || 0,
              total_usage_minutes: existingUser?.total_usage_minutes || 0,
            }
          }),
        )
      }

      setEditingUser(null)
      alert("User updated successfully!")
    } catch (error) {
      console.error("Error updating user:", error)
      alert("Failed to update user")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm border-border/80 mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-white text-lg">Search Users</CardTitle>
          <CardDescription>Find users by email or name</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-black/50 border-border text-white"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="bg-card/50 backdrop-blur-sm border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-white">{user.full_name || "No name provided"}</h3>
                    {user.is_admin && (
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{user.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditUser(user)}
                  className="text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-orange-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Total Events</p>
                    <p className="text-sm font-semibold text-white">{user.total_events}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-purple-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Total Usage</p>
                    <p className="text-sm font-semibold text-white">{user.total_usage_minutes} min</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Joined</p>
                    <p className="text-sm font-semibold text-white">{new Date(user.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredUsers.length === 0 && (
          <Card className="bg-card/50 backdrop-blur-sm border-border/80">
            <CardContent className="py-8">
              <p className="text-center text-slate-400">
                {searchQuery ? "No users found matching your search." : "No users found."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="bg-slate-900 border-border text-white">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription className="text-slate-400">Modify user details and permissions</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-400">Email</Label>
                <p className="text-sm text-white bg-black/50 px-3 py-2 rounded border border-border/50 mt-1">
                  {editingUser.email}
                </p>
              </div>
              <div>
                <Label htmlFor="edit-full-name" className="text-slate-400">
                  Full Name
                </Label>
                <Input
                  id="edit-full-name"
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="bg-black/50 border-border text-white mt-1"
                  placeholder="Enter full name"
                />
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-black/30 rounded border border-border/50">
                <div>
                  <Label htmlFor="edit-is-admin" className="text-slate-400">
                    Administrator
                  </Label>
                  <p className="text-xs text-slate-500 mt-1">Grant admin access to this user</p>
                </div>
                <Switch
                  id="edit-is-admin"
                  checked={editIsAdmin}
                  onCheckedChange={setEditIsAdmin}
                  className="data-[state=checked]:bg-purple-600"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleUpdateUser}
                  disabled={loading}
                  className="gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  Save Changes
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setEditingUser(null)}
                  disabled={loading}
                  className="text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
