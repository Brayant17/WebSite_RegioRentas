import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function TitleSlug({ title, slug, setterState }) {

    const [manualSlug, setManualSlug] = useState(false);
    const [slugError, setSlugError] = useState(null);

    const handleChangeTitle = (e) => {
        const newTitulo = e.target.value;
        setterState(prev => (
            { ...prev, title: newTitulo }
        ));
        if (!manualSlug) {
            slugGenerator(newTitulo);
        }
    };

    const slugGenerator = async (text) => {
        const newSlug = text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-");

        setterState(prev => (
            { ...prev, slug: newSlug }
        ));

        // Validamos en Supabase
        await validateSlug(newSlug);
    };

    const handleSlugChange = async (e) => {
        const text = e.target.value.toLowerCase();
        const newSlug = text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-");

        setterState(prev => (
            { ...prev, slug: newSlug }
        ));
        setManualSlug(true);

        await validateSlug(newSlug);
    };

    const handleButtonGeneratorSlug = async () => {
        setManualSlug(false);
        await slugGenerator(title);
    };

    const validateSlug = async (slug) => {
        try {
            const { data, error } = await supabase
                .from("properties")
                .select("id")
                .eq("slug", slug)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setSlugError("Este slug ya está en uso. Elige otro.");
            } else {
                setSlugError(null);
            }
        } catch (err) {
            console.error("Error validando slug:", err.message);
            setSlugError("Error al validar el slug");
        }
    };

    return (
        <>
            <label htmlFor="titulo" className="inline-block text-sm font-semibold text-neutral-700">
                Título
            </label>
            <input
                id="titulo"
                className="border border-gray-200 p-1.5 rounded-md"
                type="text"
                name="titulo"
                value={title}
                onChange={handleChangeTitle}
            />

            <label htmlFor="slug" className="inline-block text-sm font-semibold text-neutral-700">
                Slug (editable)
            </label>
            <input
                id="slug"
                className={`border rounded px-1 py-1 text-md ${slugError ? "border-red-500" : "border-gray-200"
                    }`}
                type="text"
                name="slug"
                value={slug}
                onChange={handleSlugChange}
            />

            {slugError && <p className="text-red-500 text-sm">{slugError}</p>}
            <div>
                <p className="flex gap-1 text-sm text-slate-500">
                    Enlace permanente: <span className="text-slate-700">/{slug}</span>
                </p>
                <button
                    className="mt-2 border border-slate-300 rounded py-2 px-4 cursor-pointer bg-gray-200 hover:bg-neutral-800 text-neutral-800 hover:text-slate-100 duration-300"
                    onClick={handleButtonGeneratorSlug}
                >
                    Regenerar slug desde el título
                </button>
            </div>
        </>
    );
}