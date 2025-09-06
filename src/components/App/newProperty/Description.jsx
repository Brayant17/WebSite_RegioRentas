import { useRef } from "react";

export default function Description({ description, setterState }) {

    const textareaRef = useRef(null);

    const handleChangeDescription = (e) => {
        const newDescription = e.target.value;
        console.log(newDescription);
        setterState(prev => (
            { ...prev, description: newDescription }
        ));
    }

    const handleInput = (e) => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = "auto"; // resetear primero
            el.style.height = `${el.scrollHeight}px`; // ajustar al contenido 
        }
    }

    return (
        <div className="flex flex-col">
            <label htmlFor="description">Descripción </label>
            <textarea
                ref={textareaRef}
                name="description"
                id="description"
                className="border-gray-200 w-full resize-none overflow-hidden rounded-md border p-2 focus:outline-none focus:ring-2"
                onChange={handleChangeDescription}
                onInput={handleInput}
                placeholder="Descripcion de la propieadad"
                value={description}
                rows={5}
            >
            </textarea>
        </div>
    );
}