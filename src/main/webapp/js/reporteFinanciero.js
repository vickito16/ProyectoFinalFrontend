// --- CONFIGURACIÓN TAILWIND ---
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

// --- SEGURIDAD Y UTILIDADES ---
const CLAVE_SECRETA_DES = "MiClaveSecreta123456"; 

function descifrarDES(textoCifrado) {
    if (!textoCifrado) return ""; 
    try {
        const bytes  = CryptoJS.DES.decrypt(textoCifrado, CLAVE_SECRETA_DES);
        const textoOriginal = bytes.toString(CryptoJS.enc.Utf8);
        return textoOriginal || textoCifrado;
    } catch (e) { 
        return textoCifrado; 
    }
}

function obtenerToken() {
    const token = sessionStorage.getItem('token');
    return token ? token : "";
}

// --- VARIABLES GLOBALES ---
let datosGlobales = { matriculas: [], transacciones: [] };
let chartsInstances = {}; 

// --- LOGICA BACKEND ---
async function cargarDatosDelBackend() {
    const token = obtenerToken();
    const urlMatriculas = 'http://localhost:8083/matriculas/listar';
    
    try {
        const response = await fetch(urlMatriculas, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error al cargar matrículas');
        const dataMatriculas = await response.json();

        const activos = dataMatriculas.filter(m => m.estado === 1);
        datosGlobales.matriculas = activos;

        let listaTransaccionesTemp = [];
        const promesasCuotas = activos.map(async (alumno) => {
            try {
                const urlCuotas = `http://localhost:8083/cuotas/listar/${alumno.idMatricula}`;
                const resCuotas = await fetch(urlCuotas, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
                });
                
                if(resCuotas.ok) {
                    const cuotas = await resCuotas.json();
                    const nombreCompleto = `${descifrarDES(alumno.nombresAlumno)} ${descifrarDES(alumno.apePatAlumno)}`;

                    cuotas.forEach(cuota => {
                        const esPagado = cuota.estadoPago === 1;
                        listaTransaccionesTemp.push({
                            id: `TRX-${cuota.idCuota || Math.floor(Math.random()*1000)}`, 
                            alumno: nombreCompleto,
                            concepto: cuota.nombreConcepto,
                            fecha: new Date().toISOString().split('T')[0], 
                            monto: cuota.precio,
                            estado: esPagado ? 'Pagado' : 'Pendiente',
                            anioAcademico: alumno.anioAcademico 
                        });
                    });
                }
            } catch (err) { console.error(err); }
        });

        await Promise.all(promesasCuotas);
        datosGlobales.transacciones = listaTransaccionesTemp;

        // Al terminar la carga, inicializamos todo
        filtrarPorAnio();

    } catch (error) {
        console.error("Error general:", error);
        alert("Error cargando reporte: " + error.message);
    }
}

// --- LOGICA DE GRAFICOS ---
function procesarDatosGraficos(anioFiltro = 'Todos') {
    const ingresosPorAnio = {};
    const alumnosPorAnio = {};

    let transacciones = datosGlobales.transacciones;
    if (anioFiltro !== 'Todos') {
        transacciones = transacciones.filter(t => t.anioAcademico == anioFiltro);
    }

    transacciones.forEach(t => {
        if (t.estado === 'Pagado') {
            const anio = t.anioAcademico || 'N/A';
            ingresosPorAnio[anio] = (ingresosPorAnio[anio] || 0) + t.monto;
        }
    });

    let matriculas = datosGlobales.matriculas;
    if (anioFiltro !== 'Todos') {
        matriculas = matriculas.filter(m => m.anioAcademico == anioFiltro);
    }

    matriculas.forEach(m => {
        const anio = m.anioAcademico || 'N/A';
        alumnosPorAnio[anio] = (alumnosPorAnio[anio] || 0) + 1;
    });

    const aniosOrdenados = [...new Set([...Object.keys(ingresosPorAnio), ...Object.keys(alumnosPorAnio)])].sort();

    return {
        labels: aniosOrdenados,
        dataIngresos: aniosOrdenados.map(a => ingresosPorAnio[a] || 0),
        dataAlumnos: aniosOrdenados.map(a => alumnosPorAnio[a] || 0)
    };
}

function inicializarGraficos(anioParaGraficar = 'Todos') {
    const datos = procesarDatosGraficos(anioParaGraficar);
    const colores = ['#1e3a8a', '#c2a45a', '#10B981', '#F59E0B', '#EF4444', '#6366F1']; 

    const crearChart = (id, tipo, label, data, colors, isPie = false) => {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        if (chartsInstances[id]) chartsInstances[id].destroy();

        chartsInstances[id] = new Chart(ctx, {
            type: tipo,
            data: {
                labels: datos.labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: isPie ? colors : colors[0],
                    borderColor: isPie ? '#ffffff' : 'transparent',
                    borderWidth: 2,
                    borderRadius: isPie ? 0 : 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: isPie, position: 'right' }
                },
                scales: isPie ? {} : { y: { beginAtZero: true } }
            }
        });
    };

    crearChart('chartGananciasBar', 'bar', 'Ganancia (S/.)', datos.dataIngresos, colores);
    crearChart('chartGananciasPie', 'doughnut', 'Distribución Ganancias', datos.dataIngresos, colores, true);
    crearChart('chartAlumnosBar', 'bar', 'Cantidad Alumnos', datos.dataAlumnos, [colores[1]]);
    crearChart('chartAlumnosPie', 'pie', 'Distribución Alumnos', datos.dataAlumnos, colores, true);
}

// --- FILTRADO ---
function filtrarPorAnio() {
    const select = document.getElementById('filtroGlobalAnio');
    const anioSeleccionado = select.value;
    
    inicializarGraficos(anioSeleccionado);

    let alumnosFiltrados = datosGlobales.matriculas;
    let transaccionesFiltradas = datosGlobales.transacciones;

    if (anioSeleccionado !== 'Todos') {
        alumnosFiltrados = datosGlobales.matriculas.filter(m => m.anioAcademico == anioSeleccionado);
        transaccionesFiltradas = datosGlobales.transacciones.filter(t => t.anioAcademico == anioSeleccionado);
    }

    document.getElementById('kpi-matriculados').textContent = alumnosFiltrados.length;

    const totalIngresos = transaccionesFiltradas
        .filter(t => t.estado === 'Pagado')
        .reduce((sum, t) => sum + t.monto, 0);

    document.getElementById('kpi-ingresos').textContent = `S/. ${totalIngresos.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function irVolver() {
    window.location.href = 'principalDirector.html';
}

window.onload = function() {
    const usuario = sessionStorage.getItem("usuario");
    if(usuario) document.getElementById("directorName").innerText = usuario;
    cargarDatosDelBackend();
}