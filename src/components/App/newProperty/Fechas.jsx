export default function Fechas({ availableFrom, setterState }) {

    // console.log(availableFrom)

    const handleChange = (e) => {
        const date = e.target.value;
        setterState(prev => (
            { ...prev, available_from: date }
        ))
    }


    return (
        <div className="">
            <div className="flex flex-col">
                {/* <input type="date" name="published_at" /> */}
                <label htmlFor="available_from" className="inline-block mb-1.5 text-sm font-semibold text-neutral-700">Disponible en</label>
                <input
                    className="border-2 border-gray-200 p-1.5 rounded-md"
                    type="date"
                    name="available_from"
                    onChange={handleChange}
                    value={availableFrom || ''}
                />
            </div>
        </div>
    )
}