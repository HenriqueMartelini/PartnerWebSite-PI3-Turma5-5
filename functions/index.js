const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const qr = require("qr-image");
const express = require("express");
const cors = require("cors");

admin.initializeApp();

const app = express();

// Configuração CORS mais completa
app.use(cors({
    origin: true, // Permite qualquer origem
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Type']
}));

// Tratamento explícito de preflight requests (OPTIONS)
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(204);
});

app.use(express.json());

// Middleware para garantir headers CORS em todas as respostas
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
    } else {
        res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});

const DEV_MODE = true;
const HARDCODED_DOMAIN = "www.xptopartner.com";

async function validateApiKey(apiKey) {
    try {
        const usersRef = admin.firestore().collection("users");
        const usersSnapshot = await usersRef.get();

        for (const userDoc of usersSnapshot.docs) {
            const categoriesRef = userDoc.ref.collection("categories");
            const categoriesSnapshot = await categoriesRef.get();

            for (const categoryDoc of categoriesSnapshot.docs) {
                const loginsRef = categoryDoc.ref.collection("logins");
                const loginsSnapshot = await loginsRef.where("apiKey", "==", apiKey).get();

                if (!loginsSnapshot.empty) {
                    return true;
                }
            }
        }
        return false;
    } catch (error) {
        console.error("Erro ao validar API Key:", error);
        return false;
    }
}

app.post("/performAuth", async (req, res) => {
    try {
        const { apiKey } = req.body;

        if (!apiKey) {
            return res.status(400).json({
                success: false,
                message: "API Key é obrigatória"
            });
        }

        const parsedDomain = DEV_MODE ? HARDCODED_DOMAIN :
            (() => {
                const domain = req.headers.origin || req.headers.referer;
                try {
                    if (domain) {
                        const url = new URL(domain);
                        return url.hostname.startsWith('www.') ?
                            url.hostname :
                            `www.${url.hostname}`;
                    }
                } catch (e) {
                    console.error("Erro ao parsear domínio:", e);
                }
                return "";
            })();

        const isValid = await validateApiKey(apiKey);

        if (!isValid) {
            return res.status(403).json({
                success: false,
                message: "API Key inválida"
            });
        }

        // Cria a solicitação de login
        const loginRequestRef = admin.firestore().collection("loginRequests").doc();
        const loginToken = loginRequestRef.id;
        const expiresAt = Date.now() + 60 * 1000;

        await loginRequestRef.set({
            apiKey,
            domain: parsedDomain,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "pending",
            expiresAt: new Date(expiresAt)
        });

        // Gera o QR Code
        const qrCode = qr.image(loginToken, { type: 'png' });
        const chunks = [];

        qrCode.on('data', (chunk) => chunks.push(chunk));
        qrCode.on('end', () => {
            try {
                const qrCodeBuffer = Buffer.concat(chunks);
                const qrCodeBase64 = qrCodeBuffer.toString('base64');

                return res.json({
                    success: true,
                    loginToken,
                    qrCodeBase64,
                    expiresAt
                });
            } catch (err) {
                console.error("Erro ao processar QR Code:", err);
                return res.status(500).json({
                    success: false,
                    message: "Erro ao gerar QR Code"
                });
            }
        });
        qrCode.on('error', (err) => {
            console.error("Erro no stream do QR Code:", err);
            return res.status(500).json({
                success: false,
                message: "Erro ao gerar QR Code"
            });
        });

    } catch (error) {
        console.error("Erro na função performAuth:", error);
        return res.status(500).json({
            success: false,
            message: "Erro interno no servidor"
        });
    }
});

app.get("/getLoginStatus", async (req, res) => {
    try {
        const { loginToken } = req.query;

        if (!loginToken) {
            return res.status(400).json({
                success: false,
                message: "loginToken é obrigatório"
            });
        }

        const loginRef = admin.firestore().collection("loginRequests").doc(loginToken);
        const loginDoc = await loginRef.get();

        if (!loginDoc.exists) {
            return res.status(404).json({
                success: false,
                message: "Token não encontrado ou expirado"
            });
        }

        const loginData = loginDoc.data();

        // Verifica se o token expirou
        if (loginData.expiresAt && loginData.expiresAt.toDate() < new Date()) {
            await loginRef.delete();
            return res.status(410).json({
                success: false,
                message: "Token expirado"
            });
        }

        // Verifica se o login foi autenticado
        if (!loginData.user) {
            return res.json({
                success: true,
                status: "pending"
            });
        }

        // Login autenticado com sucesso - inclui todos os campos necessários
        return res.json({
            success: true,
            status: "authenticated",
            userUID: loginData.user,
            userEmail: loginData.userEmail,
            deviceId: loginData.deviceId,
            authenticatedAt: loginData.authenticatedAt?.toDate().toISOString()
        });

    } catch (error) {
        console.error("Erro na função getLoginStatus:", error);
        return res.status(500).json({
            success: false,
            message: "Erro interno no servidor"
        });
    }
});

exports.apiV2 = onRequest({
    cors: true,
    region: "us-central1"
}, app);