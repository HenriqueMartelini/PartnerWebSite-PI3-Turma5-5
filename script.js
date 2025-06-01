import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    doc,
    onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCdErSKPFZ1s4exAc0Zl8I_YIhiCiGVwCc",
    authDomain: "superid-pi3-t5-5-c1d5a.firebaseapp.com",
    projectId: "superid-pi3-t5-5-c1d5a",
    appId: "1:168243291412:android:291927a9f4de7c26778e01"
};

const PARTNER_API_KEY = "9jpV5HGHrfrHITLG49XZY6OU";
const MAX_QR_ATTEMPTS = 3;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const superidBtn = document.getElementById("superidBtn");
const superidSection = document.getElementById("superidSection");
const qrCodeImg = document.getElementById("qrcode");
const timerElement = document.getElementById("timer");
const statusElement = document.getElementById("status");
const emailForm = document.getElementById("emailForm");
const generateQRCodeBtn = document.getElementById("generateQRCodeBtn");
const qrCodeCounter = document.getElementById("qrCodeCounter");
const loginTokenInput = document.getElementById("loginToken");

// State variables
let qrCodeAttempts = 0;
let currentLoginToken = null;
let timerInterval = null;
let authCheckInterval = null;
let unsubscribeAuthListener = null;

// Utility Functions
function showAlert(message, isSuccess = false) {
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.color = isSuccess ? 'green' : 'red';
    }
}

function clearQRCode() {
    if (qrCodeImg) {
        qrCodeImg.src = '';
        qrCodeImg.style.display = 'none';
    }
    if (timerElement) {
        timerElement.textContent = '';
    }
    clearInterval(timerInterval);
    clearInterval(authCheckInterval);
    if (unsubscribeAuthListener) {
        unsubscribeAuthListener();
        unsubscribeAuthListener = null;
    }
}

function startTimer(expiresAt) {
    clearInterval(timerInterval);

    function updateTimer() {
        const now = new Date();
        const expires = new Date(expiresAt);
        const diff = expires - now;

        if (diff <= 0) {
            clearInterval(timerInterval);
            showAlert("QR Code expirado. Clique em 'Continuar com SuperID' para gerar um novo.");
            if (timerElement) timerElement.textContent = "Expirado!";
            clearQRCode();
            return;
        }

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        if (timerElement) {
            timerElement.textContent = `Expira em: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }
    }

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

// Authentication Functions
async function checkAuthStatus() {
    if (!currentLoginToken) return;

    try {
        const response = await fetch(`https://apiv2-jvxdqrpvpa-uc.a.run.app/getLoginStatus?loginToken=${currentLoginToken}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Erro ao verificar status');
        }

        if (data.status === "authenticated") {
            clearQRCode();
            showAlert("Autenticação realizada com sucesso! Redirecionando...", true);
            window.location.href = `/dashboard.html?token=${currentLoginToken}`;
        } else if (data.status === "pending") {
            showAlert("Aguardando autenticação...", true);
        } else {
            showAlert(`Status: ${data.status}`);
        }
    } catch (error) {
        console.error("Erro ao verificar status:", error);
    }
}

async function generateQRCode() {
    if (qrCodeAttempts >= MAX_QR_ATTEMPTS) {
        showAlert("Limite de QR Codes atingido");
        return;
    }

    try {
        showAlert("Gerando QR Code...", true);
        clearQRCode();

        const response = await fetch("https://apiv2-jvxdqrpvpa-uc.a.run.app/performAuth", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: PARTNER_API_KEY })
        });

        const responseData = await response.json();

        if (!response.ok || !responseData.success) {
            throw new Error(responseData.message || 'Erro ao gerar QR Code');
        }

        // Display QR Code
        if (qrCodeImg) {
            qrCodeImg.src = `data:image/png;base64,${responseData.qrCodeBase64}`;
            qrCodeImg.style.display = "block";
        }

        if (loginTokenInput) {
            loginTokenInput.value = responseData.loginToken;
        }

        showAlert("QR Code gerado com sucesso! Escaneie com o app SuperID", true);

        // Update attempts counter
        qrCodeAttempts++;
        if (qrCodeCounter) {
            qrCodeCounter.textContent = `QR Codes gerados: ${qrCodeAttempts}/${MAX_QR_ATTEMPTS}`;
        }

        // Set up authentication tracking
        currentLoginToken = responseData.loginToken;
        startTimer(responseData.expiresAt);

        // Setup Firebase listener
        const docRef = doc(db, "loginRequests", currentLoginToken);
        unsubscribeAuthListener = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().status === "authenticated") {
                clearQRCode();
                showAlert("Autenticação realizada com sucesso!", true);
                window.location.href = `/dashboard.html?token=${currentLoginToken}`;
            }
        });

        // Setup polling as fallback
        clearInterval(authCheckInterval);
        authCheckInterval = setInterval(checkAuthStatus, 2000);

    } catch (error) {
        console.error("Erro ao gerar QR Code:", error);
        showAlert(`Erro: ${error.message}`);
        clearQRCode();
    }
}

// Event Listeners
if (superidBtn && superidSection) {
    superidBtn.addEventListener("click", () => {
        superidSection.style.display = "block";
        generateQRCode();
    });
}

if (emailForm) {
    emailForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        console.log("Login tradicional com:", email, password);
    });
}

if (generateQRCodeBtn) {
    generateQRCodeBtn.addEventListener("click", generateQRCode);
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    if (generateQRCodeBtn) {
        generateQRCodeBtn.disabled = false;
    }
});