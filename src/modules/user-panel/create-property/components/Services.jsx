import { useEffect, useRef, useState } from "react";

export default function Services({ servicesChecked, setterState }) {
    const [selected, setSelected] = useState(servicesChecked);

    const servicesList = ["Agua", "Luz", "Gas", "Internet"];

    const handleChange = (event) => {
        const value = event.target.value;
        setSelected(prev =>
            prev.includes(value)
                ? prev.filter(v => v !== value) //desmarcar
                : [...prev, value]
        )

    }

    useEffect(() => {
        setterState(prev => (
            { ...prev, services: selected }
        ))
    }, [selected])

    return (
        <div className="py-4 flex gap-4">
            {servicesList.map((service) => (
                <div key={service} className="flex flex-row gap-1 items-center">
                    <input
                        type="checkbox"
                        id={service}
                        name={service}
                        value={service}
                        onChange={handleChange}
                        checked={selected.includes(service)}
                    />
                    <label htmlFor={service}>{service}</label>
                </div>
            ))}
        </div>
    )
}