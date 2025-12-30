// Configuración de Tailwind (Tema Institucional)
tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                serif: ['Playfair Display', 'serif'],
            },
            colors: {
                school: {
                    base: '#1e3a8a', // Azul institucional
                    accent: '#c2a45a', // Dorado académico
                    dark: '#172554',
                    light: '#eff6ff'
                },
                danger: '#EF4444',
                success: '#10B981'
            }
        },
    },
};

// ******************************************************
// LÓGICA DE NEGOCIO
// ******************************************************

const CLAVE_SECRETA_DES = "MiClaveSecreta123456"; 

function cifrarDES(texto) {
    if (!texto) return "";
    return CryptoJS.DES.encrypt(texto, CLAVE_SECRETA_DES).toString();
}

function descifrarDES(textoCifrado) {
    if (!textoCifrado) return "";
    try {
        const bytes  = CryptoJS.DES.decrypt(textoCifrado, CLAVE_SECRETA_DES);
        const textoOriginal = bytes.toString(CryptoJS.enc.Utf8);
        if (!textoOriginal) return textoCifrado; 
        return textoOriginal;
    } catch (e) {
        console.error("Error al descifrar:", e);
        return textoCifrado; 
    }
}

let alumnoSeleccionado = null; 

// --- NUEVA FUNCIÓN PARA RESTRINGIR INPUTS A SOLO NÚMEROS ---
function soloNumeros(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
}

function calcularEdad(fechaNacimiento) {
    const hoy = new Date();
    const cumpleanos = new Date(fechaNacimiento + 'T00:00:00'); 
    let edad = hoy.getFullYear() - cumpleanos.getFullYear();
    const mes = hoy.getMonth() - cumpleanos.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < cumpleanos.getDate())) {
        edad--;
    }
    return edad;
}

function mostrarAlerta(mensaje, tipo = 'success') {
    const alertDiv = document.getElementById('status-alert');
    
    if (tipo === 'success') {
        alertDiv.className = 'bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-sm mb-6 transition-all duration-300 flex items-center';
        alertDiv.innerHTML = `<svg class="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> ${mensaje}`;
    } else {
        alertDiv.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm mb-6 transition-all duration-300 flex items-center';
        alertDiv.innerHTML = `<svg class="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg> ${mensaje}`;
    }

    alertDiv.classList.remove('hidden');
    setTimeout(() => {
        alertDiv.classList.add('hidden');
    }, 5000);
}

function obtenerToken() {
    const token = sessionStorage.getItem('token');
    if (!token) {
        throw new Error('Token de sesión no encontrado. Por favor, inicie sesión.');
    }
    return token;
}

function irAInicio() {
    window.location.href = 'principal.html';
}

// ---------------------------------------------------------
// 🔥 SOLUCIÓN MANUAL: Limpieza explícita campo por campo
// ---------------------------------------------------------
function limpiarFormularioRegistro() {
    // Obtenemos cada elemento por su ID y lo vaciamos
    if(document.getElementById('reg-nombreAlumno')) document.getElementById('reg-nombreAlumno').value = "";
    if(document.getElementById('reg-apePaterAlumno')) document.getElementById('reg-apePaterAlumno').value = "";
    if(document.getElementById('reg-apeMaterAlumno')) document.getElementById('reg-apeMaterAlumno').value = "";
    if(document.getElementById('reg-dniAlumno')) document.getElementById('reg-dniAlumno').value = "";
    if(document.getElementById('reg-fechaNacimiento')) document.getElementById('reg-fechaNacimiento').value = "";
    if(document.getElementById('reg-telefonoApoderado')) document.getElementById('reg-telefonoApoderado').value = "";
    if(document.getElementById('reg-direccionAlumno')) document.getElementById('reg-direccionAlumno').value = "";
}

function abrirModal(idModal, alumno = null) {
    alumnoSeleccionado = alumno;
    const modal = document.getElementById(idModal);
    modal.classList.remove('hidden');
    
    // Si abrimos el modal de agregar, forzamos la limpieza manual
    if (idModal === 'agregar-modal') {
        limpiarFormularioRegistro(); 
    }
    
    if (idModal === 'editar-modal' && alumno) {
        document.getElementById('edit-idAlumno').value = alumno.idAlumno || ''; 
        document.getElementById('edit-nombreAlumno').value = alumno.nombreAlumno || '';
        document.getElementById('edit-apePaterAlumno').value = alumno.apePaterAlumno || '';
        document.getElementById('edit-apeMaterAlumno').value = alumno.apeMaterAlumno || ''; 
        document.getElementById('edit-dniAlumno').value = alumno.dniAlumno || '';
        document.getElementById('edit-direccionAlumno').value = alumno.direccionAlumno || '';
        document.getElementById('edit-telefonoApoderado').value = alumno.telefonoApoderado || '';
        document.getElementById('edit-fechaNacimiento').value = alumno.fechaNacimiento || '';
    }

    if (idModal === 'eliminar-modal' && alumno) {
        document.getElementById('alumno-a-eliminar').textContent = `${alumno.nombreAlumno} ${alumno.apePaterAlumno} ${alumno.apeMaterAlumno}`;
    }
}

function cerrarModal(idModal) {
    document.getElementById(idModal).classList.add('hidden');
    alumnoSeleccionado = null;
}

async function registrarAlumno(event) {
    event.preventDefault();
    const form = event.target;
    
    const data = {
        nombreAlumno: cifrarDES(form['reg-nombreAlumno'].value),
        apePaterAlumno: cifrarDES(form['reg-apePaterAlumno'].value),
        apeMaterAlumno: cifrarDES(form['reg-apeMaterAlumno'].value),
        dniAlumno: form['reg-dniAlumno'].value,
        direccionAlumno: form['reg-direccionAlumno'].value,
        telefonoApoderado: form['reg-telefonoApoderado'].value,
        fechaNacimiento: form['reg-fechaNacimiento'].value,
        estado: 1
    };
    
    const url = 'http://localhost:8083/alumnos/registrar';
    const token = obtenerToken();

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (response.ok && result.resultado === 'ok') {
            mostrarAlerta(result.mensaje, 'success');
            
            // Limpieza manual tras éxito
            limpiarFormularioRegistro(); 
            
            cerrarModal('agregar-modal');
            cargarTablaAlumnos(); 
        } else {
            throw new Error(result.mensaje || 'Error al registrar el alumno.');
        }
    } catch (error) {
        mostrarAlerta(`Error de registro: ${error.message}`, 'error');
    }
}

async function actualizarAlumno(event) {
    event.preventDefault();
    const form = event.target;
    
    const data = {
        idAlumno: parseInt(form['edit-idAlumno'].value),
        nombreAlumno: cifrarDES(form['edit-nombreAlumno'].value),
        apePaterAlumno: cifrarDES(form['edit-apePaterAlumno'].value),
        apeMaterAlumno: cifrarDES(form['edit-apeMaterAlumno'].value),
        dniAlumno: form['edit-dniAlumno'].value,
        direccionAlumno: form['edit-direccionAlumno'].value,
        telefonoApoderado: form['edit-telefonoApoderado'].value,
        fechaNacimiento: form['edit-fechaNacimiento'].value,
        estado: 1
    };

    const url = 'http://localhost:8083/alumnos/update';
    const token = obtenerToken();

    try {
        const response = await fetch(url, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (response.ok && result.resultado === 'ok') {
            mostrarAlerta(result.mensaje, 'success');
            cerrarModal('editar-modal');
            cargarTablaAlumnos(); 
        } else {
            throw new Error(result.mensaje || 'Error al actualizar el alumno.');
        }
    } catch (error) {
        mostrarAlerta(`Error de actualización: ${error.message}`, 'error');
    }
}

async function confirmarEliminarAlumno() {
    if (!alumnoSeleccionado || !alumnoSeleccionado.idAlumno) return;

    const data = {
        idAlumno: alumnoSeleccionado.idAlumno
    };

    const url = 'http://localhost:8083/alumnos/delete';
    const token = obtenerToken();

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (response.ok && result.resultado === 'ok') {
            mostrarAlerta(result.mensaje, 'success');
            cerrarModal('eliminar-modal');
            cargarTablaAlumnos(); 
        } else {
            throw new Error(result.mensaje || 'Error al eliminar el alumno.');
        }
    } catch (error) {
        mostrarAlerta(`Error de eliminación: ${error.message}`, 'error');
    }
}

async function cargarTablaAlumnos() {
    const tbody = document.getElementById('alumnos-tbody');
    const token = sessionStorage.getItem('token'); 
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorAlert = document.getElementById('error-alert');

    loadingIndicator.classList.remove('hidden');
    errorAlert.classList.add('hidden'); 
    tbody.innerHTML = ''; 

    if (!token) {
        loadingIndicator.classList.add('hidden');
        errorAlert.innerHTML = '⚠️ Error de Sesión: Token no encontrado. Redirigiendo al login...';
        errorAlert.classList.remove('hidden');
        setTimeout(() => { window.location.href = 'index.html'; }, 3000); 
        return;
    }

    const url = 'http://localhost:8083/alumnos/listar';

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            }
        });

        if (response.status === 401) { 
            throw new Error(`Acceso denegado (401). Token inválido o expirado.`);
        }
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const alumnosActivos = data.filter(alumno => alumno.estado === 1);
        
        if (alumnosActivos.length === 0) {
              tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-gray-500 italic">No se encontraron alumnos activos en el sistema.</td></tr>';
        }

        alumnosActivos.forEach(alumno => {
            const nombreDescifrado = descifrarDES(alumno.nombreAlumno);
            const apePaternoDescifrado = descifrarDES(alumno.apePaterAlumno);
            const apeMaternoDescifrado = descifrarDES(alumno.apeMaterAlumno);
            const edad = calcularEdad(alumno.fechaNacimiento);

            const fila = document.createElement('tr');
            fila.classList.add('hover:bg-blue-50', 'transition-colors', 'duration-200');

            const alumnoDescifrado = {
                ...alumno, 
                nombreAlumno: nombreDescifrado,
                apePaterAlumno: apePaternoDescifrado,
                apeMaterAlumno: apeMaternoDescifrado 
            };
            
            const alumnoData = JSON.stringify(alumnoDescifrado).replace(/"/g, '&quot;'); 

            fila.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">${nombreDescifrado}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${apePaternoDescifrado}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${apeMaternoDescifrado}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${alumno.dniAlumno}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${alumno.telefonoApoderado}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-school-base bg-blue-50/50 rounded-lg text-center">${edad}</td>
                
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div class="flex justify-center space-x-3">
                        <button onclick="abrirModal('editar-modal', JSON.parse('${alumnoData}'))" 
                                class="text-school-base hover:text-blue-900 p-2 rounded-full hover:bg-blue-100 transition-all duration-200 shadow-sm border border-gray-200"
                                title="Editar">
                            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.283-8.283z" />
                            </svg>
                        </button>
                        <button onclick="abrirModal('eliminar-modal', JSON.parse('${alumnoData}'))"
                                class="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-all duration-200 shadow-sm border border-gray-200"
                                title="Eliminar">
                            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.166L15.9 5.25A2.25 2.25 0 0013.812 3H12.67M16.5 6L14.74 9m-4.788 0L9.26 9m-2.185 0L6.16 6m7.91-3.21c.342.052.682.107 1.022.166m-1.022-.166L15.9 5.25M6.16 6L7.54 9m-4.788 0L9.26 9M7.54 9L6.16 6m7.91-3.21c.342.052.682.107 1.022.166M7.5 14.25V5.25h9V14.25m4.5-9v13.5A2.25 2.25 0 0118.75 20.25H5.25A2.25 2.25 0 013 18.75V5.25M14.25 6h-4.5m4.5 0H18.75" />
                            </svg>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(fila);
        });

    } catch (error) {
        console.error("Error al cargar la lista de alumnos:", error);
        errorAlert.innerHTML = `❌ **Error al cargar los datos:** ${error.message}.`;
        errorAlert.classList.remove('hidden');

    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', cargarTablaAlumnos);