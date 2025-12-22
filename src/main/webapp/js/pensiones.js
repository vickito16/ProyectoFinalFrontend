// Configuración de Tailwind
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

// --- VALIDACIÓN INPUT DNI ---
function validarInputDNI(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
    filtrarMatriculas();
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
    const textoDNI = document.getElementById('search-input').value.trim();
    const anio = document.getElementById('filtro-anio').value;
    const nivel = document.getElementById('filtro-nivel').value;
    const grado = document.getElementById('filtro-grado').value;
    
    const resultados = listaMatriculasGlobal.filter(alumno => {
        const dni = alumno.dniAlumno || "";
        const coincideDNI = textoDNI === "" || dni.startsWith(textoDNI);
        const coincideAnio = anio === "" || alumno.anioAcademico == anio;
        const coincideNivel = nivel === "" || alumno.nivelCalculado === nivel;
        const coincideGrado = grado === "" || alumno.gradoCalculado == grado;

        return coincideDNI && coincideAnio && coincideNivel && coincideGrado;
    });

    renderizarTabla(resultados);
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
        fila.className = "hover:bg-blue-50 border-b border-gray-100 transition-colors group";
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
                <button onclick="irACuotas(JSON.parse('${datosAlumno}'))" 
                        class="bg-secondary text-white px-4 py-1.5 rounded-lg hover:bg-green-600 transition-all shadow-md flex items-center justify-center mx-auto gap-2 text-xs font-bold uppercase tracking-wider transform hover:-translate-y-0.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Pagar
                </button>
            </td>
        `;
        tbody.appendChild(fila);
    });
}

// --- FUNCIÓN DE REDIRECCIÓN A TABLA DE CUOTAS ---
function irACuotas(alumno) {
    const params = new URLSearchParams({
        id: alumno.id,
        dni: alumno.dni,
        nombres: alumno.nombres,
        apellidos: alumno.apellidos,
        grado: alumno.grado,
        anio: alumno.anio,
        telefono: alumno.telefono
    });
    
    window.location.href = `TablaCuotas.html?${params.toString()}`;
}

function irAInicio() {
    window.location.href = 'principal.html';
}

window.onload = function() {
    const usuario = sessionStorage.getItem("usuario");
    if(usuario) document.getElementById("adminName").textContent = usuario;
    cargarDatosIniciales();
};