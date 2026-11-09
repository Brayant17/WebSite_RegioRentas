// Datos sintéticos exclusivos de QA. No es una plantilla jurídica ni se persiste.
export const fixtureFolio = 'CTR-PRUEBA-2B1';
const paragraph = 'Texto de prueba para comprobar la composición del documento impreso. Este párrafo sintético permite revisar la alineación, el espaciado y la continuidad entre páginas, sin utilizar datos personales ni modificar cláusulas del sistema.';
export const fixtureHtml = `
<h1>CONTRATO DE ARRENDAMIENTO</h1>
<p><strong>MUESTRA DE MAQUETACIÓN — SIN VALIDEZ CONTRACTUAL.</strong> Documento sintético para revisión visual local.</p>
<p><strong>ANTECEDENTES</strong></p>
<p>${paragraph}</p>
<p>a) Primer inciso de muestra con texto suficiente para observar la sangría francesa y la alineación de la segunda línea del párrafo en el área imprimible.</p>
<p>b) Segundo inciso de muestra. Se mantienen las letras y el contenido original del fixture.</p>
<p>c) Domicilio de prueba: ____________________. Campo vacío conservado: __________.</p>
<h2>CLÁUSULAS</h2>
<p><strong>PRIMERA: OBJETO.-</strong></p>
<p>${paragraph}</p>
<p>Que incluye el siguiente inventario de prueba:</p>
<p>________________________________________________</p>
<p>________________________________________________</p>
<p><strong>SEGUNDA: POSESIÓN.-</strong></p>
${Array.from({length:7},()=>`<p>${paragraph}</p>`).join('\n')}
<p><strong>TERCERA: MONTO DE RENTA MENSUAL Y TÉRMINOS DE PAGO.-</strong></p>
<p>${Array(24).fill(paragraph).join(' ')}</p>
<p><strong>CUARTA: CONTINUIDAD.-</strong> ${paragraph}</p>
${Array.from({length:5},()=>`<p>${paragraph}</p>`).join('\n')}
<p><strong>QUINTA: CIERRE DE LA MUESTRA.-</strong></p>
<p>Fin del contenido de prueba. Los nombres siguientes son ficticios y únicamente sirven para inspeccionar el espacio de firma manuscrita.</p>
<table style="border:1px solid black"><tbody>
<tr><td style="border:1px solid black"><p><strong>EL ARRENDADOR</strong></p><p>________________________</p><p>Empresa de Prueba, S.A. de C.V.</p><p>Representante legal</p><p>Nombre de Prueba Uno</p></td>
<td style="border:1px solid black"><p><strong>EL ARRENDATARIO</strong></p><p>________________________</p><p>Nombre de Prueba Dos</p></td></tr>
<tr><td colspan="2"><p><strong>EL FIADOR</strong></p><p>________________________</p><p>Nombre de Prueba Tres</p></td></tr>
</tbody></table>`;
