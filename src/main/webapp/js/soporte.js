let stompClient = null;
const MY_USERNAME = "soporte"; 

// --- CRIPTOGRAFÍA SOPORTE ---
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

function connect() {
    const socket = new SockJS('http://localhost:8083/chat-websocket');
    stompClient = Stomp.over(socket);
    
    stompClient.connect({}, function (frame) {
        console.log('✅ Soporte Conectado: ' + frame);
        stompClient.send("/app/registrar", {}, MY_USERNAME);

        stompClient.subscribe('/user/topic/private', async function (messageOutput) {
            const cuerpo = JSON.parse(messageOutput.body);
            const textoCompleto = cuerpo.mensaje; 
            
            let remitente = cuerpo.loEnvia || "Anonimo";
            let contenidoReal = textoCompleto;

            // CORRECCIÓN: Separar remitente del texto si el backend los concatena
            if (textoCompleto.includes(": ")) {
                const partes = textoCompleto.split(": ");
                remitente = partes[0]; 
                // Unir el resto por si el mensaje contenía ": " también
                contenidoReal = partes.slice(1).join(": ");
            }

            if (contenidoReal.includes("KEY|")) {
                // Handshake recibido
                const jsonStr = contenidoReal.substring(contenidoReal.indexOf("KEY|") + 4);
                const remoteJWK = JSON.parse(jsonStr);
                const myPublicKey = await CryptoSupport.handleHandshake(remitente, remoteJWK);
                
                const payload = {
                    loEnvia: MY_USERNAME,
                    mensaje: "KEY|" + myPublicKey,
                    targetUsername: remitente
                };
                stompClient.send("/app/private", {}, JSON.stringify(payload));
            } 
            else if (contenidoReal.includes("ENC|")) {
                const textoPlano = CryptoSupport.decrypt(remitente, contenidoReal);
                renderIncomingMessage(remitente, textoPlano);
            } 
            else {
                renderIncomingMessage(remitente, contenidoReal);
            }
        });
    }, function(error) { console.error("❌ Error WS:", error); });
}

function renderIncomingMessage(remitente, mensaje) {
    const log = document.getElementById("messages-log");
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

    // ENCRIPTAR
    const textoCifrado = CryptoSupport.encrypt(target, texto);
    const payload = { loEnvia: MY_USERNAME, mensaje: textoCifrado, targetUsername: target };

    stompClient.send("/app/private", {}, JSON.stringify(payload));

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
    document.getElementById("replyMessage").value = "";
}

window.onload = connect;