"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { Key, Plus, Trash2, Copy, Check, Calendar, Hash, Edit } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface BetaKey {
  id: string
  access_key: string
  max_uses: number
  current_uses: number
  expires_at: string | null
  notes: string | null
  created_at: string
  users?: Array<{ email: string; created_at: string }>
}

export function BetaKeysManager({ betaKeys: initialKeys }: { betaKeys: BetaKey[] }) {
  const [betaKeys, setBetaKeys] = useState(initialKeys)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [maxUses, setMaxUses] = useState(1)
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  const [editingKey, setEditingKey] = useState<BetaKey | null>(null)
  const [editMaxUses, setEditMaxUses] = useState(1)
  const [editExpiresAt, setEditExpiresAt] = useState<string>("")
  const [editNotes, setEditNotes] = useState("")

  const supabase = createClient()

  const generateRandomKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let key = "BETA-"
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      if (i < 3) key += "-"
    }
    return key
  }

  const fetchKeys = async () => {
    const { data: keysData } = await supabase
      .from("beta_access_keys")
      .select("*")
      .order("created_at", { ascending: false })

    if (keysData) {
      const keysWithUsers = await Promise.all(
        keysData.map(async (key) => {
          const { data: usageData } = await supabase
            .from("beta_key_usage")
            .select("email, created_at")
            .eq("beta_key_id", key.id)
            .order("created_at", { ascending: false })

          return {
            ...key,
            users: usageData || [],
          }
        }),
      )

      setBetaKeys(keysWithUsers)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const handleCreateKey = async () => {
    if (maxUses < 1) {
      alert("Max uses must be at least 1")
      return
    }

    setLoading(true)

    try {
      const key = generateRandomKey()
      const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null

      const { error } = await supabase.from("beta_access_keys").insert({
        access_key: key,
        max_uses: maxUses,
        expires_at: expiresAt,
        notes: notes || null,
      })

      if (error) throw error

      await fetchKeys()

      setMaxUses(1)
      setExpiresInDays(null)
      setNotes("")
      setShowCreateForm(false)

      alert("Beta key created successfully!")
    } catch (error) {
      console.error("Error creating key:", error)
      alert("Failed to create beta key")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this beta key? This action cannot be undone.")) {
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.from("beta_access_keys").delete().eq("id", keyId)

      if (error) throw error

      await fetchKeys()

      alert("Beta key deleted successfully!")
    } catch (error) {
      console.error("Error deleting key:", error)
      alert("Failed to delete beta key")
    } finally {
      setLoading(false)
    }
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleEditKey = (key: BetaKey) => {
    setEditingKey(key)
    setEditMaxUses(key.max_uses)
    setEditExpiresAt(key.expires_at ? new Date(key.expires_at).toISOString().split("T")[0] : "")
    setEditNotes(key.notes || "")
  }

  const handleUpdateKey = async () => {
    if (!editingKey) return

    if (editMaxUses < 1) {
      alert("Max uses must be at least 1")
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from("beta_access_keys")
        .update({
          max_uses: editMaxUses,
          expires_at: editExpiresAt || null,
          notes: editNotes || null,
        })
        .eq("id", editingKey.id)

      if (error) throw error

      await fetchKeys()

      setEditingKey(null)
      alert("Beta key updated successfully!")
    } catch (error) {
      console.error("Error updating key:", error)
      alert("Failed to update beta key")
    } finally {
      setLoading(false)
    }
  }

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const isFullyUsed = (key: BetaKey) => {
    return key.current_uses >= key.max_uses
  }

  const getKeyStatus = (key: BetaKey) => {
    if (isExpired(key.expires_at))
      return (
        <Badge variant="secondary" className="bg-red-500/20 text-red-400">
          Expired
        </Badge>
      )
    if (isFullyUsed(key))
      return (
        <Badge variant="secondary" className="bg-orange-500/20 text-orange-400">
          Fully Used
        </Badge>
      )
    return (
      <Badge variant="secondary" className="bg-green-500/20 text-green-400">
        Active
      </Badge>
    )
  }

  const toggleKeyExpansion = (keyId: string) => {
    const newExpanded = new Set(expandedKeys)
    if (newExpanded.has(keyId)) {
      newExpanded.delete(keyId)
    } else {
      newExpanded.add(keyId)
    }
    setExpandedKeys(newExpanded)
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card/50 backdrop-blur-sm border-border/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Key className="h-5 w-5" />
                Beta Access Keys
              </CardTitle>
              <CardDescription>Generate and manage beta access keys for new users</CardDescription>
            </div>
            {!showCreateForm && (
              <Button onClick={() => setShowCreateForm(true)} className="gap-2 bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4" />
                Create New Key
              </Button>
            )}
          </div>
        </CardHeader>

        {showCreateForm && (
          <CardContent className="space-y-4 border-t border-border/50 pt-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max-uses" className="text-slate-400">
                  Max Uses
                </Label>
                <Input
                  id="max-uses"
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number.parseInt(e.target.value) || 1)}
                  className="bg-black/50 border-border text-white"
                  placeholder="How many times can this key be used?"
                />
              </div>
              <div>
                <Label htmlFor="expires-in" className="text-slate-400">
                  Expires In (Days) - Optional
                </Label>
                <Input
                  id="expires-in"
                  type="number"
                  min="1"
                  value={expiresInDays || ""}
                  onChange={(e) => setExpiresInDays(e.target.value ? Number.parseInt(e.target.value) : null)}
                  className="bg-black/50 border-border text-white"
                  placeholder="Leave empty for no expiration"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes" className="text-slate-400">
                Notes (Optional)
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-black/50 border-border text-white"
                placeholder="e.g., Community Group XYZ, Conference Attendees 2024"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateKey} disabled={loading} className="gap-2 bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4" />
                Generate Key
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreateForm(false)
                  setMaxUses(1)
                  setExpiresInDays(null)
                  setNotes("")
                }}
                disabled={loading}
                className="text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4">
        {betaKeys.map((key) => (
          <Card key={key.id} className="bg-card/50 backdrop-blur-sm border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="text-lg font-mono text-white bg-black/50 px-3 py-1 rounded border border-border/50">
                      {key.access_key}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyKey(key.access_key)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                      title="Copy key"
                    >
                      {copiedKey === key.access_key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    {getKeyStatus(key)}
                  </div>
                  {key.notes && <p className="text-sm text-slate-400">{key.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditKey(key)}
                    disabled={loading}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-white/10"
                    title="Edit key"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteKey(key.id)}
                    disabled={loading}
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    title="Delete key"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Hash className="h-4 w-4" />
                  Uses: {key.current_uses} / {key.max_uses}
                </span>
                {key.expires_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Expires: {new Date(key.expires_at).toLocaleDateString()}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Created: {new Date(key.created_at).toLocaleDateString()}
                </span>
              </div>

              {key.users && key.users.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <button
                    onClick={() => toggleKeyExpansion(key.id)}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    <span>Signed Up Users ({key.users.length})</span>
                    <span className="text-xs">{expandedKeys.has(key.id) ? "▼" : "▶"}</span>
                  </button>
                  {expandedKeys.has(key.id) && (
                    <div className="mt-2 space-y-1">
                      {key.users.map((user, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm px-2 py-1 rounded bg-black/30"
                        >
                          <span className="text-white">{user.email}</span>
                          <span className="text-slate-500 text-xs">
                            {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {betaKeys.length === 0 && (
          <Card className="bg-card/50 backdrop-blur-sm border-border/80">
            <CardContent className="py-8">
              <p className="text-center text-slate-400">
                No beta keys created yet. Click "Create New Key" to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!editingKey} onOpenChange={(open) => !open && setEditingKey(null)}>
        <DialogContent className="bg-slate-900 border-border text-white">
          <DialogHeader>
            <DialogTitle>Edit Beta Key</DialogTitle>
            <DialogDescription className="text-slate-400">
              Modify the settings for this beta access key
            </DialogDescription>
          </DialogHeader>
          {editingKey && (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-400">Access Key</Label>
                <code className="block text-sm font-mono text-white bg-black/50 px-3 py-2 rounded border border-border/50 mt-1">
                  {editingKey.access_key}
                </code>
              </div>
              <div>
                <Label htmlFor="edit-max-uses" className="text-slate-400">
                  Max Uses
                </Label>
                <Input
                  id="edit-max-uses"
                  type="number"
                  min="1"
                  value={editMaxUses}
                  onChange={(e) => setEditMaxUses(Number.parseInt(e.target.value) || 1)}
                  className="bg-black/50 border-border text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-expires-at" className="text-slate-400">
                  Expiration Date (Optional)
                </Label>
                <Input
                  id="edit-expires-at"
                  type="date"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                  className="bg-black/50 border-border text-white mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-notes" className="text-slate-400">
                  Notes (Optional)
                </Label>
                <Textarea
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="bg-black/50 border-border text-white mt-1"
                  placeholder="e.g., Community Group XYZ, Conference Attendees 2024"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleUpdateKey}
                  disabled={loading}
                  className="gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  Save Changes
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setEditingKey(null)}
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
    </div>
  )
}
