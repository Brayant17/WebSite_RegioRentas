"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { User } from "../types"

type Props = {
  open: boolean
  user: User | null
  onClose: () => void
}

export function UserInfoModal({ open, user, onClose }: Props) {
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Información del usuario</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <Detail label="ID Usuario" value={`#USR-${user.id}`} />
          <Detail label="Nombre completo" value={user.full_name} />
          <Detail label="Email" value={user.email} />

          <Detail
            label="Rol"
            value={
              <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                {user.role}
              </Badge>
            }
          />

          <Detail
            label="WhatsApp"
            value={user.whatsapp ?? "No registrado"}
          />

          <Detail
            label="Broker status"
            value={
              <Badge variant="outline">
                {user.broker_status}
              </Badge>
            }
          />

          <Detail
            label="Estado"
            value={
              <Badge variant="outline">
                {user.approval_status}
              </Badge>
            }
          />

          <Detail
            label="Creado"
            value={new Date(user.created_at).toLocaleString()}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Detail({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
