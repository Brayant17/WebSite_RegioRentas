import { useState, useEffect } from "react";

export default function Amenities({ amenitiesChecked, setterState }) {
    const commonAmenities = [
        "Alberca",
        "Gimnasio",
        "Roof Garden",
        "Salón de eventos",
        "Seguridad 24/7",
        "Estacionamiento",
        "Área de juegos",
        "Canchas deportivas",
    ];

    const [selected, setSelected] = useState(amenitiesChecked);
    const [customAmenity, setCustomAmenity] = useState("");

    const handleCheckbox = (e) => {
        const value = e.target.value;
        setSelected((prev) =>
            prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
        );
    };

    const handleAddCustom = () => {
        if (customAmenity.trim() !== "" && !selected.includes(customAmenity)) {
            setSelected((prev) => [...prev, customAmenity.trim()]);
            setCustomAmenity("");
        }
    };

    const handleDelete = (amenity) => {
        setSelected((prev) => prev.filter((v) => v !== amenity));
    };

    useEffect(() => {
        setterState((prev) => ({ ...prev, amenities: selected }));
    }, [selected]);

    return (
        <div className="py-4">
            {/* Amenidades comunes */}
            <div className="grid grid-cols-2 gap-2 mb-3">
                {commonAmenities.map((amenity) => (
                    <label key={amenity} className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            value={amenity}
                            checked={selected.includes(amenity)}
                            onChange={handleCheckbox}
                            className="accent-blue-600"
                        />
                        {amenity}
                    </label>
                ))}
            </div>

            {/* Campo para amenidades personalizadas */}
            <div className="flex gap-2 mt-2">
                <input
                    type="text"
                    placeholder="Agregar otra..."
                    value={customAmenity}
                    onChange={(e) => setCustomAmenity(e.target.value)}
                    className="flex-1 border border-slate-400 rounded p-1"
                />
                <button
                    type="button"
                    onClick={handleAddCustom}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                >
                    Añadir
                </button>
            </div>

            {/* Vista previa */}
            {selected.length > 0 && (
                <div className="mt-3">
                    <p className="text-sm text-slate-500">Seleccionadas:</p>
                    <ul className="list-disc list-inside text-slate-700 text">
                        {selected.map((a) => (
                            <li
                                key={a}
                                className="my-1 flex flex-row justify-between items-center"
                            >
                                {a}
                                <button
                                    onClick={() => handleDelete(a)}
                                    className="text-red-500 hover:text-red-700 ml-2 cursor-pointer"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-x"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
