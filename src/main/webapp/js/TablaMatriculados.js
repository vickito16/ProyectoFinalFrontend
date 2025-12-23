tailwind.config = {
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'], serif: ['Playfair Display', 'serif'] },
            colors: {
                school: { base: '#1e3a8a', accent: '#c2a45a', dark: '#172554', light: '#eff6ff' },
                secondary: '#10B981', 
            }
        },
    },
};

// --- SEGURIDAD ---
const CLAVE_SECRETA_DES = "MiClaveSecreta123456"; 

function descifrarDES(textoCifrado) {
    if (!textoCifrado) return ""; 
    try {
        const bytes  = CryptoJS.DES.decrypt(textoCifrado, CLAVE_SECRETA_DES);
        const textoOriginal = bytes.toString(CryptoJS.enc.Utf8);
        if (!textoOriginal) return textoCifrado; 
        return textoOriginal;
    } catch (e) { 
        return textoCifrado; 
    }
}

function obtenerToken() {
    const token = sessionStorage.getItem('token');
    if (!token) { 
        console.warn("No hay token en sessionStorage");
        return ""; 
    }
    return token;
}

// --- DATOS ---
let listaMatriculasGlobal = []; 

async function cargarDatosIniciales() {
    const loading = document.getElementById('loading-indicator');
    loading.classList.remove('hidden');
    
    const token = obtenerToken();
    const url = 'http://localhost:8083/matriculas/listar';

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error al cargar matrículas');

        const data = await response.json();
        
        listaMatriculasGlobal = data
            .filter(m => m.estado === 1) 
            .map(m => {
                let gradoNum = "";
                let nivelStr = "";
                if(m.nombreGrado){
                    const partes = m.nombreGrado.split(' '); 
                    if(partes.length > 0) gradoNum = partes[0].replace('°','');
                    if(partes.length > 1) nivelStr = partes[1];
                }

                return {
                    ...m,
                    nombreDescifrado: descifrarDES(m.nombresAlumno),
                    apePaterDescifrado: descifrarDES(m.apePatAlumno),
                    apeMaterDescifrado: descifrarDES(m.apeMatAlumno),
                    gradoCalculado: gradoNum,
                    nivelCalculado: nivelStr
                };
            });

        renderizarTabla(listaMatriculasGlobal); 

    } catch (error) {
        console.error(error);
        alert("Error cargando la lista de matrículas: " + error.message);
    } finally {
        loading.classList.add('hidden');
    }
}

// --- FILTRADO ---
function actualizarGrados() {
    const nivelSeleccionado = document.getElementById('filtro-nivel').value;
    const selectGrado = document.getElementById('filtro-grado');
    
    selectGrado.innerHTML = '<option value="">Todos los Grados</option>';

    let maxGrado = 0;
    if (nivelSeleccionado === 'Primaria') maxGrado = 6;
    else if (nivelSeleccionado === 'Secundaria') maxGrado = 5;

    for (let i = 1; i <= maxGrado; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.text = `${i}° ${nivelSeleccionado}`;
        selectGrado.appendChild(option);
    }
    filtrarMatriculas();
}

function filtrarMatriculas() {
    const anio = document.getElementById('filtro-anio').value;
    const nivel = document.getElementById('filtro-nivel').value;
    const grado = document.getElementById('filtro-grado').value;
    
    const resultados = listaMatriculasGlobal.filter(alumno => {
        const coincideAnio = anio === "" || alumno.anioAcademico == anio;
        const coincideNivel = nivel === "" || alumno.nivelCalculado === nivel;
        const coincideGrado = grado === "" || alumno.gradoCalculado == grado;

        return coincideAnio && coincideNivel && coincideGrado;
    });

    renderizarTabla(resultados);
}

// --- LÓGICA DE DESPLIEGUE DE CUOTAS (ACORDEÓN - FILA) ---
async function toggleCuotas(idMatricula, btn) {
    const tr = btn.closest('tr');
    const nextRow = tr.nextElementSibling;

    if (nextRow && nextRow.classList.contains('row-detalle')) {
        nextRow.classList.toggle('hidden');
        const svg = btn.querySelector('svg');
        if(nextRow.classList.contains('hidden')){
            svg.classList.remove('rotate-180');
        } else {
            svg.classList.add('rotate-180');
        }
        return;
    }

    const token = obtenerToken();
    const url = `http://localhost:8083/cuotas/listar/${idMatricula}`;
    
    const originalContent = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    btn.disabled = true;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error al obtener cuotas');
        const cuotas = await response.json();

        let htmlCuotas = `
            <tr class="row-detalle bg-gray-50 border-b border-gray-200 slide-down">
                <td colspan="8" class="p-4">
                    <div class="bg-white border rounded-lg shadow-inner p-4">
                        <h4 class="text-sm font-bold text-school-base mb-3 uppercase tracking-wide border-b pb-2">Desglose de Pensiones</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        `;

        if(cuotas.length === 0) {
            htmlCuotas += `<p class="text-sm text-gray-500 italic col-span-full">No hay cuotas registradas.</p>`;
        } else {
            cuotas.forEach(c => {
                const estadoClass = c.estadoPago === 1 
                    ? 'bg-green-100 text-green-700 border-green-200' 
                    : 'bg-red-50 text-red-600 border-red-100';
                const estadoIcon = c.estadoPago === 1
                    ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
                    : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
                
                htmlCuotas += `
                    <div class="flex justify-between items-center p-2 rounded border ${estadoClass}">
                        <div class="flex flex-col">
                            <span class="text-xs font-bold uppercase">${c.nombreConcepto}</span>
                            <span class="text-sm font-semibold">S/. ${c.precio.toFixed(2)}</span>
                        </div>
                        <div class="flex items-center gap-1 text-xs font-bold uppercase">
                            ${estadoIcon}
                            ${c.estadoPago === 1 ? 'Pagado' : 'Debe'}
                        </div>
                    </div>
                `;
            });
        }

        htmlCuotas += `
                        </div>
                    </div>
                </td>
            </tr>
        `;

        tr.insertAdjacentHTML('afterend', htmlCuotas);
        btn.innerHTML = originalContent;
        btn.querySelector('svg').classList.add('rotate-180');

    } catch (error) {
        console.error(error);
        alert("Error cargando cuotas.");
    } finally {
        btn.disabled = false;
        if(btn.innerHTML.includes('animate-spin')) btn.innerHTML = originalContent;
    }
}

function renderizarTabla(lista) {
    const tbody = document.getElementById('resultados-tbody');
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-gray-500 italic">No se encontraron matrículas con esos criterios.</td></tr>';
        return;
    }

    lista.forEach(alumno => {
        const datosAlumno = JSON.stringify({
            id: alumno.idMatricula, 
            dni: alumno.dniAlumno,
            nombres: alumno.nombreDescifrado,
            apellidos: `${alumno.apePaterDescifrado} ${alumno.apeMaterDescifrado}`,
            grado: alumno.nombreGrado,
            anio: alumno.anioAcademico,
            telefono: alumno.telefonoApoderado || 'S/N'
        }).replace(/"/g, '&quot;');

        const fila = document.createElement('tr');
        fila.className = "hover:bg-blue-50 border-b border-gray-100 transition-colors group relative";
        
        fila.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-school-base">${alumno.dniAlumno}</td>
            
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 capitalize font-medium">
                ${alumno.apePaterDescifrado} ${alumno.apeMaterDescifrado}
            </td>
            
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 capitalize font-medium">
                ${alumno.nombreDescifrado}
            </td>

            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                <span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">${alumno.nombreGrado}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-bold">
                ${alumno.anioAcademico}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 flex items-center gap-1">
                <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                ${alumno.telefonoApoderado || 'S/N'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                    Activo
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <div class="flex justify-center gap-2 items-center">
                    
                    <button onclick="toggleCuotas(${alumno.idMatricula}, this)" 
                            class="bg-gray-700 text-white p-2 rounded-lg hover:bg-gray-800 transition-all shadow-md transform hover:-translate-y-0.5" title="Ver Cuotas">
                        <svg class="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>

                    <div class="relative">
                        <button id="btn-reporte-${alumno.idMatricula}" 
                                onclick="toggleMenuReporte(event, ${alumno.idMatricula})" 
                                class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2 text-xs font-bold uppercase tracking-wider transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                            Reporte
                            <svg id="icon-reporte-${alumno.idMatricula}" class="w-3 h-3 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        
                        <div id="menu-reporte-${alumno.idMatricula}" class="dropdown-menu hidden">
                            <div class="py-1">
                                <a href="#" onclick="generarReporteIndividual(JSON.parse('${datosAlumno}'), 'pdf'); return false;" class="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors">
                                    <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                    Descargar PDF
                                </a>
                                <a href="#" onclick="generarReporteIndividual(JSON.parse('${datosAlumno}'), 'excel'); return false;" class="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors">
                                    <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    Descargar Excel
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(fila);
    });
}

// --- FUNCIONES DE MENÚ FLOTANTE (FIXED & TOGGLE CORREGIDO) ---
function toggleMenuReporte(event, id) {
    event.stopPropagation();
    const btn = event.currentTarget;
    const menu = document.getElementById(`menu-reporte-${id}`);
    const icon = document.getElementById(`icon-reporte-${id}`);
    
    const wasVisible = menu.classList.contains('show');

    document.querySelectorAll('.dropdown-menu').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('show');
    });
    document.querySelectorAll('[id^="icon-reporte-"]').forEach(el => {
        el.classList.remove('rotate-180');
    });

    if (!wasVisible) {
        const rect = btn.getBoundingClientRect();
        
        menu.style.position = 'fixed';
        menu.style.top = (rect.bottom + 5) + 'px';
        
        if (window.innerWidth - rect.left < 160) {
            menu.style.left = (rect.right - 160) + 'px'; 
        } else {
            menu.style.left = rect.left + 'px'; 
        }

        menu.classList.remove('hidden');
        menu.classList.add('show');
        icon.classList.add('rotate-180');
    }
}

function closeAllMenus() {
    document.querySelectorAll('.dropdown-menu').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('show');
    });
    document.querySelectorAll('[id^="icon-reporte-"]').forEach(el => el.classList.remove('rotate-180'));
}

window.addEventListener('scroll', closeAllMenus, true);
window.addEventListener('click', closeAllMenus);

// --- REPORTE INDIVIDUAL ---
async function generarReporteIndividual(alumno, tipo) {
    closeAllMenus(); 

    const token = obtenerToken();
    const url = `http://localhost:8083/cuotas/listar/${alumno.id}`;
    let cuotas = [];

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) cuotas = await response.json();
    } catch (error) { console.error(error); }

    if (tipo === 'pdf') generarPDFDetallado(alumno, cuotas);
    else if (tipo === 'excel') generarExcelDetallado(alumno, cuotas);
}

function generarPDFDetallado(alumno, cuotas) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("Estado de Cuenta del Estudiante", 105, 22, null, null, "center");

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    let y = 50;
    
    doc.setFont(undefined, 'bold');
    doc.text("Datos Personales:", 14, y);
    y += 8;
    doc.setFont(undefined, 'normal');
    doc.text(`Alumno: ${alumno.apellidos}, ${alumno.nombres}`, 14, y);
    doc.text(`DNI: ${alumno.dni}`, 120, y);
    y += 8;
    doc.text(`Grado: ${alumno.grado}`, 14, y);
    doc.text(`Año: ${alumno.anio}`, 120, y);
    y += 15;

    const cabeceras = [["Concepto", "Monto (S/.)", "Estado"]];
    const cuerpo = cuotas.length > 0 
        ? cuotas.map(c => [
            c.nombreConcepto, 
            c.precio.toFixed(2), 
            c.estadoPago === 1 ? "PAGADO" : "PENDIENTE"
          ])
        : [["Sin registros", "-", "-"]];

    doc.autoTable({
        head: cabeceras,
        body: cuerpo,
        startY: y,
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255] },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 2) {
                data.cell.styles.textColor = data.cell.raw === "PAGADO" ? [22, 163, 74] : [220, 38, 38];
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    let totalPagado = 0, totalDeuda = 0;
    cuotas.forEach(c => c.estadoPago === 1 ? totalPagado += c.precio : totalDeuda += c.precio);

    let finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Total Pagado: S/. ${totalPagado.toFixed(2)}`, 14, finalY);
    doc.text(`Deuda Pendiente: S/. ${totalDeuda.toFixed(2)}`, 14, finalY + 6);
    doc.save(`EstadoCuenta_${alumno.dni}.pdf`);
}

function generarExcelDetallado(alumno, cuotas) {
    const datosExcel = cuotas.map(c => ({
        "Concepto": c.nombreConcepto,
        "Monto": c.precio,
        "Estado": c.estadoPago === 1 ? "PAGADO" : "PENDIENTE",
        "Alumno": `${alumno.apellidos}, ${alumno.nombres}`,
        "DNI": alumno.dni
    }));
    if(datosExcel.length === 0) datosExcel.push({"Mensaje": "Sin datos"});

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "EstadoCuenta");
    XLSX.writeFile(wb, `EstadoCuenta_${alumno.dni}.xlsx`);
}

function obtenerDatosActuales() {
    const anio = document.getElementById('filtro-anio').value;
    const nivel = document.getElementById('filtro-nivel').value;
    const grado = document.getElementById('filtro-grado').value;
    
    return listaMatriculasGlobal.filter(alumno => {
        const coincideAnio = anio === "" || alumno.anioAcademico == anio;
        const coincideNivel = nivel === "" || alumno.nivelCalculado === nivel;
        const coincideGrado = grado === "" || alumno.gradoCalculado == grado;
        return coincideAnio && coincideNivel && coincideGrado;
    });
}

function descargarExcelGlobal() {
    const datos = obtenerDatosActuales();
    if (datos.length === 0) return alert("No hay datos");
    const data = datos.map(a => ({
        "DNI": a.dniAlumno, "Apellidos": `${a.apePaterDescifrado} ${a.apeMaterDescifrado}`,
        "Nombres": a.nombreDescifrado, "Grado": a.nombreGrado, "Año": a.anioAcademico, "Tel": a.telefonoApoderado
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matriculados");
    XLSX.writeFile(wb, "Reporte_Matriculados.xlsx");
}

function descargarPDFGlobal() {
    const datos = obtenerDatosActuales();
    if (datos.length === 0) return alert("No hay datos");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Reporte General de Matriculados", 14, 20);
    const cuerpo = datos.map(a => [ a.dniAlumno, `${a.apePaterDescifrado} ${a.apeMaterDescifrado}`, a.nombreDescifrado, a.nombreGrado, a.anioAcademico, a.telefonoApoderado ]);
    doc.autoTable({ head: [["DNI", "Apellidos", "Nombres", "Grado", "Año", "Teléfono"]], body: cuerpo, startY: 30 });
    doc.save("Reporte_Matriculados.pdf");
}

function irAInicio() {
    window.location.href = 'principalDirector.html';
}

window.onload = function() {
    const usuario = sessionStorage.getItem("usuario");
    if(usuario) document.getElementById("adminName").textContent = usuario;
    cargarDatosIniciales();
};