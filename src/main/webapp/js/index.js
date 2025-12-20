// Configuración de Tailwind con colores "Académicos"
tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                serif: ['Playfair Display', 'serif'],
            },
            colors: {
                school: {
                    base: '#1e3a8a', // Azul institucional oscuro
                    accent: '#c2a45a', // Dorado académico
                    dark: '#172554',
                }
            }
        },
    },
};

// --- LÓGICA JAVASCRIPT ---

function showAlert(message) {
    document.getElementById("alertMessage").textContent = message;
    document.getElementById("customAlert").style.display = "flex";
}

function hideAlert() {
    document.getElementById("customAlert").style.display = "none";
}

function handleAuthSuccess(token, messageString, provider) {
    if (token) {
        const parts = messageString.split('|');
        const nombreUsuario = parts[0];
        const rolUsuario = parts.length > 1 ? parts[1] : '';

        sessionStorage.setItem("usuario", nombreUsuario); 
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("provider", provider); 
        sessionStorage.setItem("rol", rolUsuario);

        if (rolUsuario === 'DIRECTOR') {
            window.location.href = "principalDirector.html";
        } else if (rolUsuario === 'SECRETARIA') {
            window.location.href = "principal.html";
        } else {
            window.location.href = "principal.html";
        }

    } else {
        console.error(`Login OK (${provider}), pero no se recibió token de la API.`);
        showAlert("Error de autenticación: No se recibió token del servidor.");
    }
}

function sendTokenToBackend(token, endpoint) {
    fetch(`http://localhost:8083/usuarios/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token })
    })
    .then(res => res.json())
    .then(data => {
        if (data.resultado === "ok") {
            const provider = 'google'; // Único proveedor externo restante
            handleAuthSuccess(data.token, data.mensaje, provider);
        } else {
            showAlert(`Error al autenticar: ${data.mensaje || 'Error desconocido'}`);
        }
    })
    .catch(err => {
        console.error("Error:", err);
        showAlert("Fallo al conectar con el backend OAuth.");
    });
}

async function iniciarSesion(event) {
    event.preventDefault();

    const login = document.getElementById("login").value.trim();
    const password = document.getElementById("password").value.trim();
    const data = { login, password };

    try {
        const response = await fetch("http://localhost:8083/usuarios/validacion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.resultado === "ok" && result.token) {
            handleAuthSuccess(result.token, result.mensaje, "local");
        } else {
            showAlert(result.mensaje || "Credenciales incorrectas.");
        }
    } catch (error) {
        console.error("Error:", error);
        showAlert("Error en la conexión o en el servidor.");
    }
}

function handleCredentialResponse(response) {
    const jwtToken = response.credential;
    sendTokenToBackend(jwtToken, "oauth"); 
}

window.onload = function () {
    google.accounts.id.initialize({
        client_id: "74783531981-7vjpiqvvr7vkh3qnnivpubnrmutnfvsf.apps.googleusercontent.com",
        callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(
        document.getElementById("googleSignInDiv"),
        { theme: "filled_blue", size: "large", text: "signin_with", width: 320, shape: "rectangular" }
    );

    document.getElementById("alertOkButton").addEventListener("click", hideAlert);
};