// Configuración de Tailwind
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
                }
            }
        },
    },
};

// ==========================================
// LÓGICA 
// ==========================================

let onAlertOkCallback = null;

function showAlert(message, onOkCallback = null) {
    document.getElementById("alertMessage").textContent = message;
    onAlertOkCallback = onOkCallback;
    const modal = document.getElementById("customAlert");
    
    // Asegurar que el botón OK sea visible por defecto (para errores)
    // Se ocultará manualmente solo en el caso de éxito
    document.getElementById("alertOkButton").style.display = "inline-flex";

    modal.style.display = "flex";
    
    // Reiniciar animación del check cada vez que se abre
    const svg = document.getElementById("checkSvg");
    if(svg) {
        const newSvg = svg.cloneNode(true);
        svg.parentNode.replaceChild(newSvg, svg);
    }
}

function hideAlert() {
    document.getElementById("customAlert").style.display = "none";
    if (typeof onAlertOkCallback === 'function') {
        onAlertOkCallback();
        onAlertOkCallback = null;
    }
}

// === REGISTRO TRADICIONAL ===
async function registrarUsuario(event) {
    event.preventDefault();

    const login = document.getElementById("login").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!login || !password) {
        showAlert("Todos los campos son obligatorios.");
        return;
    }

    const data = { login, password };

    try {
        const response = await fetch("http://localhost:8083/usuarios/registrar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        console.log("Respuesta del servidor:", result);

        if (result.resultado === "ok") {
            const mensajeExito = "Usuario registrado"; 
            
            // 1. Mostrar la alerta con el mensaje
            showAlert(mensajeExito);

            // 2. Ocultar el botón OK para que sea solo visual
            document.getElementById("alertOkButton").style.display = "none";

            // 3. Redirigir después de 3 segundos
            setTimeout(() => {
                window.location.href = "index.html";
            }, 3000);

        } else {
            showAlert(result.mensaje || "Error al registrar el usuario.");
        }

    } catch (error) {
        console.error("Error en fetch:", error);
        showAlert("Error de conexión con el servidor. Revisa la consola.");
    }
}

// === REGISTRO CON GOOGLE ===
function handleCredentialResponse(response) {
    const jwtToken = response.credential;

    fetch("http://localhost:8083/usuarios/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: jwtToken })
    })
    .then(res => res.json())
    .then(data => {
        console.log("Respuesta OAuth:", data);
        if (data.resultado === "ok") {
            sessionStorage.setItem("usuario", data.objeto?.email || "usuario_google");
            window.location.href = "principal.html";
        } else {
            showAlert(data.mensaje || "Error al iniciar sesión con Google.");
        }
    })
    .catch(err => {
        console.error("Error en OAuth:", err);
        showAlert("Error al conectar con el backend OAuth.");
    });
}

window.onload = function () {
    google.accounts.id.initialize({
        client_id: "74783531981-7vjpiqvvr7vkh3qnnivpubnrmutnfvsf.apps.googleusercontent.com",
        callback: handleCredentialResponse
    });

    document.getElementById("alertOkButton").addEventListener("click", hideAlert);
};