// Configuración de tema
tailwind.config = {
    theme: {
        extend: {
            fontFamily: { 
                sans: ['Inter', 'sans-serif'], 
                serif: ['Playfair Display', 'serif'],
                mono: ['Courier Prime', 'monospace'] 
            },
            colors: {
                school: { base: '#1e3a8a', accent: '#c2a45a', dark: '#172554', light: '#eff6ff' },
                secondary: '#10B981', 
            }
        },
    },
};

function obtenerToken() {
    const token = sessionStorage.getItem('token');
    if (!token) { 
        console.warn("No hay token en sessionStorage");
        return ""; 
    }
    return token;
}

// --- INICIALIZACIÓN ---
window.onload = async function() {
    const params = new URLSearchParams(window.location.search);
    const idMatricula = params.get('id');

    if(!idMatricula) {
        alert("No se ha seleccionado ningún alumno.");
        window.location.href = 'pensiones.html';
        return;
    }

    document.getElementById('txtDni').value = params.get('dni') || '';
    document.getElementById('txtTelefono').value = params.get('telefono') || '';
    document.getElementById('txtAnio').value = params.get('anio') || '';
    document.getElementById('txtNombres').value = params.get('nombres') || '';
    document.getElementById('txtApellidos').value = params.get('apellidos') || '';
    document.getElementById('txtGrado').value = params.get('grado') || '';

    setupInputsAnulacion();
    await cargarCuotas(idMatricula);
};

// --- INPUTS ANULACIÓN ---
let rawReciboValue = ""; 

function setupInputsAnulacion() {
    const inputRecibo = document.getElementById('txtReciboAnular');
    const inputAuth = document.getElementById('txtCodigoAuth');

    inputRecibo.addEventListener('keydown', function(e) {
        if (['Backspace', 'ArrowLeft', 'ArrowRight', 'Tab', 'Delete'].includes(e.key)) {
            if (e.key === 'Backspace') {
                e.preventDefault();
                rawReciboValue = rawReciboValue.slice(0, -1);
                actualizarInputRecibo(this);
            }
            return; 
        }
        if (!/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            return;
        }
        e.preventDefault();
        if (rawReciboValue.length < 7) {
            rawReciboValue += e.key;
            actualizarInputRecibo(this);
        }
    });

    inputAuth.addEventListener('input', function(e) {
        let val = this.value.replace(/\D/g, '');
        if (val.length > 6) val = val.substring(0, 6);
        if (val.length > 3) {
            this.value = val.substring(0, 3) + ' ' + val.substring(3);
        } else {
            this.value = val;
        }
    });
}

function actualizarInputRecibo(inputElement) {
    const padded = rawReciboValue.padStart(7, '0');
    inputElement.value = `001-${padded}`;
}

async function cargarCuotas(idMatricula) {
    const token = obtenerToken();
    const url = `http://localhost:8083/cuotas/listar/${idMatricula}`;
    const tbody = document.getElementById('cuotas-tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-school-base font-medium animate-pulse">Cargando información de pagos...</td></tr>';

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error al obtener cuotas');

        const listaCuotas = await response.json();
        renderizarTablaCuotas(listaCuotas);

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-500 font-bold">Error al cargar datos del servidor.</td></tr>';
    }
}

function renderizarTablaCuotas(cuotas) {
    const tbody = document.getElementById('cuotas-tbody');
    tbody.innerHTML = '';

    if (cuotas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500 italic">No hay cuotas registradas.</td></tr>';
        return;
    }

    cuotas.forEach((cuota, index) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-200 hover:bg-gray-50 transition-colors fila-cuota";
        
        tr.setAttribute('data-id-cuota', cuota.idCuota);
        tr.setAttribute('data-concepto', cuota.nombreConcepto);
        tr.setAttribute('data-monto', cuota.precio);
        
        const esPagado = cuota.estadoPago === 1;
        const disabledAttr = esPagado ? 'disabled' : '';
        
        if(esPagado) tr.classList.add('bg-green-50/60');

        tr.innerHTML = `
            <td class="px-4 py-3 text-center font-bold text-gray-500">${index + 1}</td>
            <td class="px-4 py-3">
                <input type="text" class="table-input ${esPagado ? 'input-disabled' : ''}" value="${cuota.nombreConcepto}" readonly>
            </td>
            <td class="px-4 py-3">
                <div class="relative">
                    <span class="absolute left-0 top-1 text-gray-400 text-sm">S/.</span>
                    <input type="number" class="table-input pl-6 ${esPagado ? 'input-disabled' : ''}" value="${cuota.precio.toFixed(2)}" readonly>
                </div>
            </td>
            <td class="px-4 py-3 text-center">
                <select class="select-estado w-full border border-gray-300 text-gray-700 py-1 px-2 rounded focus:outline-none focus:ring-2 focus:ring-school-accent focus:border-transparent text-sm transition-all cursor-pointer ${esPagado ? 'input-disabled' : 'bg-white'}" 
                        ${disabledAttr} onchange="validarCorrelatividad(this, ${index})">
                    <option value="0" ${!esPagado ? 'selected' : ''}>Debe</option>
                    <option value="1" ${esPagado ? 'selected' : ''}>Pagado</option>
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function validarCorrelatividad(selectElement, indexActual) {
    if (selectElement.value === "1") { 
        const filas = document.querySelectorAll('.fila-cuota');
        for (let i = 0; i < indexActual; i++) {
            const selectAnterior = filas[i].querySelector('.select-estado');
            if (selectAnterior.value === "0") {
                mostrarModalGif('error', '¡Orden Incorrecto!', 'No puedes pagar esta cuota si tienes deudas anteriores.<br>Por favor, paga en orden cronológico.');
                selectElement.value = "0"; 
                return; 
            }
        }
    } else {
        const filas = document.querySelectorAll('.fila-cuota');
        for(let i = indexActual + 1; i < filas.length; i++) {
            const selectPosterior = filas[i].querySelector('.select-estado');
            if(selectPosterior.value === "1" && !selectPosterior.disabled) {
                selectPosterior.value = "0";
            }
        }
    }
}

function guardar() {
    const filas = document.querySelectorAll('#cuotas-tbody tr');
    let cuotasAPagar = [];

    filas.forEach(fila => {
        const idCuota = fila.getAttribute('data-id-cuota');
        const concepto = fila.getAttribute('data-concepto');
        const monto = parseFloat(fila.getAttribute('data-monto'));
        const select = fila.querySelector('.select-estado');
        
        if(!select.disabled && select.value === "1") {
            cuotasAPagar.push({ id: idCuota, concepto: concepto, monto: monto });
        }
    });

    if(cuotasAPagar.length === 0) {
        mostrarModalGif('warning', 'Sin Selección', 'No ha seleccionado ninguna cuota nueva para pagar.');
        return;
    }

    const total = cuotasAPagar.reduce((acc, curr) => acc + curr.monto, 0).toFixed(2);
    
    mostrarModalGif(
        'question', 
        'Confirmar Transacción', 
        `¿Está seguro de procesar el pago de <strong>${cuotasAPagar.length}</strong> cuota(s)?<br>
         <span class="text-3xl font-bold text-school-base mt-3 block">Total: S/. ${total}</span>`,
        function() {
            procesarPagoReal(cuotasAPagar);
        }
    );
}

async function procesarPagoReal(cuotasAPagar) {
    const btnGuardar = document.getElementById('btn-guardar');
    const originalText = btnGuardar.innerHTML;
    btnGuardar.innerHTML = `<span class="loader"></span> Procesando...`;
    btnGuardar.disabled = true;

    const token = obtenerToken();
    let recibosGenerados = [];
    let errores = [];

    for (const cuota of cuotasAPagar) {
        try {
            const url = `http://localhost:8083/cuotas/pagar/${cuota.id}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                }
            });

            const data = await response.json();

            if (data.resultado === "ok") {
                const mensajeArr = data.mensaje.split('Nro:');
                let nroRecibo = "S/N";
                if(mensajeArr.length > 1) {
                    nroRecibo = mensajeArr[1].trim();
                }
                recibosGenerados.push(nroRecibo);
            } else {
                errores.push(`Error en ${cuota.concepto}: ${data.mensaje}`);
            }

        } catch (e) {
            console.error(e);
            errores.push(`Fallo de red en ${cuota.concepto}`);
        }
    }

    btnGuardar.innerHTML = originalText;
    btnGuardar.disabled = false;

    if (errores.length > 0) {
        mostrarModalGif('error', 'Hubo Problemas', "Algunos pagos fallaron:\n" + errores.join("<br>"), function(){ location.reload(); });
    } else {
        generarReporte(cuotasAPagar, recibosGenerados);
    }
}

let datosReciboTemp = null;

function generarReporte(cuotasPagadas, nrosRecibos) {
    datosReciboTemp = {
        cuotas: cuotasPagadas,
        recibos: nrosRecibos,
        fecha: new Date().toLocaleDateString('es-PE'),
        hora: new Date().toLocaleTimeString('es-PE'),
        alumno: document.getElementById('txtNombres').value + ' ' + document.getElementById('txtApellidos').value,
        dni: document.getElementById('txtDni').value,
        grado: document.getElementById('txtGrado').value,
        anio: document.getElementById('txtAnio').value
    };

    const recibosString = nrosRecibos.map(r => `${r}`).join(", ");
    
    mostrarModalGif(
        'success', 
        '¡Pago Exitoso!', 
        `Se han generado los siguientes comprobantes:<br><strong>${recibosString}</strong>`,
        function() {
            abrirVistaPreviaRecibo(); 
        }
    );
}

function abrirVistaPreviaRecibo() {
    document.getElementById('modalGif').style.display = 'none';
    
    const modalRecibo = document.getElementById('modalRecibo');
    const contenedorItems = document.getElementById('reciboItems');
    const totalElement = document.getElementById('reciboTotal');
    const fechaElement = document.getElementById('reciboFecha');
    const alumnoElement = document.getElementById('reciboAlumno');
    const dniElement = document.getElementById('reciboDni');
    const gradoElement = document.getElementById('reciboGradoInfo');
    const anioElement = document.getElementById('reciboAnioInfo');
    
    const btnAceptar = document.getElementById('btnAceptarRecibo');
    
    btnAceptar.disabled = true;
    btnAceptar.classList.add('opacity-50', 'cursor-not-allowed');
    btnAceptar.classList.remove('hover:bg-school-dark');

    fechaElement.innerHTML = `${datosReciboTemp.fecha} <span class="ml-2 text-gray-400">|</span> ${datosReciboTemp.hora}`;
    alumnoElement.innerText = datosReciboTemp.alumno.toUpperCase();
    dniElement.innerText = datosReciboTemp.dni;
    gradoElement.innerText = datosReciboTemp.grado;
    anioElement.innerText = datosReciboTemp.anio;

    contenedorItems.innerHTML = '';
    let total = 0;
    
    datosReciboTemp.cuotas.forEach((cuota, index) => {
        const nroRecibo = datosReciboTemp.recibos[index] || "S/N";
        total += cuota.monto;
        
        const itemHtml = `
            <div class="flex justify-between items-start mb-2 pb-2 border-b border-dashed border-gray-200 last:border-0 font-mono text-sm">
                <div class="pr-4">
                    <p class="font-bold text-gray-800">${cuota.concepto}</p>
                    <p class="text-[10px] text-gray-500">Recibo: ${nroRecibo}</p>
                </div>
                <span class="font-bold whitespace-nowrap">S/. ${cuota.monto.toFixed(2)}</span>
            </div>
        `;
        contenedorItems.innerHTML += itemHtml;
    });

    totalElement.innerText = "S/. " + total.toFixed(2);

    modalRecibo.style.display = 'flex';
}

function descargarPDF() {
    const element = document.getElementById('printableReceipt');
    const btnDescargar = document.getElementById('btnDescargarPdf');
    const btnAceptar = document.getElementById('btnAceptarRecibo');
    
    const originalText = btnDescargar.innerHTML;
    
    btnDescargar.innerHTML = `<span class="loader w-4 h-4 border-2"></span> Generando...`;
    btnDescargar.disabled = true;

    const opt = {
        margin:       0.1, 
        filename:      `Recibo_${datosReciboTemp.recibos[0] || 'Varios'}.pdf`,
        image:         { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' } 
    };

    html2pdf().set(opt).from(element).save().then(() => {
        btnDescargar.innerHTML = originalText;
        btnDescargar.disabled = false;

        btnAceptar.disabled = false;
        btnAceptar.classList.remove('opacity-50', 'cursor-not-allowed');
        btnAceptar.classList.add('hover:bg-school-dark');
        
    }).catch(err => {
        console.error("Error PDF:", err);
        alert("Hubo un error al generar el PDF.");
        btnDescargar.innerHTML = originalText;
        btnDescargar.disabled = false;
    });
}

function anularPago() {
    rawReciboValue = "";
    document.getElementById('txtReciboAnular').value = '001-0000000';
    document.getElementById('txtCodigoAuth').value = '';
    document.getElementById('modalAnular').style.display = 'flex';
}

function cerrarModalAnular() {
    document.getElementById('modalAnular').style.display = 'none';
}

function validarYConfirmarAnulacion() {
    const txtRecibo = document.getElementById('txtReciboAnular').value.trim();
    const txtCodigoVisual = document.getElementById('txtCodigoAuth').value.trim();
    const txtCodigo = txtCodigoVisual.replace(/\s/g, ''); 

    if (!rawReciboValue || rawReciboValue.length === 0) { 
        alert("Por favor, ingrese el número de recibo.");
        return;
    }
    if (txtCodigo.length !== 6) {
        alert("El código de autenticación debe tener 6 dígitos.");
        return;
    }

    const idRecibo = parseInt(txtRecibo.split('-').pop(), 10);
    if (isNaN(idRecibo)) {
        alert("Formato de recibo inválido.");
        return;
    }

    cerrarModalAnular();

    mostrarModalGif(
        'question',
        '¿Está seguro?',
        `Se procederá a anular el recibo <strong>${txtRecibo}</strong> (ID: ${idRecibo}).<br>Esta acción revertirá las cuotas a "Debe".`,
        function() {
            enviarSolicitudAnulacion(idRecibo, txtCodigo);
        }
    );
}

async function enviarSolicitudAnulacion(idRecibo, codigoDirector) {
    const token = obtenerToken();
    const url = 'http://localhost:8083/recibos/anular';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                idRecibo: idRecibo,
                codigoDirector: parseInt(codigoDirector, 10) 
            })
        });

        const data = await response.json();

        if (data.resultado === "ok") {
            mostrarModalGif(
                'success', 
                '¡Anulación Exitosa!', 
                data.mensaje, 
                function() { location.reload(); }
            );
        } else {
            mostrarModalGif(
                'error', 
                'Error en Anulación', 
                data.mensaje || "No se pudo anular el recibo."
            );
        }

    } catch (error) {
        console.error(error);
        mostrarModalGif(
            'error', 
            'Error de Conexión', 
            "Fallo al comunicar con el servidor."
        );
    }
}

function cerrarReciboYRecargar() {
    window.location.href = 'pensiones.html';
}

function cancelar() {
    window.location.href = 'pensiones.html';
}

let modalYesCallback = null;

function mostrarModalGif(tipo, titulo, mensaje, yesCallback = null) {
    const modal = document.getElementById('modalGif');
    const iconContainer = document.getElementById('modalIconContainer');
    const title = document.getElementById('modalGifTitle');
    const msg = document.getElementById('modalGifMessage');
    const btnContainer = document.getElementById('modalButtons');
    
    modalYesCallback = yesCallback; 
    title.className = "text-2xl font-serif font-bold mb-2"; 

    const iconSuccess = `<div class="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 mb-6 animate-bounce"><svg class="h-16 w-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg></div>`;
    const iconError = `<div class="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-red-100 mb-6 animate-pulse"><svg class="h-16 w-16 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>`;
    const iconWarning = `<div class="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-yellow-100 mb-6 animate-pulse"><svg class="h-16 w-16 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>`;
    const iconQuestion = `<div class="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-blue-100 mb-6"><svg class="h-16 w-16 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>`;

    if (tipo === 'error') {
        iconContainer.innerHTML = iconError;
        title.classList.add('text-red-600');
        btnContainer.innerHTML = `<button onclick="cerrarModalGif()" class="bg-red-600 text-white px-6 py-3 rounded-xl hover:bg-red-700 transition font-bold shadow-lg w-full">Entendido</button>`;
    } else if (tipo === 'warning') {
        iconContainer.innerHTML = iconWarning;
        title.classList.add('text-yellow-600');
        btnContainer.innerHTML = `<button onclick="cerrarModalGif()" class="bg-yellow-600 text-white px-6 py-3 rounded-xl hover:bg-yellow-700 transition font-bold shadow-lg w-full">Entendido</button>`;
    } else if (tipo === 'success') {
        iconContainer.innerHTML = iconSuccess;
        title.classList.add('text-green-600');
        btnContainer.innerHTML = `<button onclick="confirmarAccion()" class="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition font-bold shadow-lg w-full flex items-center justify-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>Aceptar</button>`;
    } else if (tipo === 'question') {
        iconContainer.innerHTML = iconQuestion;
        title.classList.add('text-school-base');
        btnContainer.innerHTML = `<div class="flex gap-4 justify-center w-full"><button onclick="cerrarModalGif()" class="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl hover:bg-gray-200 transition font-bold border border-gray-300">Cancelar</button><button onclick="confirmarAccion()" class="flex-1 bg-school-base text-white px-4 py-3 rounded-xl hover:bg-school-dark transition font-bold shadow-lg">Confirmar</button></div>`;
    }
    
    title.innerText = titulo;
    msg.innerHTML = mensaje;
    modal.style.display = 'flex';
}

function confirmarAccion() {
    if (modalYesCallback) {
        modalYesCallback();
        modalYesCallback = null;
    } else {
        const modal = document.getElementById('modalGif');
        modal.style.display = 'none';
    }
}

function cerrarModalGif() {
    const modal = document.getElementById('modalGif');
    modal.style.display = 'none';
    modalYesCallback = null;
}  