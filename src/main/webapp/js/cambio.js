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

function obtenerToken() {
    const token = sessionStorage.getItem('token');
    return token ? token : "";
}

window.onload = function() {
    const usuario = sessionStorage.getItem("usuario");
    if (usuario) {
        document.getElementById("bienvenida").innerText = "Bienvenido estimado " + usuario;
    } else {
        alert("No hay sesión activa. Inicia sesión nuevamente.");
        window.location.href = "index.html";
    }
};

function volverAlMenu() {
    const rol = sessionStorage.getItem("rol");
    if (rol === "DIRECTOR") {
        window.location.href = "principalDirector.html";
    } else {
        window.location.href = "principal.html";
    }
}

async function cambiarClave() {
    const login = sessionStorage.getItem("usuario");
    const claveActual = document.getElementById("claveActual").value;
    const nuevaClave = document.getElementById("nuevaClave").value;
    const confirmarClave = document.getElementById("confirmarClave").value;
    const token = obtenerToken();

    if (!claveActual || !nuevaClave || !confirmarClave) {
        alert("Por favor completa todos los campos.");
        return;
    }
    if (nuevaClave !== confirmarClave) {
        alert("Las contraseñas nuevas no coinciden.");
        return;
    }

    try {
        const response = await fetch("http://localhost:8083/usuarios/cambiarClave", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                login: login,
                claveActual: claveActual,
                nuevaClave: nuevaClave,
                confirmaClave: confirmarClave
            })
        });

        const data = await response.json();

        if (data.resultado === "ok" || data.tipo === "ok") {
            document.getElementById("mensajeUsuario").innerText = "La contraseña de " + login + " fue cambiada correctamente.";
            const modal = document.getElementById("modalExito");
            modal.classList.remove("hidden");
            modal.style.display = "flex"; // Forzamos flex para el centrado
        } else {
            alert(data.mensaje || "Error al cambiar la contraseña.");
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Error en la conexión con el servidor.");
    }
}

function cerrarModal() {
    document.getElementById("modalExito").style.display = "none";
    window.location.href = "index.html";
}