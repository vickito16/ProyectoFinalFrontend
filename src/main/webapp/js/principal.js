// --- CONFIGURACIÓN TAILWIND ---
tailwind.config = {
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'], serif: ['Playfair Display', 'serif'] },
            colors: { school: { base: '#1e3a8a', accent: '#c2a45a', dark: '#172554', light: '#eff6ff' } }
        },
    },
};

// --- CRIPTOGRAFÍA (Sin Cambios) ---
const CryptoManager = {
    keyPair: null,
    sharedSecret: null,

    async init() {
        this.keyPair = await window.crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
        );
    },
    async getPublicKeyJWK() {
        return await window.crypto.subtle.exportKey("jwk", this.keyPair.publicKey);
    },
    async computeSecret(remotePublicKeyJWK) {
        const remoteKey = await window.crypto.subtle.importKey(
            "jwk", remotePublicKeyJWK, { name: "ECDH", namedCurve: "P-256" }, true, []
        );
        const bits = await window.crypto.subtle.deriveBits(
            { name: "ECDH", public: remoteKey }, this.keyPair.privateKey, 256
        );
        const buffer = new Uint8Array(bits);
        this.sharedSecret = Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
        console.log("🔒 Secreto compartido establecido.");
    },
    encrypt(message) {
        if (!this.sharedSecret) return message;
        return "ENC|" + CryptoJS.AES.encrypt(message, this.sharedSecret).toString();
    },
    decrypt(ciphertext) {
        if (!this.sharedSecret || !ciphertext.includes("ENC|")) return ciphertext;
        // Extraer solo la parte cifrada ignorando el prefijo de usuario si existe
        const cleanCipher = ciphertext.substring(ciphertext.indexOf("ENC|") + 4);
        try {
            const bytes = CryptoJS.AES.decrypt(cleanCipher, this.sharedSecret);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch(e) { return ciphertext; }
    }
};

// --- CHAT VARS ---
let stompClient = null;
let miUsuario = null;
const usuarioDestino = "soporte"; 

window.onload = function() {
    miUsuario = sessionStorage.getItem("usuario");
    const provider = sessionStorage.getItem("provider"); 

    if (!miUsuario) { window.location.href = "index.html"; } 
    else {
        document.getElementById("bienvenida").innerHTML = `Secretario(a), <span class="font-bold text-school-base">${miUsuario}</span>`;
        if (provider === "google" || provider === "facebook") {
            const btn = document.getElementById("btn-cambiar-clave");
            if(btn) btn.classList.add("hidden");
        }
        conectarChat();
    }
};

// --- FUNCIÓN DE CONEXIÓN ACTUALIZADA (Stomp v7 + WS Puro) ---
function conectarChat() {
    console.log("🔄 Conectando...");
    
    // Crear cliente Stomp v7
    stompClient = new StompJs.Client({
        brokerURL: 'ws://localhost:8083/chat-websocket', // Usa WS:// directo
        reconnectDelay: 5000,
        debug: (str) => console.log(str)
    });

    // Evento al conectar
    stompClient.onConnect = (frame) => {
        console.log('✅ Conectado');
        actualizarEstadoUI(true);

        // Inicializar criptografía tras conectar (o antes, pero aquí aseguramos flujo)
        CryptoManager.init().then(() => {
            
            // 1. Registrar usuario (.publish en lugar de .send)
            stompClient.publish({
                destination: "/app/registrar", 
                body: miUsuario
            });

            // 2. HANDSHAKE: Enviar mi clave pública
            CryptoManager.getPublicKeyJWK().then(jwk => {
                const payload = {
                    loEnvia: miUsuario,
                    mensaje: "KEY|" + JSON.stringify(jwk),
                    targetUsername: usuarioDestino
                };
                stompClient.publish({
                    destination: "/app/private", 
                    body: JSON.stringify(payload)
                });
            });

            // 3. Suscribirse
            stompClient.subscribe('/user/topic/private', function(mensajeRecibido) {
                const cuerpo = JSON.parse(mensajeRecibido.body);
                const textoRaw = cuerpo.mensaje; 

                // Lógica de criptografía (Handshake vs Mensaje)
                if (textoRaw.includes("KEY|")) {
                    const jsonStr = textoRaw.substring(textoRaw.indexOf("KEY|") + 4);
                    const remoteJWK = JSON.parse(jsonStr);
                    CryptoManager.computeSecret(remoteJWK);
                } 
                else if (textoRaw.includes("ENC|")) {
                    const descifrado = CryptoManager.decrypt(textoRaw);
                    renderMensajeRecibido(descifrado);
                    notificarVisualmente();
                } 
                else {
                    renderMensajeRecibido(textoRaw);
                    notificarVisualmente();
                }
            });
        });
    };

    // Manejo de errores
    stompClient.onWebSocketError = (error) => {
        console.error("❌ Error WS:", error);
        actualizarEstadoUI(false);
    };
    stompClient.onStompError = (frame) => {
        console.error("❌ Error Stomp:", frame.headers['message']);
        actualizarEstadoUI(false);
    };

    // Iniciar conexión
    stompClient.activate();
}

function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();

    // Verificación de conexión actualizada (v7 usa .connected)
    if (msg && stompClient && stompClient.connected) {
        // ENCRIPTAR
        const msgCifrado = CryptoManager.encrypt(msg);

        const payload = {
            loEnvia: miUsuario,
            mensaje: msgCifrado,
            targetUsername: usuarioDestino 
        };

        // ENVIAR (.publish en lugar de .send)
        stompClient.publish({
            destination: "/app/private",
            body: JSON.stringify(payload)
        });

        renderMensajeEnviado(msg);
        input.value = '';
        
        const container = document.getElementById('chat-messages');
        container.scrollTop = container.scrollHeight;
    } else { 
        alert("Sin conexión. Espere un momento..."); 
    }
}

// --- FUNCIONES UI AUXILIARES ---

function actualizarEstadoUI(conectado) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (conectado) {
        dot.className = "absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-school-base rounded-full";
        text.innerText = "En línea";
    } else {
        dot.className = "absolute bottom-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-school-base rounded-full";
        text.innerText = "Desconectado";
    }
}

function irACambioClave() { window.location.href = "cambio.html"; }

function cerrarSesion() {
    sessionStorage.removeItem("usuario");
    sessionStorage.removeItem("provider");
    window.location.href = "index.html";
}

function navegarA(url) { window.location.href = url; }

function notificarVisualmente() {
    const w = document.getElementById('chat-window');
    if (w.classList.contains('hidden')) toggleChat();
}

function toggleChat() {
    const w = document.getElementById('chat-window');
    w.classList.toggle('hidden');
    if(!w.classList.contains('hidden')) {
        const c = document.getElementById('chat-messages');
        c.scrollTop = c.scrollHeight;
    }
}

function renderMensajeEnviado(texto) {
    const c = document.getElementById('chat-messages');
    c.insertAdjacentHTML('beforeend', `
        <div class="flex justify-end mb-4 animate-[fadeIn_0.3s_ease-out]">
            <div class="bg-school-base text-white p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[280px]">
                <p class="text-sm">${texto}</p>
            </div>
        </div>`);
}

function renderMensajeRecibido(texto) {
    // Limpiar prefijo "Usuario: " para visualización
    let limpio = texto;
    if (texto.includes(": ")) limpio = texto.substring(texto.indexOf(": ") + 2);

    const c = document.getElementById('chat-messages');
    c.insertAdjacentHTML('beforeend', `
        <div class="flex items-start gap-2.5 mb-4 animate-[fadeIn_0.3s_ease-out]">
            <div class="w-8 h-8 rounded-full bg-school-base flex items-center justify-center text-white text-xs font-bold">S</div>
            <div class="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[280px]">
                <p class="text-sm text-gray-800">${limpio}</p>
            </div>
        </div>`);
    c.scrollTop = c.scrollHeight;
}