import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

type Item = {
    label: string;
    value: string;
};

type SelectCustomProps = {
    items: Item[];
    placeholder: string;
    value?: string;
    onValueChange?: (value: string) => void;
};

export function SelectCustom({
    items,
    placeholder,
    value,
    onValueChange,
}: SelectCustomProps) {
    return (
        <Select
            value={value}
            onValueChange={onValueChange}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>

            <SelectContent>
                <SelectGroup>
                    {items.map((item) => (
                        <SelectItem
                            key={item.value}
                            value={item.value}
                        >
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}