let stompClient = null;
const MY_USERNAME = "soporte"; 

// --- CRIPTOGRAFÍA MANUAL (MATH.RANDOM + BIGINT) ---
// Evita el bloqueo de window.crypto en HTTP
const ManualCrypto = {
    // Parámetros Diffie-Hellman (Grupo 5 RFC 3526 - simplificado para JS)
    prime: 0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA237327FFFFFFFFFFFFFFFFn,
    generator: 2n,

    userSecrets: {}, // Mapa: 'usuario' => 'secreto_hex'

    // Función auxiliar: Exponenciación Modular (base^exp % mod)
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

    // Generar un número aleatorio grande inseguro (Suficiente para demos)
    generatePrivateKey() {
        let hex = "1"; // Asegurar positivo
        for(let i=0; i<64; i++) {
            hex += Math.floor(Math.random() * 16).toString(16);
        }
        return BigInt("0x" + hex);
    },

    // Realiza el handshake matemático
    performServerHandshake(remoteUser, remotePublicKeyHex) {
        try {
            // 1. Generar mi Clave Privada (Random)
            const myPrivateKey = this.generatePrivateKey();

            // 2. Calcular mi Clave Pública: (G ^ Priv) % P
            const myPublicKey = this.modPow(this.generator, myPrivateKey, this.prime);

            // 3. Calcular Secreto Compartido: (Remoto ^ Priv) % P
            const remoteKeyBigInt = BigInt("0x" + remotePublicKeyHex);
            const sharedSecretBigInt = this.modPow(remoteKeyBigInt, myPrivateKey, this.prime);

            // 4. Convertir a Hex para usar en AES
            let secretHex = sharedSecretBigInt.toString(16);
            // Asegurar longitud para AES (tomamos los primeros 64 caracteres/32 bytes)
            if (secretHex.length < 64) secretHex = secretHex.padStart(64, '0');
            const finalSecret = secretHex.substring(0, 64);

            this.userSecrets[remoteUser] = finalSecret;
            console.log(`🔐 [ManualCrypto] Secreto calculado con ${remoteUser}`);

            // 5. Retornar mi pública en Hex
            return myPublicKey.toString(16);

        } catch (e) {
            console.error("Error Matemático:", e);
            return null;
        }
    },

    encrypt(user, message) {
        const secret = this.userSecrets[user];
        if (!secret) return message;
        // Usamos el Hex generado como clave directa para CryptoJS
        // Nota: CryptoJS.AES usa la string como passphrase si no se parsea, 
        // para máxima compatibilidad simple lo dejaremos como string passphrase.
        return "ENC|" + CryptoJS.AES.encrypt(message, secret).toString();
    },

    decrypt(user, ciphertext) {
        const secret = this.userSecrets[user];
        if (!secret || !ciphertext.includes("ENC|")) return ciphertext;
        const cleanCipher = ciphertext.substring(ciphertext.indexOf("ENC|") + 4);
        try {
            const bytes = CryptoJS.AES.decrypt(cleanCipher, secret);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch(e) { return "[Error descifrado]"; }
    },

    removeUserSession(user) {
        if (this.userSecrets[user]) delete this.userSecrets[user];
    }
};

// --- CONEXIÓN ---
function connect() {
    // AQUÍ: Asegúrate de poner la IP de tu servidor backend (ej. 192.168.0.110)
    // Si estás en la misma PC usa localhost, si es desde celular usa la IP.
    stompClient = new StompJs.Client({
        brokerURL: 'ws://localhost:8083/chat-websocket', // <--- IP DE TU BACKEND
        reconnectDelay: 5000,
        debug: (str) => console.log(str)
    });

    stompClient.onConnect = (frame) => {
        console.log('✅ Soporte Conectado');
        updateStatusUI(true);
        stompClient.publish({ destination: "/app/registrar", body: MY_USERNAME });

        stompClient.subscribe('/user/topic/private', function (messageOutput) {
            const cuerpo = JSON.parse(messageOutput.body);
            const textoRaw = cuerpo.contenido || cuerpo.mensaje;
            
            let remitente = cuerpo.loEnvia || "Anonimo";
            let contenido = textoRaw;

            if (textoRaw.includes(": ")) {
                const parts = textoRaw.split(": ");
                remitente = parts[0];
                contenido = parts.slice(1).join(": ");
            }

            // CASO 1: HANDSHAKE
            if (contenido.includes("HANDSHAKE_INIT|")) {
                const remoteKeyHex = contenido.substring(contenido.indexOf("|") + 1);
                
                // Usamos la nueva lógica manual
                const myPublicKeyHex = ManualCrypto.performServerHandshake(remitente, remoteKeyHex);

                if (myPublicKeyHex) {
                    const responsePayload = {
                        loEnvia: MY_USERNAME,
                        mensaje: "HANDSHAKE_ACK|" + myPublicKeyHex,
                        targetUsername: remitente
                    };
                    stompClient.publish({ destination: "/app/private", body: JSON.stringify(responsePayload) });
                }
            }
            // CASO 2: FIN SESIÓN
            else if (contenido.includes("END_SESSION")) {
                ManualCrypto.removeUserSession(remitente);
                renderIncomingMessage(remitente, "🔴 Usuario desconectado.");
            }
            // CASO 3: MENSAJE
            else if (contenido.includes("ENC|")) {
                const textoPlano = ManualCrypto.decrypt(remitente, contenido);
                renderIncomingMessage(remitente, textoPlano);
            } else {
                renderIncomingMessage(remitente, contenido);
            }
        });
    };

    stompClient.onWebSocketError = (e) => { console.error(e); updateStatusUI(false); };
    stompClient.activate();
}

// ... (Resto de funciones UI: updateStatusUI, renderIncomingMessage, etc. IGUAL QUE ANTES) ...
// Copia tus funciones UI existentes aquí abajo (renderIncomingMessage, enviarRespuesta, etc)
// Asegúrate de que en enviarRespuesta uses ManualCrypto.encrypt
function updateStatusUI(isConnected) {
    const indicator = document.getElementById("statusIndicator");
    const text = document.getElementById("statusText");
    if (isConnected) {
        indicator.className = "w-3 h-3 bg-green-400 rounded-full animate-pulse";
        text.innerText = `Online: ${MY_USERNAME}`;
    } else {
        indicator.className = "w-3 h-3 bg-red-500 rounded-full";
        text.innerText = "Desconectado";
    }
}

function renderIncomingMessage(remitente, mensaje) {
    const log = document.getElementById("messages-log");
    if(log.children[0]?.classList.contains("text-center")) log.innerHTML = "";

    const isSystem = mensaje.includes("desconectado");
    const lockIcon = isSystem ? "" : "🔒";
    const msgColor = isSystem ? "text-red-500 italic" : "text-gray-600";

    const html = `
        <div class="bg-white p-4 rounded-xl shadow border-l-4 ${isSystem ? 'border-red-400' : 'border-blue-500'} animate-[fadeIn_0.3s_ease-out]">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-gray-800 text-sm">${remitente} ${lockIcon}</h4>
                    <p class="${msgColor} mt-1">${mensaje}</p>
                    <span class="text-xs text-gray-400 mt-1 block">${new Date().toLocaleTimeString()}</span>
                </div>
                ${!isSystem ? `<button onclick="prepararRespuesta('${remitente}')" class="bg-blue-50 text-blue-600 px-3 py-1 rounded text-xs hover:bg-blue-100">Responder</button>` : ''}
            </div>
        </div>`;
    log.insertAdjacentHTML('beforeend', html);
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

    if (!target || !texto || !stompClient) return;

    // Encriptar respuesta CON MANUALCRYPTO
    const cifrado = ManualCrypto.encrypt(target, texto);

    const payload = {
        loEnvia: MY_USERNAME,
        mensaje: cifrado,
        targetUsername: target
    };

    stompClient.publish({ destination: "/app/private", body: JSON.stringify(payload) });

    const log = document.getElementById("messages-log");
    log.insertAdjacentHTML('beforeend', `
        <div class="bg-blue-50 p-3 rounded-xl self-end border border-blue-100 ml-10 mb-2">
            <div class="text-right">
                <span class="text-xs font-bold text-blue-800">Para: ${target} 🔒</span>
                <p class="text-sm text-gray-700">${texto}</p>
            </div>
        </div>
    `);
    log.scrollTop = log.scrollHeight;
    document.getElementById("replyMessage").value = "";
}

window.onload = connect;