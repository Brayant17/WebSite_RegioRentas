"use client"

import * as React from "react"
import { format, parseISO, isValid } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
    value?: string
    onChange?: (date: string | undefined) => void
    placeholder?: string
    disabled?: boolean
    className?: string
}

export default function DatePicker({
    value,
    onChange,
    placeholder = "Selecciona una fecha",
    disabled,
    className,
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false)

    // Convierte el string del form a Date para el Calendar
    const dateValue = React.useMemo(() => {
        if (!value) return undefined
        const parsed = parseISO(value)
        return isValid(parsed) ? parsed : undefined
    }, [value])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    type="button"
                    disabled={disabled}
                    data-empty={!dateValue}
                    className={cn(
                        "w-[280px] justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon />
                    {dateValue ? format(dateValue, "PPP") : <span>{placeholder}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={dateValue}
                    onSelect={(date) => {
                        // Convierte de vuelta a string (ISO) para el form/store
                        onChange?.(date ? date.toISOString() : undefined)
                        setOpen(false)
                    }}
                />
            </PopoverContent>
        </Popover>
    )
}