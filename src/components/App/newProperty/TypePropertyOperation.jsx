export default function TypePropertyOperation({ propertyType, operation, setterState }) {

    const handleChange = (e) => {
        const newValue = e.target.value;
        const key = e.target.id;
        setterState(prev => (
            { ...prev, [key]: newValue }
        ))
    }

    return (
        <div className="py-4 flex flex-col gap-3 flex-1">
            <div className="flex flex-col md:flex-row gap-2.5">
                <div className="w-full max-w-sm min-w-[200px]">
                    <label htmlFor="property_type" className="inline-block mb-1.5 text-sm font-semibold text-neutral-700">Tipo *</label>
                    <div className="relative">
                        <select
                            id="property_type"
                            name="property_type"
                            defaultValue={propertyType}
                            onChange={handleChange}
                            className="w-full bg-transparent placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-2 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm focus:shadow-md appearance-none cursor-pointer">
                            <option value="" disabled></option>
                            <option value="Departamento">Departamento</option>
                            <option value="Casa">Casa</option>
                            <option value="Bodega">Bodega</option>
                            <option value="Cabaña">Cabaña</option>
                            <option value="Terreno">Terreno</option>
                        </select>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="h-5 w-5 ml-1 absolute top-2.5 right-2.5 text-slate-700">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                        </svg>
                    </div>
                </div>
                <div className="w-full max-w-sm min-w-[200px]">
                    <label htmlFor="operation" className="inline-block mb-1.5 text-sm font-semibold text-neutral-700">Operacion *</label>
                    <div className="relative">
                        <select
                            id="operation"
                            name="operation"
                            defaultValue={operation}
                            onChange={handleChange}
                            className="w-full bg-transparent placeholder:text-slate-400 text-slate-700 text-sm border border-slate-200 rounded pl-3 pr-8 py-2 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-400 shadow-sm focus:shadow-md appearance-none cursor-pointer">
                            <option value="" disabled></option>
                            <option value="Renta">Renta</option>
                            <option value="Venta">Venta</option>
                        </select>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.2" stroke="currentColor" className="h-5 w-5 ml-1 absolute top-2.5 right-2.5 text-slate-700">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    )
}