// Inicialização das estruturas de dados recuperando do LocalStorage
let materiais = JSON.parse(localStorage.getItem('obramat_materiais')) || [];
let servicos = JSON.parse(localStorage.getItem('obramat_servicos')) || [];

let idMaterialEmEdicao = -1;
let idServicoEmEdicao = -1;

const formMaterial = document.getElementById('form-material');
const formServico = document.getElementById('form-servico');

// Formatação de Moeda BRL
const formatarMoeda = (valor) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Formatação de Data para exibição amigável (DD/MM/AAAA)
const formatarData = (dataString) => {
    if (!dataString) return "";
    const partes = dataString.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

// Atualiza os painéis numéricos de totais e a tabela de Saldos por Prestador
function atualizarResumosESaldos() {
    // 1. Calcula Total de Materiais
    const totalMat = materiais.reduce((soma, item) => soma + (item.qtd * item.valor), 0);
    
    // 2. Calcula Total Pago de fato em serviços (Apenas lançamentos do tipo 'pagamento')
    const totalSrvPago = servicos.filter(item => item.tipo === 'pagamento').reduce((soma, item) => soma + item.valor, 0);
    
    // 3. Gasto real da obra até agora (O que de fato saiu do seu bolso)
    const totalGeral = totalMat + totalSrvPago;

    document.getElementById('total-materiais').innerText = formatarMoeda(totalMat);
    document.getElementById('total-servicos').innerText = formatarMoeda(totalSrvPago);
    document.getElementById('gasto-total').innerText = formatarMoeda(totalGeral);

    // 4. LÓGICA DE AGRUPAMENTO DE SALDOS POR TRABALHADOR
    const saldosPorPrestador = {};

    servicos.forEach(item => {
        const nomeChave = item.prestador.trim().toUpperCase();
        
        if (!saldosPorPrestador[nomeChave]) {
            saldosPorPrestador[nomeChave] = {
                nomeOriginal: item.prestador.trim(),
                totalCombinado: 0, // Soma diárias + contratos fechados
                totalPago: 0
            };
        }

        // Se for Diária OU se for Contrato Fechado, adiciona ao valor que ele tem direito a receber
        if (item.tipo === 'diaria' || item.tipo === 'contrato') {
            saldosPorPrestador[nomeChave].totalCombinado += item.valor;
        } else if (item.tipo === 'pagamento') {
            saldosPorPrestador[nomeChave].totalPago += item.valor;
        }
    });

    // Renderiza a tabela de Saldos por Prestador
    const tbodySaldos = document.querySelector('#tabela-saldos-prestadores tbody');
    tbodySaldos.innerHTML = '';

    Object.values(saldosPorPrestador).forEach(prestador => {
        const restante = prestador.totalCombinado - prestador.totalPago;
        const estiloRestante = restante > 0 ? 'color: #c0392b; font-weight: bold;' : 'color: #27ae60; font-weight: bold;';
        
        let textoRestante;
        if (restante === 0) {
            textoRestante = "Liquidado ✅";
        } else if (restante < 0) {
            textoRestante = `Crédito: ${formatarMoeda(Math.abs(restante))}`;
        } else {
            textoRestante = formatarMoeda(restante);
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${prestador.nomeOriginal}</strong></td>
            <td>${formatarMoeda(prestador.totalCombinado)}</td>
            <td>${formatarMoeda(prestador.totalPago)}</td>
            <td style="${estiloRestante}">${textoRestante}</td>
        `;
        tbodySaldos.appendChild(tr);
    });
}

// Renderiza a tabela de Materiais
function renderizarMateriais() {
    const tbody = document.querySelector('#tabela-materiais tbody');
    tbody.innerHTML = '';

    materiais.forEach((item, index) => {
        const valorTotalCompra = item.qtd * item.valor;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatarData(item.data)}</td>
            <td>${item.produto}</td>
            <td>${item.fornecedor}</td>
            <td>${item.qtd}</td>
            <td>${formatarMoeda(item.valor)}</td>
            <td><strong>${formatarMoeda(valorTotalCompra)}</strong></td>
            <td class="no-print">
                <button class="btn-editar" onclick="prepararEdicaoMaterial(${index})">Editar</button>
                <button class="btn-deletar" onclick="removerMaterial(${index})">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Renderiza o Histórico de Lançamentos de Serviço
function renderizarServicos() {
    const tbody = document.querySelector('#tabela-servicos tbody');
    tbody.innerHTML = '';

    servicos.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        // Tags visuais atualizadas para incluir o contrato fechado
        let badgeTipo = '';
        let estiloValor = '';
        let sinalValor = '';

        if (item.tipo === 'diaria') {
            badgeTipo = '<span style="background-color: #f39c12; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">👷 Diária Trabalhada</span>';
            estiloValor = 'color: #b7950b;';
            sinalValor = `+ ${formatarMoeda(item.valor)}`;
        } else if (item.tipo === 'contrato') {
            badgeTipo = '<span style="background-color: #2980b9; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">📜 Contrato Fechado</span>';
            estiloValor = 'color: #2980b9; font-weight: bold;';
            sinalValor = `+ ${formatarMoeda(item.valor)}`;
        } else if (item.tipo === 'pagamento') {
            badgeTipo = '<span style="background-color: #27ae60; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">💵 Pagamento</span>';
            estiloValor = 'color: #27ae60; font-weight: bold;';
            sinalValor = `- ${formatarMoeda(item.valor)}`;
        }

        const descricaoExibida = item.descricao ? item.descricao : "-";

        tr.innerHTML = `
            <td>${formatarData(item.data)}</td>
            <td>${item.prestador}</td>
            <td>${badgeTipo}</td>
            <td>${descricaoExibida}</td>
            <td style="${estiloValor}"><strong>${sinalValor}</strong></td>
            <td class="no-print">
                <button class="btn-editar" onclick="prepararEdicaoServico(${index})">Editar</button>
                <button class="btn-deletar" onclick="removerServico(${index})">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- FUNÇÕES DE EDIÇÃO ---

window.prepararEdicaoMaterial = function(index) {
    const item = materiais[index];
    idMaterialEmEdicao = index;

    document.getElementById('mat-data').value = item.data;
    document.getElementById('mat-produto').value = item.produto;
    document.getElementById('mat-fornecedor').value = item.fornecedor;
    document.getElementById('mat-qtd').value = item.qtd;
    document.getElementById('mat-valor').value = item.valor;

    document.getElementById('titulo-form-material').innerText = "✏️ Editar Material";
    document.getElementById('btn-submit-material').innerText = "Salvar Alterações";
    document.getElementById('btn-submit-material').style.backgroundColor = "#e67e22";
    
    document.getElementById('form-material').scrollIntoView({ behavior: 'smooth' });
};

window.prepararEdicaoServico = function(index) {
    const item = servicos[index];
    idServicoEmEdicao = index;

    document.getElementById('srv-data').value = item.data;
    document.getElementById('srv-prestador').value = item.prestador;
    document.getElementById('srv-tipo').value = item.tipo;
    document.getElementById('srv-valor').value = item.valor;
    document.getElementById('srv-descricao').value = item.descricao || "";

    document.getElementById('titulo-form-servico').innerText = "✏️ Editar Lançamento de Serviço";
    document.getElementById('btn-submit-servico').innerText = "Salvar Alterações";
    document.getElementById('btn-submit-servico').style.backgroundColor = "#e67e22";

    document.getElementById('form-servico').scrollIntoView({ behavior: 'smooth' });
};

// --- PROCESSAMENTO DOS FORMULÁRIOS ---

formMaterial.addEventListener('submit', function(e) {
    e.preventDefault();

    const dadosMaterial = {
        data: document.getElementById('mat-data').value,
        produto: document.getElementById('mat-produto').value,
        fornecedor: document.getElementById('mat-fornecedor').value,
        qtd: parseFloat(document.getElementById('mat-qtd').value),
        valor: parseFloat(document.getElementById('mat-valor').value)
    };

    if (idMaterialEmEdicao === -1) {
        materiais.push(dadosMaterial);
    } else {
        materiais[idMaterialEmEdicao] = dadosMaterial;
        idMaterialEmEdicao = -1;
        document.getElementById('titulo-form-material').innerText = "Comprar Material";
        document.getElementById('btn-submit-material').innerText = "Adicionar Material";
        document.getElementById('btn-submit-material').style.backgroundColor = "#27ae60";
    }

    localStorage.setItem('obramat_materiais', JSON.stringify(materiais));
    formMaterial.reset();
    init();
});

formServico.addEventListener('submit', function(e) {
    e.preventDefault();

    const dadosServico = {
        data: document.getElementById('srv-data').value,
        prestador: document.getElementById('srv-prestador').value,
        tipo: document.getElementById('srv-tipo').value,
        valor: parseFloat(document.getElementById('srv-valor').value),
        descricao: document.getElementById('srv-descricao').value
    };

    if (idServicoEmEdicao === -1) {
        servicos.push(dadosServico);
    } else {
        servicos[idServicoEmEdicao] = dadosServico;
        idServicoEmEdicao = -1;
        document.getElementById('titulo-form-servico').innerText = "Lançar Movimentação de Serviço";
        document.getElementById('btn-submit-servico').innerText = "Adicionar Lançamento";
        document.getElementById('btn-submit-servico').style.backgroundColor = "#2980b9";
    }

    localStorage.setItem('obramat_servicos', JSON.stringify(servicos));
    formServico.reset();
    init();
});

// Funções para remover itens
window.removerMaterial = function(index) {
    if (confirm("Tem certeza que deseja excluir este material?")) {
        materiais.splice(index, 1);
        localStorage.setItem('obramat_materiais', JSON.stringify(materiais));
        if(idMaterialEmEdicao === index) {
            idMaterialEmEdicao = -1;
            formMaterial.reset();
            document.getElementById('titulo-form-material').innerText = "Comprar Material";
            document.getElementById('btn-submit-material').innerText = "Adicionar Material";
            document.getElementById('btn-submit-material').style.backgroundColor = "#27ae60";
        }
        init();
    }
};

window.removerServico = function(index) {
    if (confirm("Tem certeza que deseja excluir este lançamento de serviço?")) {
        servicos.splice(index, 1);
        localStorage.setItem('obramat_servicos', JSON.stringify(servicos));
        if(idServicoEmEdicao === index) {
            idServicoEmEdicao = -1;
            formServico.reset();
            document.getElementById('titulo-form-servico').innerText = "Lançar Movimentação de Serviço";
            document.getElementById('btn-submit-servico').innerText = "Adicionar Lançamento";
            document.getElementById('btn-submit-servico').style.backgroundColor = "#2980b9";
        }
        init();
    }
};

// Lógica para PDF
document.getElementById('btn-pdf').addEventListener('click', () => {
    const dataAtual = new Date();
    const dataFormatada = dataAtual.toLocaleDateString('pt-BR') + ' às ' + dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('print-data-emissao').innerText = `Emitido em: ${dataFormatada}`;

    const conteudoRelatorio = document.getElementById('relatorio-conteudo');

    const opcoesConfig = {
        margin:       15,
        filename:     'Relatorio_Gastos_Obra.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, 
            useCORS: true,
            ignoreElements: function(elemento) {
                return elemento.classList.contains('no-print');
            }
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opcoesConfig).from(conteudoRelatorio).save();
});

// Lógica para Limpar Tudo
document.getElementById('btn-limpar').addEventListener('click', () => {
    const confirmar = confirm("⚠️ ATENÇÃO: Isto apagará DEFINITIVAMENTE todos os registros. Deseja iniciar uma nova obra?");
    if (confirmar) {
        materiais = [];
        servicos = [];
        localStorage.removeItem('obramat_materiais');
        localStorage.removeItem('obramat_servicos');
        idMaterialEmEdicao = -1;
        idServicoEmEdicao = -1;
        formMaterial.reset();
        formServico.reset();
        init();
        alert("🔄 Aplicativo zerado com sucesso!");
    }
});

function init() {
    renderizarMateriais();
    renderizarServicos();
    atualizarResumosESaldos();
}

init();