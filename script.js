import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ====== CONFIGURAÇÃO FIREBASE ======
const firebaseConfig = { 
    apiKey: "COLE_AQUI", 
    authDomain: "seu-app.firebaseapp.com",
    projectId: "seu-app"
}; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
let usuarioLogadoId = null;

// ====== VARIÁVEIS GLOBAIS DA APLICAÇÃO ======
window.dados = {
    salario: 0,
    despesas: [{nome: "Aluguel", valor: 1500}, {nome: "Energia", valor: 250}],
    metas: [{nome: "Reserva Emergência", valorAlvo: 5000, porcentagemSobra: 50}]
};

let chartDoughnut, chartLargo, chartArea;
let sobraAtual = 0;
window.graficoCriado = false; 

// ====== SISTEMA ANTI-TRAVAMENTO (DEBOUNCE) ======
// Isso impede que o gráfico e os cálculos travem o campo enquanto você digita
let timeoutCalculo;
window.agendarCalculo = function() {
    clearTimeout(timeoutCalculo);
    timeoutCalculo = setTimeout(() => {
        window.calcularTudo();
    }, 400); // Aguarda 400ms de "silêncio" na digitação para atualizar a tela
};

// ====== FUNÇÕES DE AUTENTICAÇÃO ======
window.entrarComoConvidado = function() {
    usuarioLogadoId = null;
    window.abrirDashboard("Convidado", "https://cdn-icons-png.flaticon.com/512/149/149071.png", "Acesso local sem salvamento em nuvem", true);
};

window.entrarComGoogle = function() {
    if (firebaseConfig.apiKey === "COLE_AQUI") {
        alert("Para o Google funcionar, insira suas chaves do Firebase.");
        window.entrarComoConvidado();
        return;
    }
    
    signInWithPopup(auth, provider).then(async (res) => {
        usuarioLogadoId = res.user.uid;
        const docRef = doc(db, "usuarios", usuarioLogadoId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) { window.dados = docSnap.data(); } 
        else { await setDoc(docRef, window.dados); }

        window.abrirDashboard(res.user.displayName, res.user.photoURL, res.user.email, false);
    }).catch((err) => {
        console.error("Erro no Auth:", err);
        alert("Erro ao fazer login com o Google.");
    });
};

window.salvarDadosFire = async function() {
    if (!usuarioLogadoId) {
        alert("Você está no modo Convidado. Faça login com o Google para salvar na nuvem.");
        return;
    }
    const botao = document.getElementById('btn-salvar-nuvem');
    botao.textContent = "⏳ Salvando...";
    try {
        await setDoc(doc(db, "usuarios", usuarioLogadoId), window.dados);
        botao.textContent = "✅ Salvo!";
        setTimeout(() => botao.textContent = "💾 Salvar na Nuvem", 3000);
    } catch (error) {
        console.error("Erro: ", error);
        botao.textContent = "❌ Erro";
    }
};

// ====== NAVEGAÇÃO E DASHBOARD ======
window.mudarMenu = function(idMenu, elementoClicado) {
    document.querySelectorAll('.nav-menu a').forEach(btn => btn.classList.remove('ativo'));
    if(elementoClicado) elementoClicado.classList.add('ativo');

    const telaOp = document.getElementById('tela-operacional');
    const telaUser = document.getElementById('tela-usuario');
    
    telaOp.style.display = 'none';
    telaUser.style.display = 'none';
    document.querySelectorAll('.sub-aba').forEach(aba => aba.classList.remove('ativa'));

    if (idMenu === 'usuario') {
        telaUser.style.display = 'block'; 
    } else {
        telaOp.style.display = 'grid'; 
        
        if (idMenu === 'inicio') {
            document.getElementById('aba-inicio').classList.add('ativa');
        } else if (idMenu === 'meta') {
            document.getElementById('aba-meta').classList.add('ativa');
        } else if (idMenu === 'cotacao') {
            document.getElementById('aba-cotacao').classList.add('ativa');
            if(!window.graficoCriado) {
                window.atualizarGraficoTV();
                window.graficoCriado = true;
            }
        }
    }
}

window.abrirDashboard = function(nome, urlFoto, email, isConvidado = false) {
    const login = document.getElementById('tela-login');
    const dash = document.getElementById('main-dashboard');

    document.getElementById('nome-usuario').textContent = `Olá, ${nome.split(' ')[0]}`;
    const avatarUrl = urlFoto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    document.getElementById('foto-usuario').src = avatarUrl; document.getElementById('foto-usuario').style.display = 'block';
    document.getElementById('img-dash-user').src = avatarUrl;
    document.getElementById('nome-dash-user').textContent = nome;
    document.getElementById('email-dash-user').textContent = email;

    if(isConvidado) {
        document.getElementById('tipo-conta-badge').textContent = "Modo Convidado (Não Salva na Nuvem)";
        document.getElementById('tipo-conta-badge').style.background = "var(--glow-red)";
        document.getElementById('tipo-conta-badge').style.color = "var(--accent-red)";
    }

    document.getElementById('salario').value = window.dados.salario || '';

    login.classList.add('fade-out');
    setTimeout(() => {
        login.style.display = 'none';
        dash.style.display = 'block';
        dash.classList.add('fade-in-up');
        window.initCharts();
        window.renderDespesas();
        window.renderMetas();
        window.calcularTudo();
        window.buscarCotacoes();
    }, 600);
}

// ====== TRADINGVIEW & COTAÇÕES ======
window.atualizarGraficoTV = function() {
    const moeda1 = document.getElementById('moeda1').value || "BTC";
    const moeda2 = document.getElementById('moeda2').value || "BRL";
    if(moeda1 === moeda2) return;

    document.getElementById('tradingview_container').innerHTML = ''; 
    if (typeof TradingView !== "undefined") {
        new TradingView.widget({
            "autosize": true, "symbol": moeda1 + moeda2, "interval": "D", "timezone": "America/Sao_Paulo", "theme": "dark", "style": "1", "locale": "br", "enable_publishing": false, "backgroundColor": "rgba(18, 18, 24, 0.65)", "gridColor": "rgba(255, 255, 255, 0.05)", "hide_top_toolbar": false, "hide_volume": true, "save_image": false, "container_id": "tradingview_container"
        });
    }
}

window.buscarCotacoes = async function() {
    try {
        const resposta = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL');
        const apiData = await resposta.json();
        document.getElementById('cotacao-dolar').textContent = `R$ ${parseFloat(apiData.USDBRL.bid).toFixed(2).replace('.', ',')}`;
        document.getElementById('cotacao-euro').textContent = `R$ ${parseFloat(apiData.EURBRL.bid).toFixed(2).replace('.', ',')}`;
        document.getElementById('cotacao-btc').textContent = `R$ ${parseFloat(apiData.BTCBRL.bid).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    } catch (erro) {
        console.error("Erro nas cotações:", erro);
    }
}

// ====== LÓGICA DO CHART.JS ======
window.initCharts = function() {
    if (typeof Chart === "undefined") return;

    Chart.defaults.color = '#9a9ab0'; 
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)'; 
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    if(chartDoughnut) { chartDoughnut.destroy(); chartLargo.destroy(); chartArea.destroy(); }

    const ctx1 = document.getElementById('meuGrafico').getContext('2d');
    chartDoughnut = new Chart(ctx1, { 
        type: 'doughnut', 
        data: { labels: [], datasets: [{ data: [], backgroundColor: ['#33ffb8', '#33e0ff', '#ff6677', '#ffd700', '#a55eea', '#ff9f43'], borderWidth: 0, hoverOffset: 4 }] }, 
        options: { plugins: { legend: { position: 'right', labels: { color: '#f0f0f5', font: { size: 12 }, padding: 15 } } }, cutout: '75%', maintainAspectRatio: false } 
    });

    const ctx2 = document.getElementById('graficoLargo').getContext('2d');
    chartLargo = new Chart(ctx2, { 
        type: 'bar', data: { labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'], datasets: [ { label: 'Ganhos', data: [40, 50, 45, 60, 55, 70], backgroundColor: '#33ffb8', borderRadius: 6 }, { label: 'Gastos', data: [30, 35, 40, 40, 45, 50], backgroundColor: 'rgba(51, 224, 255, 0.6)', borderRadius: 6 } ] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } 
    });

    const ctx3 = document.getElementById('graficoArea').getContext('2d');
    chartArea = new Chart(ctx3, { 
        type: 'line', data: { labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6'], datasets: [{ label: 'Patrimônio', data: [10, 30, 25, 50, 40, 90], borderColor: '#33ffb8', backgroundColor: 'rgba(51, 255, 184, 0.2)', fill: 'origin', tension: 0.4, borderWidth: 3, pointBackgroundColor: '#121214', pointBorderColor: '#33ffb8', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6 }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } 
    });
}

// ====== ATUALIZAÇÃO DE VARIÁVEIS (COM DELAY ANTI-TRAVAMENTO) ======
window.atualizarSalario = function(valor) { window.dados.salario = valor; window.agendarCalculo(); };
window.atualizarDespesaNome = function(index, valor) { window.dados.despesas[index].nome = valor; window.agendarCalculo(); };
window.atualizarDespesaValor = function(index, valor) { window.dados.despesas[index].valor = valor; window.agendarCalculo(); };
// NOVO: Função para atualizar o nome da meta
window.atualizarMetaNome = function(index, valor) { window.dados.metas[index].nome = valor; window.agendarCalculo(); };
window.atualizarMetaPorcentagem = function(index, valor) { window.dados.metas[index].porcentagemSobra = valor; window.agendarCalculo(); };

window.calcularTudo = function() {
    const sal = parseFloat(window.dados.salario) || 0;
    const despTotal = window.dados.despesas.reduce((a, b) => a + (parseFloat(b.valor) || 0), 0);
    sobraAtual = sal - despTotal;

    const elemSobra = document.getElementById('resultado-sobra'); 
    const elemLabel = document.getElementById('label-sobra'); 
    const elemCard = document.getElementById('status-card');

    if (elemSobra && elemLabel && elemCard) {
        if (sobraAtual < 0) {
            elemSobra.className = "valor-gigante text-bright-red"; elemLabel.className = "uppercase-label text-bright-red"; 
            elemLabel.textContent = "Déficit Mensal"; elemCard.style.borderColor = "var(--accent-red)"; elemCard.style.boxShadow = "0 8px 32px var(--glow-red)";
        } else {
            elemSobra.className = "valor-gigante text-green"; elemLabel.className = "uppercase-label text-green"; 
            elemLabel.textContent = "Sobra Mensal Estimada"; elemCard.style.borderColor = "var(--accent-green)"; elemCard.style.boxShadow = "0 8px 32px var(--glow-green)";
        }
        elemSobra.textContent = sobraAtual.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    }

    window.dados.metas.forEach((m, i) => {
        const valorAporte = sobraAtual > 0 ? sobraAtual * (m.porcentagemSobra / 100) : 0;
        const prog = document.getElementById(`prog-${i}`); const txt = document.getElementById(`txt-${i}`);
        if(prog && txt) { prog.value = m.valorAlvo > 0 ? (valorAporte / m.valorAlvo) * 100 : 0; txt.textContent = valorAporte.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}); }
    });

    if(chartDoughnut) { 
        const totalGastos = window.dados.despesas.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0);
        chartDoughnut.data.labels = window.dados.despesas.map(d => {
            const valor = parseFloat(d.valor) || 0;
            const porcentagem = totalGastos > 0 ? Math.round((valor / totalGastos) * 100) : 0;
            return [d.nome || "Sem nome", `${porcentagem}%`]; 
        }); 
        chartDoughnut.data.datasets[0].data = window.dados.despesas.map(d => parseFloat(d.valor) || 0); 
        chartDoughnut.update(); 
    }
}

// ====== FUNÇÕES DE INJEÇÃO HTML (CORRIGIDAS) ======
window.renderDespesas = function() {
    // Usando flex para garantir as proporções corretas (Nome grande, Valor médio, X pequeno)
    document.getElementById('lista-despesas').innerHTML = window.dados.despesas.map((d, i) => `
        <div class="input-row" style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px;">
            <input type="text" value="${d.nome}" onchange="window.atualizarDespesaNome(${i}, this.value)" style="flex: 2; min-width: 0;" placeholder="Nome">
            <input type="number" value="${d.valor}" onchange="window.atualizarDespesaValor(${i}, this.value)" style="flex: 1; min-width: 0;" placeholder="R$">
            <button type="button" class="btn-delete" onclick="window.deletarDespesa(${i})" title="Excluir Gasto" style="flex: 0 0 auto; width: 35px; height: 35px; margin: 0; padding: 0;">✖</button>
        </div>`).join('');
}

window.renderMetas = function() {
    // Transformei o nome em input e separei o X para o lado direito usando flexbox
    document.getElementById('lista-metas').innerHTML = window.dados.metas.map((m, i) => `
        <div class="meta-item" style="padding: 22px;">
            <div class="meta-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                
                <input type="text" value="${m.nome}" onchange="window.atualizarMetaNome(${i}, this.value)" placeholder="Nome da Meta" style="background: transparent; border: none; border-bottom: 1px dashed var(--border-light); color: var(--text-main); font-weight: 700; font-size: 16px; outline: none; flex: 1; margin-right: 15px; font-family: inherit; padding-bottom: 4px;">
                
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span id="txt-${i}" class="text-blue strong-value">R$ 0,00</span>
                    <button type="button" class="btn-delete" onclick="window.deletarMeta(${i})" title="Excluir Meta" style="position: static; margin: 0; padding: 4px 8px;">✖</button>
                </div>

            </div>
            <label class="uppercase-label text-muted">Aporte Mensal (% da sobra)</label>
            <input type="number" value="${m.porcentagemSobra}" onchange="window.atualizarMetaPorcentagem(${i}, this.value)">
            <progress id="prog-${i}" value="0" max="100"></progress>
        </div>`).join('');
}

// ====== FUNÇÕES PARA ADICIONAR E DELETAR ======
window.addDespesa = function() { window.dados.despesas.push({nome: "", valor: 0}); window.renderDespesas(); window.calcularTudo(); }
window.addMeta = function() { window.dados.metas.push({nome: "Nova Meta", valorAlvo: 1000, porcentagemSobra: 10}); window.renderMetas(); window.calcularTudo(); }

window.deletarDespesa = function(index) {
    window.dados.despesas.splice(index, 1);
    window.renderDespesas(); 
    window.calcularTudo(); 
}

window.deletarMeta = function(index) {
    window.dados.metas.splice(index, 1);
    window.renderMetas();
    window.calcularTudo();
}
