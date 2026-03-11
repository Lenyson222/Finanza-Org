let dados = {
    despesas: [{nome: "Aluguel", valor: 1500}, {nome: "Energia", valor: 250}],
    metas: [{nome: "Reserva Emergência", valorAlvo: 5000, porcentagemSobra: 50}]
};

let meuGrafico;
let abaAtual = 'aba-dashboard';

function entrar() {
    const login = document.getElementById('tela-login');
    const dash = document.getElementById('main-dashboard');
    
    login.classList.add('fade-out');
    
    setTimeout(() => {
        login.style.display = 'none';
        dash.style.display = 'block';
        dash.classList.add('slide-up');
        
        renderDespesas();
        renderMetas();
        calcularTudo();
    }, 800);
}

function mudarAba(abaId, elementoClicado) {
    abaAtual = abaId;

    const abas = document.querySelectorAll('.conteudo-aba');
    abas.forEach(aba => aba.style.display = 'none');

    document.getElementById(abaId).style.display = 'block';

    const links = document.querySelectorAll('.aba-link');
    links.forEach(link => link.classList.remove('ativo'));
    elementoClicado.classList.add('ativo');

    const tituloGrafico = document.getElementById('titulo-grafico');
    if (abaId === 'aba-dashboard') {
        tituloGrafico.textContent = 'Distribuição de Despesas';
    } else {
        tituloGrafico.textContent = 'Progresso das Metas';
    }

    atualizarGraficos();
}

function atualizarGraficos() {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    const tipoSelecionado = document.getElementById('tipoGrafico').value;

    if (meuGrafico) {
        meuGrafico.destroy();
    }

    let labelsGrafico = [];
    let dadosGrafico = [];
    let coresGrafico = ['#00f5a0', '#00d9ff', '#ff5e5e', '#ffd700', '#a55eea'];

    if (abaAtual === 'aba-dashboard') {
        labelsGrafico = dados.despesas.map(d => d.nome);
        dadosGrafico = dados.despesas.map(d => parseFloat(d.valor) || 0);
    } else if (abaAtual === 'aba-metas') {
        labelsGrafico = dados.metas.map(m => m.nome);
        const sal = parseFloat(document.getElementById('salario').value) || 0;
        const despTotal = dados.despesas.reduce((a, b) => a + (parseFloat(b.valor) || 0), 0);
        const sobra = Math.max(0, sal - despTotal);
        dadosGrafico = dados.metas.map(m => sobra * (m.porcentagemSobra / 100));
    }

    const configuracao = {
        type: tipoSelecionado,
        data: {
            labels: labelsGrafico,
            datasets: [{
                label: 'Valor (R$)',
                data: dadosGrafico,
                backgroundColor: tipoSelecionado === 'line' ? 'transparent' : coresGrafico,
                borderColor: tipoSelecionado === 'line' ? '#00f5a0' : coresGrafico,
                borderWidth: tipoSelecionado === 'line' ? 3 : 0,
                tension: 0.4,
                pointBackgroundColor: '#00f5a0'
            }]
        },
        options: {
            responsive: true,
            plugins: { 
                legend: { position: 'bottom', labels: { color: 'white', font: { size: 10 } } } 
            }
        }
    };

    if (tipoSelecionado === 'doughnut') {
        configuracao.options.cutout = '75%';
    }

    meuGrafico = new Chart(ctx, configuracao);
}

function calcularTudo() {
    const sal = parseFloat(document.getElementById('salario').value) || 0;
    const despTotal = dados.despesas.reduce((a, b) => a + (parseFloat(b.valor) || 0), 0);
    const sobra = Math.max(0, sal - despTotal);

    document.getElementById('resultado-sobra').textContent = sobra.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

    dados.metas.forEach((m, i) => {
        const valorAporte = sobra * (m.porcentagemSobra / 100);
        const prog = document.getElementById(`prog-${i}`);
        const txt = document.getElementById(`txt-${i}`);
        if(prog && txt) {
            prog.value = m.valorAlvo > 0 ? (valorAporte / m.valorAlvo) * 100 : 0;
            txt.textContent = valorAporte.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        }
    });

    atualizarGraficos();
}

function renderDespesas() {
    document.getElementById('lista-despesas').innerHTML = dados.despesas.map((d, i) => `
        <div class="linha-despesa" style="display:flex; gap:10px; margin-bottom: 10px;">
            <input type="text" value="${d.nome}" oninput="dados.despesas[${i}].nome=this.value; calcularTudo()" style="flex:2">
            <input type="number" value="${d.valor}" oninput="dados.despesas[${i}].valor=this.value; calcularTudo()" style="flex:1">
            <button onclick="removerDespesa(${i})" style="background:none; border:none; color:#ff5e5e; cursor:pointer; font-weight:bold;">X</button>
        </div>
    `).join('');
}

function renderMetas() {
    document.getElementById('lista-metas').innerHTML = dados.metas.map((m, i) => `
        <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 3px solid var(--accent-green);">
            <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                <input type="text" value="${m.nome}" oninput="dados.metas[${i}].nome=this.value; calcularTudo()" style="background:none; border:none; color:white; font-weight:bold; font-size:1rem; outline:none; width:60%;">
                <span id="txt-${i}" style="color:var(--accent-green); font-weight:bold;">R$ 0,00</span>
            </div>
            <label>Aporte Mensal (% da sobra)</label>
            <input type="number" value="${m.porcentagemSobra}" oninput="dados.metas[${i}].porcentagemSobra=this.value; calcularTudo()">
            <progress id="prog-${i}" value="0" max="100"></progress>
        </div>
    `).join('');
}

function addDespesa() { 
    dados.despesas.push({nome: "Nova Despesa", valor: 0}); 
    renderDespesas(); 
    calcularTudo(); 
}

function removerDespesa(index) {
    dados.despesas.splice(index, 1);
    renderDespesas();
    calcularTudo();
}

function addMeta() { 
    dados.metas.push({nome: "Nova Meta", valorAlvo: 1000, porcentagemSobra: 10}); 
    renderMetas(); 
    calcularTudo(); 
}
