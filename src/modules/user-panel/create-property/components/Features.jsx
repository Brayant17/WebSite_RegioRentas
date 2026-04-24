export default function Features({ price, area, floors, bedrooms, bathrooms, parking, setterState }) {

    const handleChange = (e) => {
        const key = e.target.id;
        const value = e.target.value;
        setterState(prev => (
            { ...prev, [key]: value }
        ))
    }

    return (
        <div className="py-4 flex flex-wrap gap-1.5 justify-between w-full">
            <div>
                <label htmlFor="price" className="block mb-1.5 text-sm font-semibold text-neutral-700">Precio ($) *</label>
                <input className="border border-gray-200 rounded py-1.5 px-2" type="number" id="price" placeholder="250000" value={price === 0 ? "" : price ?? ""} onChange={handleChange} />
            </div>
            <div>
                <label htmlFor="area" className="block mb-1.5 text-sm font-semibold text-neutral-700">Area (m²) *</label>
                <input className="border border-[#e5e5e5] rounded p-1 py-1.5 px-2" type="number" id="area" placeholder="120" value={area === 0 ? "" : area ?? ""} onChange={handleChange} />
            </div>
            <div>
                <label htmlFor="floors" className="block mb-1.5 text-sm font-semibold text-neutral-700">Pisos</label>
                <input className="border border-gray-200 rounded p-1 py-1.5 px-2" type="number" id="floors" placeholder="1" value={floors === 0 ? "" : floors ?? ""} onChange={handleChange} />
            </div>
            <div>
                <label htmlFor="bedrooms" className="block mb-1.5 text-sm font-semibold text-neutral-700">Dormitorios</label>
                <input className="border border-gray-200 rounded p-1 py-1.5 px-2" type="number" id="bedrooms" placeholder="3" value={bedrooms === 0 ? "" : bedrooms ?? ""} onChange={handleChange} />
            </div>
            <div>
                <label htmlFor="bathrooms" className="block mb-1.5 text-sm font-semibold text-neutral-700">Baños</label>
                <input className="border border-gray-200 rounded p-1 py-1.5 px-2" type="number" id="bathrooms" placeholder="2" value={bathrooms === 0 ? "" : bathrooms ?? ""} onChange={handleChange} />
            </div>
            <div>
                <label htmlFor="parking" className="block mb-1.5 text-sm font-semibold text-neutral-700">Estacionamiento</label>
                <input className="border border-gray-200 rounded p-1 py-1.5 px-2" type="number" id="parking" placeholder="1" value={parking === 0 ? "" : parking ?? ""} onChange={handleChange} />
            </div>
        </div>
    )
}