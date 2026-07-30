export function BuildingStatusPill({ status }) {
    const isMaint = status === "Mantenimiento";
    return (
        <span
            className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
            style={{
                fontSize: "10px",
                color: isMaint ? "#ca8a04" : "#16a34a",
                backgroundColor: isMaint ? "#fef9c3" : "#dcfce7",
            }}
        >
            {status}
        </span>
    );
}