import {initializeApp} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {getFirestore, doc, getDoc} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCdErSKPFZ1s4exAc0Zl8I_YIhiCiGVwCc",
    authDomain: "superid-pi3-t5-5-c1d5a.firebaseapp.com",
    projectId: "superid-pi3-t5-5-c1d5a",
    appId: "1:168243291412:android:291927a9f4de7c26778e01"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Função para pegar parâmetro da URL
function getUrlParameter(name) {
    name = name.replace(/[[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Função para chamar getLoginStatus
async function checkLoginStatus(tokenId) {
    try {
        const response = await fetch(`https://your-firebase-function-url/apiV2/getLoginStatus?loginToken=${tokenId}`);
        const data = await response.json();

        if (data.success && data.status === "authenticated") {
            // Se autenticado, mostra os detalhes automaticamente
            showLoginDetails();
        }
    } catch (error) {
        console.error("Erro ao verificar status de login:", error);
    }
}

// Função para mostrar os detalhes
async function showLoginDetails() {
    const tokenId = getUrlParameter('token');
    const loginInfo = document.getElementById('loginInfo');
    const statusCard = document.getElementById('statusCard');

    if (!tokenId) {
        loginInfo.innerHTML = '<div style="color: #F44336;">Token de autenticação não encontrado</div>';
        statusCard.style.display = 'block';
        return;
    }

    try {
        const loginRef = doc(db, "loginRequests", tokenId);
        const loginSnap = await getDoc(loginRef);

        if (!loginSnap.exists()) {
            loginInfo.innerHTML = '<div style="color: #F44336;">Autenticação não encontrada no sistema</div>';
            statusCard.style.display = 'block';
            return;
        }

        const loginData = loginSnap.data();

        let htmlContent = `
                    <div class="user-info">
                        <div class="info-row">
                            <div class="info-label">Token:</div>
                            <div class="info-value">${tokenId}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Site Parceiro:</div>
                            <div class="info-value">${loginData.url || 'N/A'}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Usuário:</div>
                            <div class="info-value">${loginData.userEmail || 'N/A'}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">UID:</div>
                            <div class="info-value">${loginData.user || 'N/A'}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Dispositivo:</div>
                            <div class="info-value">${loginData.deviceId || 'N/A'}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Autenticado em:</div>
                            <div class="info-value timestamp">${
            loginData.authenticatedAt ?
                new Date(loginData.authenticatedAt.toDate()).toLocaleString('pt-BR') :
                'N/A'
        }</div>
                        </div>
                    </div>
                `;

        loginInfo.innerHTML = htmlContent;
        statusCard.style.display = 'block';

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        loginInfo.innerHTML = `<div style="color: #F44336;">Erro ao carregar dados: ${error.message}</div>`;
        statusCard.style.display = 'block';
    }
}

// Configura o botão e verifica o status ao carregar
document.addEventListener('DOMContentLoaded', () => {
    const btnDetails = document.getElementById('btnDetails');
    btnDetails.addEventListener('click', showLoginDetails);

    // Verifica o token na URL ao carregar a página
    const tokenId = getUrlParameter('token');
    if (tokenId) {
        checkLoginStatus(tokenId);
    }
});