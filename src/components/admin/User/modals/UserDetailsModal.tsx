"use client"

import { X, Lock, User as UserIcon, ChevronDown } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { User } from "../types"
import { useEffect, useState } from "react"

type Props = {
  open: boolean
  user: User | null
  onClose: () => void
}

export function UserDetailsModal({ open, user, onClose }: Props) {
  if (!user) return null

  // Estados locales para el formulario
  const [userStatus, setUserStatus] = useState<boolean>(user.user_status);
  const [role, setRole] = useState<string>(user.role);

  useEffect(() => {
    // Actualizamos los estados cuando el usuario cambia
    setUserStatus(user.user_status);
    setRole(user.role);
  }, [user]);

  const handleUserChanges = () => {
    // Lógica para guardar los cambios del usuario
    // aqui puedes hacer una llamada a la API
    console.log("Guardando cambios con estado:", userStatus, "y rol:", role)
    onClose()
  }

  // Extraemos las iniciales para el avatar
  const initials = user.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "RE"

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="max-w-[600px] p-0 overflow-hidden border-none shadow-2xl">
        {/* Header personalizado */}
        <div className="p-6 pb-2 flex justify-between items-start">
          <div className="flex gap-4 items-center">
            <div className="bg-blue-50 p-2 rounded-full">
              <UserIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-800">Editar usuario</DialogTitle>
              <p className="text-sm text-slate-500">Actualizar la configuración de la cuenta y las funciones</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Card de Perfil Superior */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-14 w-14 border-2 border-white shadow-sm">
                  <AvatarFallback className="bg-white text-slate-600 font-semibold text-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 leading-none">{user.email}</p>
                <p className="text-xs text-slate-400">User ID:</p>
                <p className="text-xs text-slate-400">#{user.id}</p>
                <Badge variant="secondary" className="bg-slate-200/50 text-[10px] uppercase tracking-wider h-5 px-2 font-bold text-slate-600">
                  <Lock className="w-3 h-3 mr-1" /> Perfil bloqueado
                </Badge>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Estado de la cuenta</span>
              <div className="flex items-center gap-2">
                <Switch id="userStatus" checked={userStatus} onCheckedChange={(checked) => setUserStatus(checked)} className="data-[state=checked]:bg-blue-500" />
                <span className="text-sm font-medium text-slate-700">Activo</span>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Nombre completo</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input
                  readOnly
                  value={user.full_name}
                  className="pl-9 bg-slate-50/50 border-slate-200 text-slate-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Email</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input
                  readOnly
                  value={user.email}
                  className="pl-9 bg-slate-50/50 border-slate-200 text-slate-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">Rol del usuario</Label>
                <Select defaultValue={role} onValueChange={(value) => setRole(value)}>
                  <SelectTrigger className="bg-white border-slate-200">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">Whatsapp</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input
                    readOnly
                    value={user.whatsapp ?? "Sin registrar"}
                    className="pl-9 bg-slate-50/50 border-slate-200 text-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold text-slate-700">Broker Status</Label>
              {/* Proceso del estado de solicitud del broker */}
              {/* Pendiente por hacer */}
              <div className="grid grid-cols-3 gap-2">
                <StatusButton label="In Process" color="bg-blue-500" active />
                <StatusButton label="Done" color="bg-green-500" />
                <StatusButton label="Unknown" color="bg-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter>
          <div className="p-6 pt-2 flex justify-center gap-3">
            <Button variant="ghost" onClick={onClose} className="font-bold text-slate-600">
              Cancelar
            </Button>
            <Button className="" onClick={handleUserChanges}>
              Guardar cambios
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatusButton({ label, color, active = false }: { label: string, color: string, active?: boolean }) {
  return (
    <button className={`
      flex items-center justify-center gap-2 py-2 px-4 rounded-lg border text-[13px] font-medium transition-all
      ${active ? 'border-blue-500 ring-1 ring-blue-500 bg-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}
    `}>
      <span className={`w-2 h-2 rounded-full ${color}`}></span>
      {label}
    </button>
  )
}