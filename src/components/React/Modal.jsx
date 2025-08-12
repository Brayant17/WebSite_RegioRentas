
export default function MiButton({ isOpen, onClose, children, titleModal }) {

    if (!isOpen) return null;

    return (
        <div className="fixed top-0 left-0 right-0 bottom-0 flex justify-center items-center z-50">
            <div className="absolute top-0 left-0 w-full h-full bg-neutral-900 opacity-70"></div>
            <div className="bg-white rounded-lg max-w-lg w-10/12 relative" onClick={(e) => { e.stopPropagation() }}>
                <button className="absolute top-3 right-3 border-0 bg-none text-xl cursor-pointer px-4" onClick={onClose}>
                    <svg  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-x"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
                </button>
                <div>
                    <div className="block border-b border-slate-300 p-3">{titleModal}</div>
                    <div className="p-4">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}