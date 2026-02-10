"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Badge } from "@/components/ui/badge"
import { Lock } from "lucide-react"
import type { User } from "../types"

type Props = {
  open: boolean
  user: User | null
  onClose: () => void
}

export function UserEditModal({ open, user, onClose }: Props) {
  const [role, setRole] = useState<User["role"]>("user")
  const [accountType, setAccountType] = useState<User["account_type"]>("basic")
  const [active, setActive] = useState(true)
  const [verified, setVerified] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    setRole(user.role)
    setAccountType(user.account_type)
    setActive(user.user_status)
    setVerified(user.is_verified)
    setMessage(null)
  }, [user])

  if (!user) return null

  const initials =
    user.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"

  const handleSave = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch("/functions/v1/update-user-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          role,
          account_type: accountType,
          user_status: active,
          is_verified: verified,
        }),
      })

      if (!res.ok) {
        throw new Error("Error al actualizar el usuario")
      }

      setMessage("Usuario actualizado correctamente")
    } catch (error) {
      setMessage("No se pudo actualizar el usuario")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configuración general de la cuenta
          </p>
        </DialogHeader>

        {/* Header */}
        <div className="flex items-center gap-4 rounded-lg border p-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <p className="font-medium">{user.email}</p>
            <p className="text-xs text-muted-foreground">
              ID: {user.id}
            </p>

            <Badge variant="secondary" className="mt-1 w-fit">
              <Lock size={12} className="mr-1" />
              Solo admins
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <span className="text-sm">
              {active ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="mt-6 space-y-5">
          <ReadOnly label="Nombre completo" value={user.full_name} />
          <ReadOnly label="Email" value={user.email} />
          <ReadOnly label="WhatsApp" value={user.whatsapp} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Rol</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="collaborator">Collaborator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de cuenta</Label>
              <Select
                value={accountType}
                onValueChange={setAccountType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Usuario verificado</p>
              <p className="text-xs text-muted-foreground">
                Control interno del sistema
              </p>
            </div>
            <Switch checked={verified} onCheckedChange={setVerified} />
          </div>
        </div>

        {message && (
          <p
            className={`mt-4 text-sm ${
              message.includes("No")
                ? "text-red-500"
                : "text-green-600"
            }`}
          >
            {message}
          </p>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-xs font-medium text-muted-foreground">
      {children}
    </p>
  )
}

function ReadOnly({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
        <Lock size={14} className="text-muted-foreground" />
        <span className="text-muted-foreground">
          {value || "—"}
        </span>
      </div>
    </div>
  )
}
