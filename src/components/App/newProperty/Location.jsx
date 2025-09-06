export default function Location({ estado, municipio, colonia, zona, setterState }) {
    const inputsList = ["Estado", "Municipio", "Colonia", "Zona"];

    const handleChange = (e) => {
        const key = e.target.id.toLowerCase();
        const value = e.target.value;
        setterState((prev) => ({ ...prev, [key]: value }));
    };

    const formatedValueName = (field) => {
        const fieldLower = field.toLowerCase()
        switch (fieldLower) {
            case "estado":
                return estado;
            case "municipio":
                return municipio || "";
            case "colonia":
                return colonia || "";
            case "zona":
                return zona || "";
            default:
                return "";
        }
    };

    return (
        <div className="py-4 grid grid-cols-2 grid-rows-2 gap-1.5">
            {inputsList.map((dato) => (
                <div key={dato} className="flex flex-col gap-2.5">
                    <label htmlFor={dato} className="w-24">
                        {dato}
                    </label>
                    <input
                        className="border border-gray-200 rounded p-1 py-1.5 px-2"
                        type="text"
                        id={dato}
                        onChange={handleChange}
                        value={formatedValueName(dato)}
                    />
                </div>
            ))}
        </div>
    );
}
