let stompClient = null;
const MY_USERNAME = "soporte"; 

// --- CRIPTOGRAFÍA SOPORTE (NO TOCAR - Lógica original) ---
const CryptoSupport = {
    userSecrets: {}, // Mapa: 'usuario' => 'secreto_hex'
    async handleHandshake(remoteUser, remoteJWK) {
        const keyPair = await window.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
        const remoteKey = await window.crypto.subtle.importKey("jwk", remoteJWK, { name: "ECDH", namedCurve: "P-256" }, true, []);
        const bits = await window.crypto.subtle.deriveBits({ name: "ECDH", public: remoteKey }, keyPair.privateKey, 256);
        const buffer = new Uint8Array(bits);
        const secret = Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
        
        this.userSecrets[remoteUser] = secret;
        console.log(`🔒 Secreto establecido con ${remoteUser}`);

        const myPublicKeyJWK = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
        return JSON.stringify(myPublicKeyJWK);
    },
    decrypt(user, ciphertext) {
        const secret = this.userSecrets[user];
        if (!secret || !ciphertext.includes("ENC|")) return ciphertext;
        const cleanCipher = ciphertext.substring(ciphertext.indexOf("ENC|") + 4);
        try {
            const bytes = CryptoJS.AES.decrypt(cleanCipher, secret);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch(e) { return "[Error al descifrar]"; }
    },
    encrypt(user, message) {
        const secret = this.userSecrets[user];
        if (!secret) return message;
        return "ENC|" + CryptoJS.AES.encrypt(message, secret).toString();
    }
};

// --- CONEXIÓN WEB SOCKET (Refactorizado a Stomp v7 Puro) ---
function connect() {
    // 1. Crear el cliente
    stompClient = new StompJs.Client({
        brokerURL: 'ws://localhost:8083/chat-websocket', // CAMBIO IMPORTANTE: ws:// directo
        reconnectDelay: 5000,
        debug: (str) => console.log(str)
    });

    // 2. Definir comportamiento al conectar
    stompClient.onConnect = (frame) => {
        console.log('✅ Soporte Conectado: ' + frame);
        updateStatusUI(true);

        // Registrar usuario
        stompClient.publish({
            destination: "/app/registrar",
            body: MY_USERNAME
        });

        // Suscribirse a mensajes privados
        stompClient.subscribe('/user/topic/private', async function (messageOutput) {
            const cuerpo = JSON.parse(messageOutput.body);
            const textoCompleto = cuerpo.mensaje; 
            
            let remitente = cuerpo.loEnvia || "Anonimo";
            let contenidoReal = textoCompleto;

            // Separar remitente del texto si viene concatenado
            if (textoCompleto.includes(": ")) {
                const partes = textoCompleto.split(": ");
                remitente = partes[0]; 
                contenidoReal = partes.slice(1).join(": ");
            }

            // Lógica de procesamiento de mensajes (Handshake vs Encriptado vs Texto)
            if (contenidoReal.includes("KEY|")) {
                // Handshake recibido
                const jsonStr = contenidoReal.substring(contenidoReal.indexOf("KEY|") + 4);
                const remoteJWK = JSON.parse(jsonStr);
                const myPublicKey = await CryptoSupport.handleHandshake(remitente, remoteJWK);
                
                // Responder con mi clave pública
                const payload = {
                    loEnvia: MY_USERNAME,
                    mensaje: "KEY|" + myPublicKey,
                    targetUsername: remitente
                };
                stompClient.publish({
                    destination: "/app/private",
                    body: JSON.stringify(payload)
                });
            } 
            else if (contenidoReal.includes("ENC|")) {
                // Mensaje encriptado recibido
                const textoPlano = CryptoSupport.decrypt(remitente, contenidoReal);
                renderIncomingMessage(remitente, textoPlano);
            } 
            else {
                // Mensaje normal
                renderIncomingMessage(remitente, contenidoReal);
            }
        });
    };

    // 3. Manejo de errores
    stompClient.onWebSocketError = (error) => {
        console.error('❌ Error WS:', error);
        updateStatusUI(false);
    };
    stompClient.onStompError = (frame) => {
        console.error('❌ Error Stomp:', frame.headers['message']);
        updateStatusUI(false);
    };

    // 4. Activar cliente
    stompClient.activate();
}

// --- INTERFAZ DE USUARIO ---

function updateStatusUI(isConnected) {
    const indicator = document.getElementById("statusIndicator");
    const text = document.getElementById("statusText");
    const log = document.getElementById("messages-log");

    if (isConnected) {
        indicator.className = "w-3 h-3 bg-green-400 rounded-full animate-pulse";
        text.innerText = `Conectado como: ${MY_USERNAME}`;
        if(log.innerText.includes("Esperando conexión")) log.innerHTML = `<div class="text-center text-gray-400 text-sm italic mt-10">Esperando mensajes de estudiantes...</div>`;
    } else {
        indicator.className = "w-3 h-3 bg-red-500 rounded-full";
        text.innerText = "Desconectado";
    }
}

function renderIncomingMessage(remitente, mensaje) {
    const log = document.getElementById("messages-log");
    // Limpiar mensaje de espera si existe
    if(log.children[0]?.classList.contains("text-center")) log.innerHTML = "";

    const cardHTML = `
        <div class="bg-white p-4 rounded-xl shadow border-l-4 border-blue-500 animate-[fadeIn_0.5s_ease-out]">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-gray-800 text-lg">${remitente} <span class="text-xs text-green-600 font-normal border border-green-200 bg-green-50 px-1 rounded">🔒 Seguro</span></h4>
                    <p class="text-gray-600 mt-1">${mensaje}</p>
                    <span class="text-xs text-gray-400 mt-2 block">${new Date().toLocaleTimeString()}</span>
                </div>
                <button onclick="prepararRespuesta('${remitente}')" class="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-lg text-sm font-medium transition-colors border border-blue-200">Responder</button>
            </div>
        </div>`;
    log.insertAdjacentHTML('beforeend', cardHTML);
    log.scrollTop = log.scrollHeight;
}

function prepararRespuesta(usuario) {
    document.getElementById("targetUser").value = usuario;
    document.getElementById("replyMessage").focus();
}

function enviarRespuesta(e) {
    e.preventDefault();
    const target = document.getElementById("targetUser").value.trim();
    const texto = document.getElementById("replyMessage").value.trim();

    if (!target || !texto) return;

    if (!stompClient || !stompClient.connected) {
        alert("Error: No hay conexión con el servidor.");
        return;
    }

    // ENCRIPTAR
    const textoCifrado = CryptoSupport.encrypt(target, texto);
    
    // Payload para el backend
    const payload = { 
        loEnvia: MY_USERNAME, 
        mensaje: textoCifrado, 
        targetUsername: target 
    };

    // ENVÍO (Usando .publish)
    stompClient.publish({
        destination: "/app/private",
        body: JSON.stringify(payload)
    });

    // Renderizar mi propia respuesta en el chat
    const log = document.getElementById("messages-log");
    const myMsgHTML = `
        <div class="bg-school-base/10 p-4 rounded-xl border border-school-base/20 self-end ml-10">
            <div class="flex flex-col items-end">
                <h4 class="font-bold text-school-base text-sm">Tú respondiste a ${target} (🔒):</h4>
                <p class="text-gray-800 mt-1 text-right">${texto}</p>
                <span class="text-xs text-gray-400 mt-1">${new Date().toLocaleTimeString()}</span>
            </div>
        </div>`;
    log.insertAdjacentHTML('beforeend', myMsgHTML);
    log.scrollTop = log.scrollHeight;
    
    // Limpiar input
    document.getElementById("replyMessage").value = "";
}

// Iniciar al cargar la página
window.onload = connect;