// --- CONFIGURACIÓN TAILWIND ---
tailwind.config = {
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'], serif: ['Playfair Display', 'serif'] },
            colors: { school: { base: '#1e3a8a', accent: '#c2a45a', dark: '#172554', light: '#eff6ff' } }
        },
    },
};

// --- CRIPTOGRAFÍA ---
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

function conectarChat() {
    console.log("🔄 Conectando...");
    const socket = new SockJS('http://localhost:8083/chat-websocket');
    stompClient = Stomp.over(socket);
    
    // Inicializar Crypto antes de conectar
    CryptoManager.init().then(() => {
        stompClient.connect({}, function(frame) {
            console.log('✅ Conectado');
            stompClient.send("/app/registrar", {}, miUsuario);

            // 1. HANDSHAKE: Enviar mi clave
            CryptoManager.getPublicKeyJWK().then(jwk => {
                const payload = {
                    loEnvia: miUsuario,
                    mensaje: "KEY|" + JSON.stringify(jwk),
                    targetUsername: usuarioDestino
                };
                stompClient.send("/app/private", {}, JSON.stringify(payload));
            });

            // 2. Suscribirse
            stompClient.subscribe('/user/topic/private', function(mensajeRecibido) {
                const cuerpo = JSON.parse(mensajeRecibido.body);
                const textoRaw = cuerpo.mensaje; // Ejemplo: "Soporte Escolar: KEY|{...}"

                // LÓGICA CORREGIDA: Buscar el tag sin importar el prefijo del usuario
                if (textoRaw.includes("KEY|")) {
                    // Extraer JSON desde donde empieza KEY|
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
        }, function(error) { console.error("❌ Error WS:", error); });
    });
}

function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();

    if (msg && stompClient && stompClient.connected) {
        // ENCRIPTAR
        const msgCifrado = CryptoManager.encrypt(msg);

        const payload = {
            loEnvia: miUsuario,
            mensaje: msgCifrado,
            targetUsername: usuarioDestino 
        };
        stompClient.send("/app/private", {}, JSON.stringify(payload));
        renderMensajeEnviado(msg);
        input.value = '';
        
        const container = document.getElementById('chat-messages');
        container.scrollTop = container.scrollHeight;
    } else { alert("Sin conexión."); }
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