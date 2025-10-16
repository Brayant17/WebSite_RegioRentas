import { useState } from "react";

export default function PriceRangeSliderAirbnb({
    min = 0,
    max = 2000,
    step = 50,
    defaultValue = [300, 1500],
    onChange,
}) {
    const [range, setRange] = useState(defaultValue);

    const handleChange = (index, value) => {
        const newRange = [...range];
        newRange[index] = Number(value);
        if (newRange[0] > newRange[1]) return;
        setRange(newRange);
        if (onChange) onChange(newRange);
    };

    const leftPercent = ((range[0] - min) / (max - min)) * 100;
    const rightPercent = ((range[1] - min) / (max - min)) * 100;

    return (
        <div className="w-full max-w-lg mx-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Rango de precios</h3>

            <div className="flex w-full justify-between items-center gap-6">
                <div className="flex-1 border border-gray-500 p-2 rounded">
                    <p className="text-xs text-gray-700 font-medium">Precio mínimo</p>
                    <span className="text-sm text-gray-700 font-semibold">${range[0].toLocaleString()}</span>
                </div>
                <span>-</span>
                <div className="flex-1 border border-gray-500 p-2 rounded">
                    <p className="text-xs text-gray-700 font-medium">Precio mínimo</p>
                    <span className="text-sm text-gray-700 font-semibold">${range[1].toLocaleString()}</span>
                </div>
            </div>

            <div className="relative h-2 mt-8">
                {/* Fondo base */}
                <div className="absolute inset-0 bg-gray-200 rounded-full" />

                {/* Rango activo */}
                <div
                    className="absolute h-2 bg-gradient-to-r from-red-500 to-rose-400 rounded-full transition-all"
                    style={{
                        left: `${leftPercent}%`,
                        right: `${100 - rightPercent}%`,
                    }}
                />

                {/* Sliders */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={range[0]}
                    onChange={(e) => handleChange(0, e.target.value)}
                    className="absolute w-full appearance-none bg-transparent pointer-events-none focus:outline-none -translate-y-2 cursor-pointer"
                    style={{ zIndex: range[0] > max - 100 ? 5 : 10 }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={range[1]}
                    onChange={(e) => handleChange(1, e.target.value)}
                    className="absolute w-full appearance-none bg-transparent pointer-events-none focus:outline-none -translate-y-2 cursor-pointer"
                />

                {/* Estilos para los "dots" */}
                <style>
                    {`
            input[type="range"]::-webkit-slider-thumb {
              appearance: none;
              pointer-events: auto;
              height: 26px;
              width: 26px;
              border-radius: 9999px;
              background: white;
              border: 3px solid #f43f5e; /* rosa Airbnb */
              box-shadow: 0 3px 6px rgba(0,0,0,0.2);
              transition: all 0.15s ease;
            }
            input[type="range"]::-webkit-slider-thumb:hover {
              transform: scale(1.1);
              box-shadow: 0 4px 10px rgba(244, 63, 94, 0.4);
            }
            input[type="range"]::-moz-range-thumb {
              height: 26px;
              width: 26px;
              border-radius: 9999px;
              background: white;
              border: 3px solid #f43f5e;
              box-shadow: 0 3px 6px rgba(0,0,0,0.2);
              transition: all 0.15s ease;
            }
            input[type="range"]::-moz-range-thumb:hover {
              transform: scale(1.1);
              box-shadow: 0 4px 10px rgba(244, 63, 94, 0.4);
            }
          `}
                </style>
            </div>
        </div>
    );
}
