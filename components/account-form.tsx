"use client"

import type React from "react"

import { useState } from "react"
import type { User } from "@supabase/supabase-js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { updateProfile, updatePassword } from "@/app/(authenticated)/account/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

interface AccountFormProps {
  user: User
  profile: { full_name: string | null; email: string } | null
}

export function AccountForm({ user, profile }: AccountFormProps) {
  const [fullName, setFullName] = useState(profile?.full_name || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingProfile(true)
    setProfileMessage(null)

    const result = await updateProfile(fullName)

    if (result.success) {
      setProfileMessage({ type: "success", text: "Profile updated successfully" })
    } else {
      setProfileMessage({ type: "error", text: result.error || "Failed to update profile" })
    }

    setIsUpdatingProfile(false)
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingPassword(true)
    setPasswordMessage(null)

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match" })
      setIsUpdatingPassword(false)
      return
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "Password must be at least 6 characters" })
      setIsUpdatingPassword(false)
      return
    }

    const result = await updatePassword(newPassword)

    if (result.success) {
      setPasswordMessage({ type: "success", text: "Password updated successfully" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } else {
      setPasswordMessage({ type: "error", text: result.error || "Failed to update password" })
    }

    setIsUpdatingPassword(false)
  }

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Profile Information</CardTitle>
          <CardDescription className="text-slate-400">Update your account details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="bg-white/5 border-white/10 text-slate-400"
              />
              <p className="text-xs text-slate-500">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-white">
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>

            {profileMessage && (
              <Alert
                className={
                  profileMessage.type === "success"
                    ? "border-green-500/50 bg-green-500/10"
                    : "border-red-500/50 bg-red-500/10"
                }
              >
                <AlertDescription className={profileMessage.type === "success" ? "text-green-400" : "text-red-400"}>
                  {profileMessage.text}
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isUpdatingProfile} className="bg-purple-600 hover:bg-purple-700">
              {isUpdatingProfile ? "Updating..." : "Update Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Change Password</CardTitle>
          <CardDescription className="text-slate-400">Update your password to keep your account secure</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-white">
                New Password
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white">
                Confirm New Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
              />
            </div>

            {passwordMessage && (
              <Alert
                className={
                  passwordMessage.type === "success"
                    ? "border-green-500/50 bg-green-500/10"
                    : "border-red-500/50 bg-red-500/10"
                }
              >
                <AlertDescription className={passwordMessage.type === "success" ? "text-green-400" : "text-red-400"}>
                  {passwordMessage.text}
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isUpdatingPassword} className="bg-purple-600 hover:bg-purple-700">
              {isUpdatingPassword ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Account Information</CardTitle>
          <CardDescription className="text-slate-400">View your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">User ID</span>
            <span className="text-white font-mono text-xs">{user.id}</span>
          </div>
          <Separator className="bg-white/10" />
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Account Created</span>
            <span className="text-white">{new Date(user.created_at).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
