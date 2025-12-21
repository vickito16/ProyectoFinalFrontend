tailwind.config = {
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'], serif: ['Playfair Display', 'serif'] },
            colors: {
                school: { base: '#1e3a8a', accent: '#c2a45a', dark: '#172554', light: '#eff6ff' }
            }
        },
    },
};

const CLAVE_SECRETA_DES = "MiClaveSecreta123456";
let currentAlumnoId = null;

function descifrarDES(textoCifrado) {
    if (!textoCifrado) return "";
    try {
        const bytes = CryptoJS.DES.decrypt(textoCifrado, CLAVE_SECRETA_DES);
        return bytes.toString(CryptoJS.enc.Utf8) || textoCifrado;
    } catch (e) { return textoCifrado; }
}

function irAInicio() {
    window.location.href = 'principal.html';
}

function actualizarGrados() {
    const nivel = document.getElementById('nivel').value;
    const gradoSelect = document.getElementById('grado');
    gradoSelect.innerHTML = '<option value="">Seleccione Grado...</option>';
    const grados = nivel === 'primaria' ? 
        [{id:1,n:'1° Prim'},{id:2,n:'2° Prim'},{id:3,n:'3° Prim'},{id:4,n:'4° Prim'},{id:5,n:'5° Prim'},{id:6,n:'6° Prim'}] :
        (nivel === 'secundaria' ? [{id:7,n:'1° Sec'},{id:8,n:'2° Sec'},{id:9,n:'3° Sec'},{id:10,n:'4° Sec'},{id:11,n:'5° Sec'}] : []);
    
    grados.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.n;
        gradoSelect.appendChild(opt);
    });
}

function actualizarContador() {
    document.getElementById('contador').textContent = `${document.getElementById('observacion').value.length} / 100`;
}

// === WIZARD LOGIC (ACTUALIZADA) ===
let currentStep = 1;

function updateUI() {
    // 1. Mostrar/Ocultar Contenedores
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step-${currentStep}`).classList.remove('hidden');
    
    // 2. Actualizar Indicadores Superiores (Círculos y Textos)
    for (let i = 1; i <= 3; i++) {
        const circle = document.getElementById(`circle-${i}`);
        const text = document.getElementById(`text-${i}`);
        
        if (i <= currentStep) {
            // Activo (Azul Institucional)
            circle.className = "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors duration-300 bg-school-base text-white border-2 border-school-base";
            text.className = "text-xs mt-2 font-bold text-school-base bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded shadow-sm";
        } else {
            // Inactivo (Gris oscuro para mejor contraste)
            circle.className = "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors duration-300 bg-gray-300 text-gray-700 border-2 border-gray-300";
            text.className = "text-xs mt-2 font-medium text-gray-300 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded";
        }
    }

    // 3. Actualizar Barras de Progreso
    const line2 = document.getElementById('line-2');
    if (currentStep >= 2) {
        line2.className = "absolute left-0 top-1/2 transform -translate-y-1/2 w-1/2 h-1 -z-10 transition-colors duration-500 bg-school-base";
    } else {
        line2.className = "absolute left-0 top-1/2 transform -translate-y-1/2 w-1/2 h-1 -z-10 transition-colors duration-500 bg-gray-300";
    }

    const line3 = document.getElementById('line-3');
    if (currentStep >= 3) {
        line3.className = "absolute left-1/2 top-1/2 transform -translate-y-1/2 w-1/2 h-1 -z-10 transition-colors duration-500 bg-school-base";
    } else {
        line3.className = "absolute left-1/2 top-1/2 transform -translate-y-1/2 w-1/2 h-1 -z-10 transition-colors duration-500 bg-gray-300";
    }
    
    // 4. Lógica de Botones
    const btnNext = document.getElementById('btnNext');
    const btnPrev = document.getElementById('btnPrev');

    // Botón Anterior: Visible si step > 1
    if (currentStep === 1) {
        btnPrev.style.opacity = '0';
        btnPrev.style.pointerEvents = 'none';
    } else {
        btnPrev.style.opacity = '1';
        btnPrev.style.pointerEvents = 'auto';
    }

    // Botón Siguiente / Confirmar
    if(currentStep === 3) {
        renderResumen(); 
        btnNext.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 mr-2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            CONFIRMAR
        `;
        btnNext.className = "bg-green-600 text-white px-8 py-2.5 rounded-lg hover:bg-green-700 transition-transform active:scale-95 shadow-lg font-bold tracking-wide flex items-center";
        btnNext.onclick = finalizarMatricula;
    } else {
        btnNext.textContent = "Siguiente";
        btnNext.className = "bg-school-base text-white px-8 py-2.5 rounded-lg hover:bg-school-dark transition-transform active:scale-95 shadow-lg font-medium";
        btnNext.onclick = nextStep;
    }
}

function nextStep() {
    if (validateCurrentStep()) {
        currentStep++;
        updateUI();
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateUI();
    }
}

function validateCurrentStep() {
    if (currentStep === 1) {
        if (!document.getElementById('dni').value || !document.getElementById('nombre').value) {
            showAlert("Debe buscar un alumno válido.", false); return false;
        }
    }
    if (currentStep === 2) {
        if (!document.getElementById('nivel').value || !document.getElementById('grado').value || !document.getElementById('anio').value) {
            showAlert("Complete los datos académicos.", false); return false;
        }
    }
    return true;
}

async function buscarAlumno() {
    const dni = document.getElementById('dni').value.trim();
    if(!dni) { showAlert("Ingrese DNI", false); return; }
    if(dni.length !== 8) { showAlert("El DNI debe tener 8 dígitos", false); return; }
    
    const btn = document.getElementById('btnBuscar');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    btn.disabled = true;

    try {
        const token = sessionStorage.getItem("token");
        const res = await fetch(`http://localhost:8083/alumnos/buscarDNI/${dni}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Alumno no encontrado o error de servidor");
        
        const data = await res.json();
        currentAlumnoId = data.idAlumno; 
        document.getElementById('nombre').value = descifrarDES(data.nombreAlumno);
        document.getElementById('apellido').value = `${descifrarDES(data.apePaterAlumno)} ${descifrarDES(data.apeMaterAlumno)}`;
    } catch (e) {
        console.error(e); showAlert(e.message, false);
        document.getElementById('nombre').value = "";
        document.getElementById('apellido').value = "";
    } finally {
        btn.innerHTML = originalText; btn.disabled = false;
    }
}

function renderResumen() {
    const nombre = document.getElementById('nombre').value;
    const apellido = document.getElementById('apellido').value;
    const dni = document.getElementById('dni').value;
    const nivel = document.getElementById('nivel').options[document.getElementById('nivel').selectedIndex].text;
    const grado = document.getElementById('grado').options[document.getElementById('grado').selectedIndex].text;
    const anio = document.getElementById('anio').value;
    const obs = document.getElementById('observacion').value || "Ninguna";

    document.getElementById('resumen-alumno').textContent = `${nombre} ${apellido}`;
    document.getElementById('resumen-dni').textContent = dni;
    document.getElementById('resumen-nivel').textContent = nivel;
    document.getElementById('resumen-grado').textContent = `${grado} - ${anio}`;
    document.getElementById('resumen-obs').textContent = obs;
}

async function finalizarMatricula() {
    const idGrado = document.getElementById('grado').value;
    const observacion = document.getElementById('observacion').value;
    const anioAcademico = document.getElementById('anio').value;

    const payload = {
        idAlumno: currentAlumnoId.toString(),
        idGrado: parseInt(idGrado),
        observacion: observacion,
        anioAcademico: anioAcademico
    };

    const btn = document.getElementById('btnNext');
    const originalBtn = btn.innerHTML;
    btn.innerHTML = "Procesando..."; btn.disabled = true;

    try {
        const token = sessionStorage.getItem("token");
        const res = await fetch("http://localhost:8083/matriculas/registrar", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.resultado === 'ok') {
            showSuccessAlert();
        } else {
            showWarningAlert(data.mensaje);
        }

    } catch (error) {
        console.error(error);
        showAlert("Error de conexión al procesar matrícula.", false);
    } finally {
        btn.innerHTML = originalBtn; btn.disabled = false;
    }
}

function showSuccessAlert() {
    const modal = document.getElementById("customAlert");
    document.getElementById("alertContent").innerHTML = `
        <div class="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-blue-50 mb-6">
            <svg class="w-12 h-12" viewBox="0 0 52 52"><circle class="check-anim-circle" cx="26" cy="26" r="25" fill="none"/><path class="check-anim-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/></svg>
        </div>
        <p class="text-gray-900 mb-2 text-2xl font-bold font-serif">¡Matrícula Exitosa!</p>
        <p class="text-gray-500 text-sm">Redirigiendo al panel principal...</p>
    `;
    modal.style.display = "flex";
    setTimeout(() => window.location.href = "principal.html", 3000);
}

function showWarningAlert(mensaje) {
    const modal = document.getElementById("customAlert");
    document.getElementById("alertContent").innerHTML = `
        <div class="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-yellow-50 mb-6">
            <svg class="w-12 h-12" viewBox="0 0 52 52"><circle class="warn-anim-circle" cx="26" cy="26" r="25" fill="none"/><path class="warn-anim-path" fill="none" d="M26 14v14m0 6h.01" stroke-linecap="round"/></svg>
        </div>
        <p class="text-gray-900 mb-2 text-xl font-bold font-serif text-yellow-700">Aviso de Matrícula</p>
        <p class="text-gray-600 text-md mb-6">${mensaje}</p>
        <button onclick="closeAlert()" class="w-full py-2 px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium">Entendido</button>
    `;
    modal.style.display = "flex";
}

function showAlert(msg) {
    const modal = document.getElementById("customAlert");
    document.getElementById("alertContent").innerHTML = `
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <svg class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <p class="text-gray-800 mb-6 text-lg font-medium">${msg}</p>
        <button onclick="closeAlert()" class="w-full py-2 px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-900">Cerrar</button>
    `;
    modal.style.display = "flex";
}

function closeAlert() { document.getElementById("customAlert").style.display = "none"; }

function validarInputDNI(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
    if (input.value.length > 8) {
        input.value = input.value.slice(0, 8);
    }
}

window.onload = function() {
    if (!sessionStorage.getItem("usuario")) window.location.href = "index.html";
    document.getElementById("adminName").textContent = sessionStorage.getItem("usuario");
    updateUI(); // Inicializar UI en paso 1
};