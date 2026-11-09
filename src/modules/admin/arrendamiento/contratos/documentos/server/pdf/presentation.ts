// Solo se añaden clases a un DOM efímero ya sanitizado. Nunca se reescribe texto.
const normalized = (element: Element) => (element.textContent ?? "").replace(/\s+/g, " ").trim();
const ordinal = /^(?:PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|S[ÉE]PTIMA|OCTAVA|NOVENA|D[ÉE]CIMA(?:\s+\w+)?|UND[ÉE]CIMA|DUOD[ÉE]CIMA|VIG[ÉE]SIMA(?:\s+\w+)?|TRIG[ÉE]SIMA(?:\s+\w+)?)\s*[:.\-]/u;
const signatureLabel = /^(?:EL\s+|LA\s+)?(?:ARRENDADOR|ARRENDATARIO|FIADOR)$/u;

export function decoratePrintDocument(document: Document): void {
  for (const element of document.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,div")) {
    if (element.querySelector("p,div,table,h1,h2,h3,h4,h5,h6")) continue;
    const text = normalized(element);
    const upper = text.toLocaleUpperCase("es");
    if (upper === "CONTRATO DE ARRENDAMIENTO") element.classList.add("pdf-title");
    else if (/^(ANTECEDENTES|CL[ÁA]USULAS)$/.test(upper)) element.classList.add("pdf-section");
    else if (ordinal.test(upper) && text.length <= 220 && /[.\-:]$/.test(text) && !/[a-záéíóúñ]/.test(text)) element.classList.add("pdf-clause-title");
    else if (/^[a-z]\)\s/u.test(text)) element.classList.add("pdf-lettered");
    else if (/^[_\s]+$/.test(text) && text.includes("___")) element.classList.add("pdf-inventory");
  }
  for (const strong of document.body.querySelectorAll("strong,b")) {
    if (ordinal.test(normalized(strong).toLocaleUpperCase("es"))) strong.classList.add("pdf-clause-inline");
  }
  // Reconocimiento conservador: tabla con ambos roles exactos y líneas manuscritas.
  for (const table of document.body.querySelectorAll("table")) {
    const labels = [...table.querySelectorAll("p,strong,b,th,td")].filter(element => signatureLabel.test(normalized(element).toLocaleUpperCase("es")));
    const titles = labels.map(element => normalized(element).toLocaleUpperCase("es"));
    const labelWalker = document.createTreeWalker(table, 4);
    const bareLabels: Text[] = [];
    while (labelWalker.nextNode()) {
      const node = labelWalker.currentNode as Text;
      if (signatureLabel.test(node.data.trim().toLocaleUpperCase("es"))) {
        titles.push(node.data.trim().toLocaleUpperCase("es"));
        if (!labels.includes(node.parentElement!)) bareLabels.push(node);
      }
    }
    if (!titles.some(text => /ARRENDADOR$/.test(text)) || !titles.some(text => /ARRENDATARIO$/.test(text)) || !/_{3}/.test(table.textContent ?? "")) continue;
    table.classList.add("pdf-signatures");
    if (normalized(table).length < 1800 && table.querySelectorAll("tr").length <= 3) table.classList.add("pdf-signatures-compact");
    labels.forEach(element => element.classList.add("pdf-signature-label"));
    for (const node of bareLabels) {
      const span = document.createElement("span");
      span.className = "pdf-signature-label";
      node.replaceWith(span); span.append(node);
    }
    // En tablas con <br>, envolver únicamente el nodo de texto de la línea.
    const walker = document.createTreeWalker(table, 4);
    const lines: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (/^\s*_{3,}\s*$/.test(node.data)) lines.push(node);
    }
    for (const node of lines) {
      const span = document.createElement("span");
      span.className = "pdf-signature-line";
      node.replaceWith(span); span.append(node);
    }
  }
}
