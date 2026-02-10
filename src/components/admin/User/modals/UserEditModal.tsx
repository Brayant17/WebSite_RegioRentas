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
import { Lock } from "lucide-react"
import type { User } from "../types"

type Props = {
  open: boolean
  user: User | null
  onClose: () => void
  sessionToken: string
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
    setLoading(true)
    setMessage("")

    try {
      const res = await fetch("/api/update-user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          role,
          status: active ? "active" : "inactive",
          broker_status: brokerStatus,
          token: sessionToken,
        }),
      })

      const data = await res.json()
      setMessage(data.ok ? "Usuario actualizado correctamente" : data.error)
    } catch {
      setMessage("Error al conectar con el servidor")
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
            Actualizar la configuración de la cuenta y funciones
          </p>
        </DialogHeader>

        <div className="flex items-center gap-4 rounded-xl border p-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <p className="font-medium">{user.email}</p>
            <p className="text-xs text-muted-foreground">User ID: {user.id}</p>
            <Badge variant="secondary" className="mt-1 flex w-fit items-center gap-1">
              <Lock size={12} /> Perfil bloqueado
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <span className="text-sm">{active ? "Activo" : "Inactivo"}</span>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <ReadOnly label="Nombre completo" value={user.full_name} />
          <ReadOnly label="Email" value={user.email} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Rol del usuario</Label>
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

            <ReadOnly label="WhatsApp" value={whatsapp} />
          </div>

          <div>
            <Label>Broker Status</Label>
            <div className="mt-2 flex gap-2">
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
          <p className={`mt-4 text-sm ${message.includes("Error") ? "text-red-500" : "text-green-600"}`}>
            {message}
          </p>
        )}

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
    <p className="mb-1 text-xs font-medium text-muted-foreground">{children}</p>
  )
}

function ReadOnly({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
        <Lock size={14} className="text-muted-foreground" />
        <span className="text-muted-foreground">{value || "—"}</span>
      </div>
    </div>
  )
}

function StatusButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
