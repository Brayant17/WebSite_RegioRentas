import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";

import type {
    Control,
    FieldPath,
    FieldValues,
} from "react-hook-form";

type Props<T extends FieldValues> = {
    control: Control<T>;
    name: FieldPath<T>;
    label: string;
    placeholder?: string;
    className?: string;
};

export function FormInput<T extends FieldValues>({
    control,
    name,
    label,
    placeholder,
    className,
}: Props<T>) {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem className={className}>
                    <FormLabel>{label}</FormLabel>

                    <FormControl>
                        <Input
                            placeholder={placeholder}
                            {...field}
                        />
                    </FormControl>

                    <FormMessage />
                </FormItem>
            )}
        />
    );
}