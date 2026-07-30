import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";

import type {
    Control,
    FieldPath,
    FieldValues,
} from "react-hook-form";

import { SelectCustom } from "../SelectCustom";

type Item = {
    label: string;
    value: string;
};

type Props<T extends FieldValues> = {
    control: Control<T>;
    name: FieldPath<T>;
    label: string;
    placeholder: string;
    items: Item[];
    className?: string;
};

export function FormSelect<T extends FieldValues>({
    control,
    name,
    label,
    placeholder,
    items,
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
                        <SelectCustom
                            items={items}
                            value={field.value}
                            placeholder={placeholder}
                            onValueChange={field.onChange}
                        />
                    </FormControl>

                    <FormMessage />
                </FormItem>
            )}
        />
    );
}