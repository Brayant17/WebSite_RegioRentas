"""QA del fixture sintético; requiere pdfplumber. No accede a Supabase."""
import json
import sys
import pdfplumber

path = sys.argv[1] if len(sys.argv) > 1 else "output/pdf/contrato-maquetacion-2b1.pdf"
with pdfplumber.open(path) as pdf:
    texts = [page.extract_text() or "" for page in pdf.pages]
    total = len(pdf.pages)
    assert total > 1
    for index, page in enumerate(pdf.pages):
        assert (page.width, page.height) == (612, 792)
        assert "CTR-PRUEBA-2B1" in texts[index]
        assert f"Página {index + 1} de {total}" in texts[index]
        words = page.extract_words()
        footer = [word for word in words if word["top"] > 735]
        body = [word for word in words if word["top"] <= 735]
        assert footer and body
        assert max(word["bottom"] for word in body) < min(word["top"] for word in footer) - 10
        assert all(55 <= word["x0"] < word["x1"] <= 557 for word in words)
        for title in ["ANTECEDENTES", "CLÁUSULAS", "PRIMERA:", "SEGUNDA:", "TERCERA:", "QUINTA:"]:
            matching = [word for word in body if word["text"] == title]
            for heading in matching:
                assert sum(word["top"] > heading["bottom"] for word in body) >= 3
    third = next(index for index, text in enumerate(texts) if "TERCERA:" in text)
    fourth = next(index for index, text in enumerate(texts) if "CUARTA:" in text)
    assert fourth > third, "La cláusula larga de muestra debe continuar en otra página"
    signature_pages = [index for index, text in enumerate(texts) if "EL ARRENDADOR" in text]
    assert len(signature_pages) == 1
    signatures = texts[signature_pages[0]]
    for expected in ["EL ARRENDATARIO", "EL FIADOR", "Nombre de Prueba Uno", "Nombre de Prueba Dos", "Nombre de Prueba Tres"]:
        assert expected in signatures
    # El fixture no contiene tablas de datos: no debe haber trazos de bordes de tabla.
    assert not pdf.pages[signature_pages[0]].lines
    assert not [rect for rect in pdf.pages[signature_pages[0]].rects
                if rect.get("stroke") or rect.get("non_stroking_color") != (1.0, 1.0, 1.0)]
    print(json.dumps({"pages": total, "letter": True, "footer_each_page": True,
                      "no_overlap": True, "long_clause_splits": True,
                      "signature_page": signature_pages[0] + 1, "table_borders": False}))
