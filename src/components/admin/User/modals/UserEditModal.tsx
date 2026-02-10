"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { User } from "../types"

type Props = {
  open: boolean
  user: User | null
  onClose: () => void
  sessionToken: string // token de Supabase
}

export function UserEdit({ open, user, onClose, sessionToken }: Props) {
  if (!user) return null

  const [role, setRole] = useState(user.role || "user")
  const [active, setActive] = useState(user.active ?? true)
  const [brokerStatus, setBrokerStatus] = useState<
    "in_process" | "done" | "unknown"
  >(user.broker_status || "in_process")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const initials =
    user.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"

  const whatsapp = user.whatsapp || user.phone || "No registrado"

  const handleSave = async () => {
    if (!user) return
    setLoading(true)
    setMessage("")

    const payload = {
      userId: user.id,
      role,
      status: active ? "active" : "inactive",
      broker_status: brokerStatus,
      token: sessionToken,
    }

    try {
      const res = await fetch("/api/update-user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (data.ok) {
        setMessage("Usuario actualizado con éxito ")
      } else {
        setMessage("Error: " + data.error)
      }
    } catch (err) {
      setMessage("Error al conectarse al servidor")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg backdrop-blur-xl bg-background/80">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Manage account status, role and internal workflow
          </p>
        </DialogHeader>

        <div className="flex items-center gap-4 rounded-lg border p-4">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <p className="font-medium">{user.email}</p>
            <p className="text-xs text-muted-foreground">User ID: {user.id}</p>
            <Badge variant="secondary" className="mt-1">
              Managed Account
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <span className="text-sm">Active</span>
          </div>
        </div>

        <div className="space-y-5 mt-4">
          <ReadOnlyField label="Full Name" value={user.full_name} />
          <ReadOnlyField label="Email Address" value={user.email} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>User Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ReadOnlyField label="WhatsApp" value={whatsapp} />
          </div>

          <div>
            <Label>Broker Status</Label>
            <div className="flex gap-2 mt-2">
              <StatusButton
                active={brokerStatus === "in_process"}
                onClick={() => setBrokerStatus("in_process")}
              >
                In Process
              </StatusButton>
              <StatusButton
                active={brokerStatus === "done"}
                onClick={() => setBrokerStatus("done")}
              >
                Done
              </StatusButton>
              <StatusButton
                active={brokerStatus === "unknown"}
                onClick={() => setBrokerStatus("unknown")}
              >
                Unknown
              </StatusButton>
            </div>
          </div>
        </div>

        {message && (
          <p className={`mt-4 text-sm ${message.includes("Error") ? "text-red-500" : "text-green-500"}`}>
            {message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Guardando..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-xs font-medium text-muted-foreground">{children}</p>
  )
}

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
        {value || "—"}
      </div>
    </div>
  )
}

function StatusButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
