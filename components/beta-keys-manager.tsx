"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { Key, Plus, Trash2, Copy, Check, Calendar, Hash } from "lucide-react"

interface BetaKey {
  id: string
  key: string
  max_uses: number
  current_uses: number
  expires_at: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export function BetaKeysManager({ betaKeys: initialKeys }: { betaKeys: BetaKey[] }) {
  const [betaKeys, setBetaKeys] = useState(initialKeys)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [maxUses, setMaxUses] = useState(1)
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

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
    const { data } = await supabase.from("beta_access_keys").select("*").order("created_at", { ascending: false })

    if (data) {
      setBetaKeys(data)
    }
  }

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
        key,
        max_uses: maxUses,
        expires_at: expiresAt,
        notes: notes || null,
      })

      if (error) throw error

      await fetchKeys()

      // Reset form
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

  const handleToggleActive = async (keyId: string, currentState: boolean) => {
    setLoading(true)

    try {
      const { error } = await supabase.from("beta_access_keys").update({ is_active: !currentState }).eq("id", keyId)

      if (error) throw error

      await fetchKeys()

      alert(`Beta key ${!currentState ? "activated" : "deactivated"} successfully!`)
    } catch (error) {
      console.error("Error toggling key:", error)
      alert("Failed to toggle beta key")
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

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const isFullyUsed = (key: BetaKey) => {
    return key.current_uses >= key.max_uses
  }

  const getKeyStatus = (key: BetaKey) => {
    if (!key.is_active)
      return (
        <Badge variant="secondary" className="bg-slate-500/20 text-slate-400">
          Inactive
        </Badge>
      )
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

  return (
    <div className="space-y-6">
      {/* Create Key Button */}
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

      {/* Keys List */}
      <div className="grid gap-4">
        {betaKeys.map((key) => (
          <Card key={key.id} className="bg-card/50 backdrop-blur-sm border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="text-lg font-mono text-white bg-black/50 px-3 py-1 rounded border border-border/50">
                      {key.key}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyKey(key.key)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                      title="Copy key"
                    >
                      {copiedKey === key.key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    {getKeyStatus(key)}
                  </div>
                  {key.notes && <p className="text-sm text-slate-400">{key.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(key.id, key.is_active)}
                    disabled={loading}
                    className={
                      key.is_active
                        ? "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                        : "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    }
                  >
                    {key.is_active ? "Deactivate" : "Activate"}
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
    </div>
  )
}
