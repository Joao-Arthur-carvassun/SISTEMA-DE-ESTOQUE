const API_URL = "https://sistema-de-estoque-back-production.up.railway.app/api/itens";

const $ = (id) => document.getElementById(id);
const elQnt = $("QntItens");
const elAvisos = $("Avisos");
const elAvisosTexto = $("AvisosTexto");
const elTabela = $("Bodytable");
const elMov = $("RMov");
const elBusca = $("busca");
const dlgItem = $("dlgItem");
const dlgMov = $("dlgMov");
const formItem = $("formItem");
const formMov = $("formMov");

let editandoId = null;   // id do item em edição (null = novo)
let movimento = null;    // { id, tipo: "entrada" | "saida" }

/* ---------- utilidades ---------- */

async function api(caminho = "", opcoes = {}) {
    const resp = await fetch(API_URL + caminho, {
        headers: { "Content-Type": "application/json" },
        ...opcoes,
    });
    if (resp.status === 204) return null;
    let corpo = null;
    try { corpo = await resp.json(); } catch (_) { }
    if (!resp.ok) {
        throw new Error(mensagemDeErro(corpo) || `Erro HTTP ${resp.status}`);
    }
    return corpo;
}

function mensagemDeErro(corpo) {
    if (!corpo) return null;
    if (corpo.erros && typeof corpo.erros === "object") return Object.values(corpo.erros).join("; ");
    return corpo.detail || corpo.message || null;
}

let toastTimer;
function aviso(texto, erro = false) {
    const t = $("toast");
    t.textContent = texto;
    t.className = "toast mostrar" + (erro ? " erro" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = "toast"), 3500);
}

function celula(texto, classe) {
    const td = document.createElement("td");
    td.textContent = texto;
    if (classe) td.className = classe;
    return td;
}

function botao(texto, classe, aoClicar) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = texto;
    b.className = "btn-acao " + classe;
    b.title = texto;
    b.addEventListener("click", aoClicar);
    return b;
}

function formatarData(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/* ---------- carregamento ---------- */

async function carregarTudo() {
    await Promise.all([carregarQuantidade(), carregarAlertas(), carregarProdutos(), carregarMovimentacoes()]);
}

async function carregarQuantidade() {
    try {
        elQnt.innerText = await api("/amount");
    } catch (e) {
        console.error(e);
        elQnt.innerText = "ERRO";
    }
}

async function carregarAlertas() {
    try {
        const alertas = await api("/alertas");
        elAvisos.innerText = alertas.length;
        elAvisos.classList.toggle("perigo", alertas.length > 0);
        elAvisosTexto.textContent = alertas.length
            ? alertas.map((a) => a.nome).join(", ")
            : "Tudo certo por aqui";
    } catch (e) {
        console.error(e);
        elAvisos.innerText = "ERRO";
    }
}

async function carregarProdutos() {
    try {
        const nome = elBusca.value.trim();
        const itens = await api(nome ? "?nome=" + encodeURIComponent(nome) : "");
        elTabela.replaceChildren();
        if (itens.length === 0) {
            const tr = document.createElement("tr");
            const td = celula("Nenhum produto encontrado");
            td.colSpan = 5;
            tr.append(td);
            elTabela.append(tr);
            return;
        }
        for (const item of itens) {
            const tr = document.createElement("tr");
            tr.append(
                celula(item.nome),
                celula(item.quantidade, item.estoqueBaixo ? "baixo" : ""),
                celula(item.quantidadeMinima)
            );
            const status = document.createElement("td");
            const badge = document.createElement("span");
            badge.className = "badge " + (item.estoqueBaixo ? "badge-baixo" : "badge-ok");
            badge.textContent = item.estoqueBaixo ? "Repor" : "OK";
            status.append(badge);
            tr.append(status);
            if (item.estoqueBaixo) tr.title = item.avisos.join(" ");

            const acoes = document.createElement("td");
            acoes.append(
                botao("+ Entrada", "entrada", () => abrirMov(item, "entrada")),
                botao("− Saída", "saida", () => abrirMov(item, "saida")),
                botao("Editar", "editar", () => abrirItem(item)),
                botao("Excluir", "excluir", () => excluir(item))
            );
            tr.append(acoes);
            elTabela.append(tr);
        }
    } catch (e) {
        console.error(e);
        elTabela.replaceChildren();
        const tr = document.createElement("tr");
        const td = celula("Não foi possível carregar os produtos. A API está rodando?");
        td.colSpan = 5;
        tr.append(td);
        elTabela.append(tr);
    }
}

async function carregarMovimentacoes() {
    const nomes = { CADASTRO: "Cadastro", ENTRADA: "Entrada", SAIDA: "Saída" };
    try {
        const movs = await api("/movimentacoes");
        elMov.replaceChildren();
        if (movs.length === 0) {
            const tr = document.createElement("tr");
            const td = celula("Sem movimentações ainda");
            td.colSpan = 4;
            tr.append(td);
            elMov.append(tr);
            return;
        }
        for (const m of movs) {
            const tr = document.createElement("tr");
            tr.append(
                celula(m.itemNome),
                celula(nomes[m.tipo] || m.tipo, "tipo tipo-" + m.tipo.toLowerCase()),
                celula(m.quantidade),
                celula(formatarData(m.dataHora))
            );
            elMov.append(tr);
        }
    } catch (e) {
        console.error(e);
    }
}

/* ---------- ações ---------- */

function abrirItem(item = null) {
    editandoId = item ? item.id : null;
    $("dlgItemTitulo").textContent = item ? "Editar produto" : "Novo produto";
    formItem.nome.value = item ? item.nome : "";
    formItem.quantidade.value = item ? item.quantidade : 0;
    formItem.quantidadeMinima.value = item ? item.quantidadeMinima : 0;
    dlgItem.showModal();
    formItem.nome.focus();
}

function abrirMov(item, tipo) {
    movimento = { id: item.id, tipo };
    $("dlgMovTitulo").textContent = (tipo === "entrada" ? "Entrada de " : "Saída de ") + item.nome;
    formMov.quantidade.value = 1;
    dlgMov.showModal();
    formMov.quantidade.focus();
}

async function excluir(item) {
    if (!confirm(`Excluir "${item.nome}"? Essa ação não pode ser desfeita.`)) return;
    try {
        await api("/" + item.id, { method: "DELETE" });
        aviso("Produto excluído");
        await carregarTudo();
    } catch (e) {
        aviso(e.message, true);
    }
}

formItem.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const dados = {
        nome: formItem.nome.value.trim(),
        quantidade: Number(formItem.quantidade.value),
        quantidadeMinima: Number(formItem.quantidadeMinima.value),
    };
    try {
        if (editandoId === null) {
            await api("", { method: "POST", body: JSON.stringify(dados) });
            aviso("Produto cadastrado");
        } else {
            await api("/" + editandoId, { method: "PUT", body: JSON.stringify(dados) });
            aviso("Produto atualizado");
        }
        dlgItem.close();
        await carregarTudo();
    } catch (e) {
        aviso(e.message, true);
    }
});

formMov.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
        await api(`/${movimento.id}/${movimento.tipo}`, {
            method: "POST",
            body: JSON.stringify({ quantidade: Number(formMov.quantidade.value) }),
        });
        aviso(movimento.tipo === "entrada" ? "Entrada registrada" : "Saída registrada");
        dlgMov.close();
        await carregarTudo();
    } catch (e) {
        aviso(e.message, true);
    }
});

document.querySelectorAll("[data-fechar]").forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close())
);
$("btnNovo").addEventListener("click", () => abrirItem());

let buscaTimer;
elBusca.addEventListener("input", () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(carregarProdutos, 250);
});

document.addEventListener("DOMContentLoaded", carregarTudo);
