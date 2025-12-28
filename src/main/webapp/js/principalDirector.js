// --- CONFIGURACIÓN TAILWIND ---
tailwind.config = {
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'], serif: ['Playfair Display', 'serif'] },
            colors: { school: { base: '#1e3a8a', accent: '#c2a45a', dark: '#172554', light: '#eff6ff' } }
        },
    },
};

// --- CRIPTOGRAFÍA MANUAL (COMPATIBLE CON HTTP/IP) ---
const ManualCrypto = {
    // Primo gigante (RFC 3526 Grupo 5) para Diffie-Hellman
    prime: 0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA237327FFFFFFFFFFFFFFFFn,
    generator: 2n,
    
    myPrivateKey: null,
    sharedSecret: null,
    isHandshakeComplete: false,

    // Función matemática: (base^exp) % mod
    modPow(base, exp, mod) {
        let res = 1n;
        base %= mod;
        while (exp > 0n) {
            if (exp % 2n === 1n) res = (res * base) % mod;
            base = (base * base) % mod;
            exp /= 2n;
        }
        return res;
    },

    // Iniciar claves (Generar privada aleatoria)
    init() {
        let hex = "1"; // Asegurar positivo
        for(let i=0; i<64; i++) {
            hex += Math.floor(Math.random() * 16).toString(16);
        }
        this.myPrivateKey = BigInt("0x" + hex);
        console.log("🔑 [Director] Claves manuales generadas.");
    },

    // Obtener mi clave pública para enviar al servidor
    getPublicKeyHex() {
        // Publica = (G ^ Priv) % P
        const pub = this.modPow(this.generator, this.myPrivateKey, this.prime);
        return pub.toString(16);
    },

    // Calcular secreto compartido al recibir la clave del servidor
    finalizeHandshake(serverPublicKeyHex) {
        try {
            const serverKeyBigInt = BigInt("0x" + serverPublicKeyHex);
            // Secreto = (ServerPub ^ Priv) % P
            const sharedBigInt = this.modPow(serverKeyBigInt, this.myPrivateKey, this.prime);
            
            // Convertir a Hex para AES
            let secretHex = sharedBigInt.toString(16);
            if (secretHex.length < 64) secretHex = secretHex.padStart(64, '0');
            this.sharedSecret = secretHex.substring(0, 64);
            
            this.isHandshakeComplete = true;
            console.log("🔒 [Director] Handshake completado.");
            return true;
        } catch(e) {
            console.error("Error en handshake:", e);
            return false;
        }
    },

    encrypt(message) {
        if (!this.sharedSecret) return message;
        return "ENC|" + CryptoJS.AES.encrypt(message, this.sharedSecret).toString();
    },

    decrypt(ciphertext) {
        if (!this.sharedSecret || !ciphertext.includes("ENC|")) return ciphertext;
        const cleanCipher = ciphertext.substring(ciphertext.indexOf("ENC|") + 4);
        try {
            const bytes = CryptoJS.AES.decrypt(cleanCipher, this.sharedSecret);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch(e) { return "[Error descifrado]"; }
    }
};

// --- VARIABLES GLOBALES ---
let stompClient = null;
let miUsuario = null;
const usuarioDestino = "soporte"; 
let handshakeInterval = null;

// --- INICIO ---
window.onload = function() {
    miUsuario = sessionStorage.getItem("usuario");
    const provider = sessionStorage.getItem("provider"); 

    if (!miUsuario) { window.location.href = "index.html"; } 
    else {
        // DIFERENCIA: Saludo para Director
        document.getElementById("bienvenida").innerHTML = `Director(a), <span class="font-bold text-school-base">${miUsuario}</span>`;
        
        if (provider === "google" || provider === "facebook") {
            const btn = document.getElementById("btn-cambiar-clave");
            if(btn) btn.classList.add("hidden");
        }
        conectarChat();
    }
};

// --- CONEXIÓN WS ---
function conectarChat() {
    // ⚠️ ASEGÚRATE QUE ESTA IP SEA LA DE TU SERVIDOR BACKEND
    stompClient = new StompJs.Client({
        brokerURL: 'ws://localhost:8083/chat-websocket', 
        reconnectDelay: 5000,
        // debug: (str) => console.log(str) 
    });

    stompClient.onConnect = (frame) => {
        console.log('✅ Conectado a WS');
        actualizarEstadoUI(true); 

        // 1. Registrar usuario
        stompClient.publish({ destination: "/app/registrar", body: miUsuario });

        // 2. Iniciar Crypto y Handshake
        ManualCrypto.init();
        iniciarBucleHandshake();

        // 3. Suscribirse
        stompClient.subscribe('/user/topic/private', function(mensajeRecibido) {
            const cuerpo = JSON.parse(mensajeRecibido.body);
            const textoRaw = cuerpo.contenido || cuerpo.mensaje; 

            // A) RESPUESTA DEL HANDSHAKE
            if (textoRaw.includes("HANDSHAKE_ACK|")) {
                console.log("🤝 ACK de Soporte recibido.");
                if (handshakeInterval) clearInterval(handshakeInterval);
                
                const serverHex = textoRaw.substring(textoRaw.indexOf("|") + 1);
                
                if (ManualCrypto.finalizeHandshake(serverHex)) {
                    habilitarChatUI(true);
                }
            }
            // B) MENSAJE CIFRADO
            else if (textoRaw.includes("ENC|")) {
                const plano = ManualCrypto.decrypt(textoRaw);
                renderMensajeRecibido(plano);
                notificarVisualmente();
            }
            // C) MENSAJE NORMAL
            else {
                renderMensajeRecibido(textoRaw);
            }
        });
    };

    stompClient.onWebSocketError = () => { actualizarEstadoUI(false); };
    stompClient.activate();
}

// --- BUCLE DE HANDSHAKE ---
function iniciarBucleHandshake() {
    if (handshakeInterval) clearInterval(handshakeInterval);
    
    habilitarChatUI(false); 
    mostrarMensajeSistema("⏳ Conectando seguro con Soporte...");

    const myPubHex = ManualCrypto.getPublicKeyHex();

    const payload = {
        loEnvia: miUsuario,
        mensaje: "HANDSHAKE_INIT|" + myPubHex,
        targetUsername: usuarioDestino
    };

    const attemptHandshake = () => {
        if (ManualCrypto.isHandshakeComplete) return;
        console.log("📡 Enviando solicitud Handshake...");
        stompClient.publish({ destination: "/app/private", body: JSON.stringify(payload) });
    };

    attemptHandshake();
    handshakeInterval = setInterval(attemptHandshake, 3000);
}

// --- ENVIAR MENSAJE ---
function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();

    if (!ManualCrypto.isHandshakeComplete) {
        alert("Espere a que se establezca la conexión segura...");
        return;
    }

    if (msg && stompClient && stompClient.connected) {
        // Cifrar con ManualCrypto
        const cifrado = ManualCrypto.encrypt(msg);
        
        const payload = { 
            loEnvia: miUsuario, 
            mensaje: cifrado, 
            targetUsername: usuarioDestino 
        };
        
        stompClient.publish({ destination: "/app/private", body: JSON.stringify(payload) });

        renderMensajeEnviado(msg);
        input.value = '';
        const container = document.getElementById('chat-messages');
        container.scrollTop = container.scrollHeight;
    }
}

// --- UTILIDADES ---
function cerrarSesion() {
    if (stompClient && stompClient.connected) {
        const payload = { loEnvia: miUsuario, mensaje: "END_SESSION", targetUsername: usuarioDestino };
        stompClient.publish({ destination: "/app/private", body: JSON.stringify(payload) });
    }
    sessionStorage.clear();
    window.location.href = "index.html";
}

window.addEventListener("beforeunload", function (e) {
    if (stompClient && stompClient.connected) {
        const payload = { loEnvia: miUsuario, mensaje: "END_SESSION", targetUsername: usuarioDestino };
        stompClient.publish({ destination: "/app/private", body: JSON.stringify(payload) });
    }
});

function actualizarEstadoUI(online) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if(dot && text) {
        dot.className = online ? "absolute bottom-0 right-0 w-2.5 h-2.5 bg-yellow-400 border-2 border-school-base rounded-full" : "absolute bottom-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full";
        text.innerText = online ? "Conectando..." : "Sin Red";
    }
}

function habilitarChatUI(habilitado) {
    const input = document.getElementById('chat-input');
    const btn = document.querySelector('button[type="submit"]');
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');

    if (habilitado) {
        input.disabled = false;
        input.placeholder = "Escribe aquí...";
        btn.disabled = false;
        btn.classList.remove("opacity-50");
        mostrarMensajeSistema("🔒 Conexión segura establecida.");
        
        if(dot) dot.className = "absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-school-base rounded-full";
        if(text) text.innerText = "En línea (Seguro)";
    } else {
        input.disabled = true;
        input.placeholder = "Esperando a soporte...";
        btn.disabled = true;
        btn.classList.add("opacity-50");
    }
}

function mostrarMensajeSistema(texto) {
    const c = document.getElementById('chat-messages');
    const html = `<div class="flex justify-center mb-2 animate-pulse"><span class="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">${texto}</span></div>`;
    c.insertAdjacentHTML('beforeend', html);
    c.scrollTop = c.scrollHeight;
}

function renderMensajeEnviado(texto) {
    const c = document.getElementById('chat-messages');
    c.insertAdjacentHTML('beforeend', `<div class="flex justify-end mb-4 animate-[fadeIn_0.3s_ease-out]"><div class="bg-school-base text-white p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[280px]"><p class="text-sm">${texto}</p></div></div>`);
}

function renderMensajeRecibido(texto) {
    let limpio = texto;
    if (texto.includes(": ")) limpio = texto.substring(texto.indexOf(": ") + 2);
    const c = document.getElementById('chat-messages');
    c.insertAdjacentHTML('beforeend', `<div class="flex items-start gap-2.5 mb-4 animate-[fadeIn_0.3s_ease-out]"><div class="w-8 h-8 rounded-full bg-school-base flex items-center justify-center text-white text-xs font-bold">S</div><div class="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[280px]"><p class="text-sm text-gray-800">${limpio}</p></div></div>`);
    c.scrollTop = c.scrollHeight;
}

function toggleChat() {
    const w = document.getElementById('chat-window');
    w.classList.toggle('hidden');
    if(!w.classList.contains('hidden')) {
        const c = document.getElementById('chat-messages');
        c.scrollTop = c.scrollHeight;
    }
}
function notificarVisualmente() {
    const w = document.getElementById('chat-window');
    if (w.classList.contains('hidden')) toggleChat();
}
function irACambioClave() { window.location.href = "cambio.html"; }
function navegarA(url) { window.location.href = url; }