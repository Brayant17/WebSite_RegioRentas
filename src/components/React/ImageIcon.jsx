export default function ImageIcon({ children, type, activeType, onClick }) {

    const style = activeType === type ? 'border-neutral-900 opacity-100':'border-transparent opacity-55';

    return (
        <div onClick={onClick} className={`flex flex-col items-center border-b-2 hover:border-neutral-900  hover:opacity-100 cursor-pointer h-full ${style}`}>
            {children}
        </div>
    )

}