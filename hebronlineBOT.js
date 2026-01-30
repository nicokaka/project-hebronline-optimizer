// ==UserScript==
// @name         Bot Hebron v7.4 (UI & Reports)
// @namespace    http://tampermonkey.net/
// @version      7.4
// @description  UI compacta ao minimizar, cores ajustadas e relatório final de erros.
// @author       nicokaka - Nicolas Oliveira de Araújo
// @match        https://novohebronline-hom.hebron.com.br/*
// @match        https://novohebronline.hebron.com.br/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /**
     * CLASSE CONFIG
     * Centraliza constantes e configurações globais
     */
    class Config {
        static get TEMPO_DIGITACAO() { return 500; }
        static get SUFIXO_EDICAO() { return " $"; }
        static get IS_PROD() {
            return window.location.href.includes('novohebronline.hebron.com.br') &&
                !window.location.href.includes('-hom');
        }

        static get UI() {
            return {
                // Ajuste de cor para melhor contraste em fundo escuro (Azul claro para PROD)
                COR_BORDA: this.IS_PROD ? "#4aa3df" : "#e67e22",
                TITULO: this.IS_PROD ? "🤖 HEBRON (PROD)" : "🤖 HEBRON (TESTE)"
            };
        }
    }

    /**
     * CLASSE HELPER
     */
    class DOMHelper {
        static sleep(ms) {
            return new Promise(r => setTimeout(r, ms));
        }

        static digitarAngular(input, valor) {
            input.focus();
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));

            let setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            setter.call(input, valor);

            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));
        }

        static esperarElemento(tipo, timeout = 5000) {
            return new Promise(resolve => {
                const start = Date.now();
                const timer = setInterval(() => {
                    let el = null;
                    if (tipo === 'input_cnpj') el = document.querySelector('input#cnpj') || document.querySelector('input[placeholder*="CNPJ"]');
                    else if (tipo === 'btn_buscar_geral') el = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim().toUpperCase() === 'BUSCAR');
                    else if (tipo === 'datatable-body-row') el = document.querySelector('datatable-body-row');
                    else if (tipo === 'btn_menu_tres_pontos') el = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('...') || b.querySelector('p')?.innerText.includes('...'));
                    else if (tipo === 'btn_editar_opcao') el = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim().includes('Editar'));
                    else if (tipo === 'input_nome_pdv') el = document.querySelector('input[placeholder="Nome"]');
                    else if (tipo === 'check_contato') el = document.querySelector('datatable-body-cell input[type="checkbox"]');
                    else if (tipo === 'input_crm') el = document.querySelector('input#crm') || document.querySelector('input[placeholder*="Classe"]');
                    else el = document.querySelector(tipo);

                    if (el) { clearInterval(timer); resolve(el); }
                    if (Date.now() - start > timeout) { clearInterval(timer); resolve(null); }
                }, 200);
            });
        }

        static buscarBotao(texto) {
            if (texto === 'Salvar') {
                return document.querySelector('button.bg-orange-dark') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Salvar');
            }
            if (texto === 'Voltar') {
                return document.querySelector('button.border-dark-blue') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Voltar');
            }
            if (texto.includes('Ativar')) {
                return Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim().includes('Ativar'));
            }
            return null;
        }

        static async garantirFiltro(labelTexto, valorDesejado) {
            try {
                const labels = Array.from(document.querySelectorAll('label'));
                const labelAlvo = labels.find(l => l.innerText.trim().includes(labelTexto));
                if (!labelAlvo) return false;

                let parent = labelAlvo.parentElement;
                let ngSelect = parent.querySelector('ng-select');
                if (!ngSelect) ngSelect = parent.parentElement.querySelector('ng-select');

                const input = ngSelect ? ngSelect.querySelector('input') : null;
                if (!ngSelect || !input) return false;

                const valorAtualEl = ngSelect.querySelector('.ng-value-label');
                const valorAtual = valorAtualEl ? valorAtualEl.innerText.trim() : "";

                if (valorAtual.toUpperCase() === valorDesejado.toUpperCase()) {
                    return true;
                }

                this.digitarAngular(input, valorDesejado);
                await this.sleep(500);

                let opcao = document.querySelector('.ng-option');
                if (opcao) {
                    opcao.click();
                    return true;
                } else {
                    const enterEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter' });
                    input.dispatchEvent(enterEvent);
                    return true;
                }

            } catch (e) {
                console.error("Erro Garantir Filtro:", e);
                return false;
            }
        }
    }

    /**
     * CLASSE STATE
     */
    class HebronState {
        constructor() {
            this.storageKey = 'hebron_bot_state';
            this.dados = this.carregar();
        }

        carregar() {
            return JSON.parse(localStorage.getItem(this.storageKey)) || {
                rodando: false,
                fila: [],
                erros: [], // Novo: Array de erros { item, motivo }
                indice: 0,
                modo: 'contato',
                etapa: 'LISTA',
                regiaoSalva: '',
                acaoPDV: 'add',
                acaoContato: 'check'
            };
        }

        salvar() {
            localStorage.setItem(this.storageKey, JSON.stringify(this.dados));
        }

        registrarErro(item, motivo) {
            if (!this.dados.erros) this.dados.erros = [];
            // Evita duplicatas se re-rodar o mesmo indice
            if (!this.dados.erros.find(e => e.item === item)) {
                this.dados.erros.push({ item, motivo });
                this.salvar();
            }
        }

        // Getters e Setters
        get rodando() { return this.dados.rodando; }
        set rodando(v) { this.dados.rodando = v; this.salvar(); }

        get fila() { return this.dados.fila; }
        set fila(v) { this.dados.fila = v; this.salvar(); }

        get erros() { return this.dados.erros || []; }
        set erros(v) { this.dados.erros = v; this.salvar(); }

        get indice() { return this.dados.indice; }
        set indice(v) { this.dados.indice = v; this.salvar(); }

        get modo() { return this.dados.modo; }
        set modo(v) { this.dados.modo = v; this.salvar(); }

        get etapa() { return this.dados.etapa; }
        set etapa(v) { this.dados.etapa = v; this.salvar(); }

        get regiaoSalva() { return this.dados.regiaoSalva; }
        set regiaoSalva(v) { this.dados.regiaoSalva = v; this.salvar(); }

        get acaoPDV() { return this.dados.acaoPDV; }
        set acaoPDV(v) { this.dados.acaoPDV = v; this.salvar(); }

        get acaoContato() { return this.dados.acaoContato || 'check'; }
        set acaoContato(v) { this.dados.acaoContato = v; this.salvar(); }
    }

    /**
     * CLASSE UI
     */
    class HebronUI {
        constructor(bot) {
            this.bot = bot;
            this.painelId = 'hebron-console-panel';
        }

        init() {
            if (document.getElementById(this.painelId)) return;
            this.criarHTML();
            this.configurarEventos();
            this.atualizar();
            this.log("> Console v7.4 pronto (Relatórios).");
        }

        criarHTML() {
            const painel = document.createElement('div');
            painel.id = this.painelId;
            // Largura inicial 340px
            // Largura inicial 120px (Minimizado)
            painel.style.cssText = `
                position: fixed; top: 60px; right: 20px; width: 120px; height: auto;
                background-color: #1a1a1a; border: 2px solid ${Config.UI.COR_BORDA}; border-radius: 8px;
                padding: 0; z-index: 999999; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
                font-family: 'Consolas', monospace; color: white; font-size: 12px;
            overflow: hidden; display: block; transition: width 0.3s;
            `;

            painel.innerHTML = `
                <div id="hebron-panel-header" style="
                    display:flex; justify-content:space-between; align-items:center;
                    padding: 10px; background: rgba(255,255,255,0.1); border-bottom:1px solid #444; 
                    cursor: move; user-select: none;">
                        <span id="hebron-title" style="display:none; font-weight:bold; color:${Config.UI.COR_BORDA}; font-size:13px;">${Config.UI.TITULO} v7.4</span>
                    <span id="hebron-logo-min" style="display:inline; font-size: 16px;">🤖</span>
                    <button id="btn-minimizar" style="background:transparent; border:none; color:white; font-weight:bold; font-size:16px; cursor:pointer;">[ + ]</button>

                </div>

                <div id="hebron-panel-body" style="padding: 10px; display: none;">
                    <div style="display:flex; gap:5px; margin-bottom:10px;">
                        <button id="btn-mode-contato" style="flex:1; background:#3498db; color:white; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:4px;">CONTATOS</button>
                        <button id="btn-mode-pdv" style="flex:1; background:#9b59b6; color:white; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:4px;">PDV (AÇÕES)</button>
                    </div>

                    <!-- CONTROLES CONTATO -->
                    <div id="controles-contato" style="background:#1e3542; padding:5px; border-radius:4px; margin-bottom:10px; border:1px solid #3498db;">
                        <div style="margin-bottom:5px; font-weight:bold; color:#7ec0ee;">Ação Contato:</div>
                        <div style="display:flex; flex-direction:column; gap:5px;">
                            <label style="cursor:pointer;">
                                <input type="radio" name="acaoContato" value="check" ${this.bot.state.acaoContato === 'check' ? 'checked' : ''}> 🔵 <b>Transf.</b> (Checkbox)
                            </label>
                            <label style="cursor:pointer; color:#2ecc71;">
                                <input type="radio" name="acaoContato" value="ativar" ${this.bot.state.acaoContato === 'ativar' ? 'checked' : ''}> 🟢 <b>Ativar</b> (Menu)
                            </label>
                        </div>
                        <div id="box-regiao-contato" style="display:none; margin-top:5px; border-top:1px solid #444; padding-top:5px;">
                            <label style="color:#aaa;">Região (Para Ativar/Transf):</label>
                            <input type="text" id="bot-input-regiao-contato" value="${this.bot.state.regiaoSalva || ''}" placeholder="Ex: 50" style="width:100%; background:#222; color:white; border:1px solid #555; padding:5px; margin-top:2px;">
                        </div>
                    </div>

                    <!-- CONTROLES PDV -->
                    <div id="controles-pdv" style="display:none; background:#2a2a2a; padding:5px; border-radius:4px; margin-bottom:10px; border:1px solid #555;">
                        <div style="margin-bottom:5px; font-weight:bold; color:#aaa;">Ação PDV:</div>
                        <div style="display:flex; flex-direction:column; gap:5px;">
                            <label style="cursor:pointer;">
                                <input type="radio" name="acaoPdv" value="add" ${this.bot.state.acaoPDV === 'add' ? 'checked' : ''}> 🔵 <b>Marcar</b> (Adicionar $)
                            </label>
                            <label style="cursor:pointer;">
                                <input type="radio" name="acaoPdv" value="remove" ${this.bot.state.acaoPDV === 'remove' ? 'checked' : ''}> 🔴 <b>Limpar</b> (Remover $)
                            </label>
                            <label style="cursor:pointer; color:#2ecc71;">
                                <input type="radio" name="acaoPdv" value="ativar" ${this.bot.state.acaoPDV === 'ativar' ? 'checked' : ''}> 🟢 <b>Ativar PDV</b>
                            </label>
                        </div>

                        <div style="margin-top:8px; border-top:1px solid #444; padding-top:5px;">
                            <label style="color:#aaa;">Região (Obrigatório):</label>
                            <input type="text" id="bot-input-regiao-pdv" value="${this.bot.state.regiaoSalva || ''}" placeholder="Ex: 50" style="width:100%; background:#222; color:white; border:1px solid #555; padding:5px; margin-top:2px;">
                        </div>
                    </div>

                    <div id="info-status" style="margin-bottom:5px; color:#aaa;">Aguardando...</div>
                    <textarea id="console-input" placeholder="Cole a lista..." style="width:100%; height:80px; background:#111; color:#0f0; border:1px solid #555; padding:5px; font-family:monospace; resize:vertical;"></textarea>

                    <div style="text-align:right; margin-bottom:5px;">
                        <a href="#" id="btn-limpar-fila" style="color:#e74c3c; text-decoration:none; font-size:10px;">[ Limpar Lista ]</a>
                    </div>

                    <div style="display:flex; gap:5px; margin-top:5px; margin-bottom:10px;">
                        <button id="btn-start" style="flex:1; background:#27ae60; color:white; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:4px;">START / RESUME</button>
                        <button id="btn-stop" style="flex:1; background:#c0392b; color:white; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:4px;">PAUSAR</button>
                    </div>

                    <div id="hb-progress-container" style="height: 8px; background: #333; width: 100%; margin-bottom: 8px; border-radius: 4px; overflow: hidden;">
                        <div id="hb-progress-bar" style="height: 100%; background: linear-gradient(90deg, #2980b9, #3498db); width: 0%; transition: width 0.3s;"></div>
                    </div>

                    <div style="background:black; border:1px solid #444; height:120px; overflow-y:scroll; padding:5px; color:#f1c40f; font-size:11px;" id="console-log"></div>
                </div>
            `;

            document.body.appendChild(painel);
        }

        configurarEventos() {
            document.getElementById('btn-mode-contato').onclick = () => this.bot.mudarModo('contato');
            document.getElementById('btn-mode-pdv').onclick = () => this.bot.mudarModo('pdv');
            document.getElementById('btn-start').onclick = () => this.bot.iniciarOuRetomar();
            document.getElementById('btn-stop').onclick = () => this.bot.pausar();

            document.getElementById('btn-limpar-fila').onclick = (e) => {
                e.preventDefault();
                if (confirm("Deseja limpar a lista e resetar o contador?")) {
                    this.bot.limparFila();
                }
            };

            const inputRegiaoPdv = document.getElementById('bot-input-regiao-pdv');
            const inputRegiaoContato = document.getElementById('bot-input-regiao-contato');
            const syncRegiao = (e) => {
                this.bot.state.regiaoSalva = e.target.value;
                inputRegiaoPdv.value = e.target.value;
                inputRegiaoContato.value = e.target.value;
            };
            inputRegiaoPdv.oninput = syncRegiao;
            inputRegiaoContato.oninput = syncRegiao;

            const radiosPdv = document.getElementsByName('acaoPdv');
            radiosPdv.forEach(radio => {
                radio.onchange = (e) => {
                    this.bot.state.acaoPDV = e.target.value;
                    this.log(`Modo PDV: ${this.bot.state.acaoPDV.toUpperCase()} `);
                };
            });

            const radiosContato = document.getElementsByName('acaoContato');
            radiosContato.forEach(radio => {
                radio.onchange = (e) => {
                    this.bot.state.acaoContato = e.target.value;
                    this.log(`Modo Contato: ${this.bot.state.acaoContato.toUpperCase()} `);
                    this.atualizar();
                };
            });

            this._configurarJanela();
        }

        _configurarJanela() {
            const btnMin = document.getElementById('btn-minimizar');
            const corpo = document.getElementById('hebron-panel-body');
            const painel = document.getElementById(this.painelId);
            const titulo = document.getElementById('hebron-title');
            const logoMin = document.getElementById('hebron-logo-min');

            let minimizado = true; // Inicia minimizado

            btnMin.onclick = (e) => {
                e.stopPropagation();
                minimizado = !minimizado;

                if (minimizado) {
                    corpo.style.display = 'none';
                    // Reduz tamanho para ficar compacto
                    painel.style.width = '120px';
                    btnMin.innerText = '[ + ]';
                    titulo.style.display = 'none'; // Esconde título para não quebrar
                    logoMin.style.display = 'inline';
                } else {
                    corpo.style.display = 'block';
                    painel.style.width = '340px';
                    btnMin.innerText = '[ - ]';
                    titulo.style.display = 'block';
                    logoMin.style.display = 'none';
                }
            };

            const header = document.getElementById('hebron-panel-header');
            let isDragging = false, startX, startY, initialLeft, initialTop;

            header.onmousedown = (e) => {
                isDragging = true; startX = e.clientX; startY = e.clientY;
                const rect = painel.getBoundingClientRect(); initialLeft = rect.left; initialTop = rect.top;
                painel.style.opacity = "0.9";
            };
            document.onmousemove = (e) => {
                if (!isDragging) return; e.preventDefault();
                painel.style.left = (initialLeft + e.clientX - startX) + "px";
                painel.style.top = (initialTop + e.clientY - startY) + "px";
                painel.style.right = 'auto';
            };
            document.onmouseup = () => { isDragging = false; painel.style.opacity = "1"; };
        }

        atualizar() {
            const state = this.bot.state;
            const btnContato = document.getElementById('btn-mode-contato');
            const btnPdv = document.getElementById('btn-mode-pdv');

            const controlesPdv = document.getElementById('controles-pdv');
            const controlesContato = document.getElementById('controles-contato');
            const boxRegiaoContato = document.getElementById('box-regiao-contato');

            const info = document.getElementById('info-status');
            const txt = document.getElementById('console-input');

            if (state.modo === 'contato') {
                btnContato.style.background = '#3498db'; btnContato.style.color = 'white';
                btnPdv.style.background = '#333'; btnPdv.style.color = '#aaa';
                controlesPdv.style.display = 'none';
                controlesContato.style.display = 'block';

                boxRegiaoContato.style.display = 'block'; // Sempre mostra região em contatos agora
                if (!state.rodando && state.fila.length === 0) txt.placeholder = "Lista de CRMs...";
            } else {
                btnPdv.style.background = '#9b59b6'; btnPdv.style.color = 'white';
                btnContato.style.background = '#333'; btnContato.style.color = '#aaa';
                controlesPdv.style.display = 'block';
                controlesContato.style.display = 'none';
                if (!state.rodando && state.fila.length === 0) txt.placeholder = "Lista de CNPJs...";
            }

            // Update Progress Bar
            const total = state.fila.length > 0 ? state.fila.length : 1;
            const current = state.indice;
            const percent = Math.min(100, Math.max(0, (current / total) * 100));
            const bar = document.getElementById('hb-progress-bar');
            if (bar) bar.style.width = `${percent}%`;

            if (state.rodando) {
                let detalhe = "";
                if (state.modo === 'pdv') detalhe = state.acaoPDV.toUpperCase();
                else detalhe = state.acaoContato.toUpperCase();

                info.innerText = `Rodando: ${state.indice}/${state.fila.length} (${detalhe})`;
                info.style.color = "#0f0";
            } else {
                if (state.fila.length > 0 && state.indice < state.fila.length) {
                    info.innerText = `Pausado em: ${state.indice}/${state.fila.length}`;
                    info.style.color = "orange";
                } else {
                    info.innerText = "Parado.";
                    info.style.color = "#aaa";
                }
            }
        }

        log(msg) {
            const display = document.getElementById('console-log');
            if (display) {
                const linha = document.createElement('div');
                const hora = new Date().toLocaleTimeString().split(' ')[0];
                linha.innerText = `[${hora}] ${msg}`;
                display.appendChild(linha);
                display.scrollTop = display.scrollHeight;
            } else {
                console.log(`[HebronBot] ${msg}`);
            }
        }

        getInputTexto() { return document.getElementById('console-input').value; }
        limparInputTexto() { document.getElementById('console-input').value = ""; }
    }

    /**
     * CLASSE CONTROLLER DO BOT
     */
    class HebronBot {
        constructor() {
            this.state = new HebronState();
            this.ui = new HebronUI(this);
        }

        init() {
            console.log(">>> BOT HEBRON V7.4 INICIANDO (UI+REPORTS) <<<");

            if (this.state.rodando && !document.getElementById('hebron-console-panel')) {
                this.ui.init();
                setTimeout(() => this.loopPrincipal(), 2000);
            } else {
                setTimeout(() => this.ui.init(), 2000);
            }
        }

        mudarModo(novoModo) {
            if (this.state.rodando) return;
            this.state.modo = novoModo;
            this.ui.atualizar();
        }

        iniciarOuRetomar() {
            if (this.state.rodando) return;

            const precisaRegiao = (this.state.modo === 'pdv') || (this.state.modo === 'contato' && this.state.acaoContato === 'ativar');

            if (precisaRegiao) {
                const regiao = this.state.regiaoSalva;
                if (!regiao || regiao.trim() === '') {
                    alert("ERRO: Preencha o campo 'Região' no painel!");
                    return;
                }
            }

            if (this.state.fila.length === 0 || this.state.indice >= this.state.fila.length) {
                const txtInput = this.ui.getInputTexto();
                const novaFila = txtInput.split('\n').map(x => x.trim()).filter(x => x !== "");

                if (novaFila.length === 0) {
                    this.ui.log("❌ Lista vazia!");
                    return;
                }

                this.state.fila = novaFila;
                this.state.indice = 0;
                this.state.erros = []; // Resetar erros
                this.state.etapa = 'LISTA';
                this.ui.log(`📝 Nova lista (${this.state.fila.length}).`);
            } else {
                this.ui.log(`▶ Retomando do item ${this.state.indice + 1}...`);
            }

            this.state.rodando = true;
            this.ui.atualizar();

            if (this.state.modo === 'contato' && this.state.acaoContato === 'ativar') {
                this.prepararFiltrosContato().then(() => this.loopPrincipal());
            } else {
                this.loopPrincipal();
            }
        }

        async prepararFiltrosContato() {
            this.ui.log("⚙️ Configurando filtros de contato...");
            await DOMHelper.garantirFiltro('Tipo de contato', 'Médico');
            await DOMHelper.sleep(1000);
            await DOMHelper.garantirFiltro('Situação', 'Desativados');
            await DOMHelper.sleep(1000);
            await this.garantirRegiaoPreenchida(this.state.regiaoSalva);
            this.ui.log("⚙️ Filtros prontos.");
        }

        pausar() {
            if (this.state.rodando) {
                this.state.rodando = false;
                this.ui.atualizar();
                this.ui.log("⏸ PAUSADO.");
            }
        }

        limparFila() {
            this.state.fila = [];
            this.state.indice = 0;
            this.state.erros = [];
            this.state.etapa = 'LISTA';
            this.state.rodando = false;
            this.ui.limparInputTexto();
            this.ui.atualizar();
            this.ui.log("🗑 Lista limpa.");
        }

        async loopPrincipal() {
            if (!this.state.rodando) return;

            if (this.state.indice >= this.state.fila.length) {
                this.ui.atualizar(); // Força atualização visual (100%)
                await DOMHelper.sleep(300); // Aguarda renderização antes do alert
                this.ui.log("✅ LISTA CONCLUÍDA!");

                // Relatório Final
                if (this.state.erros.length > 0) {
                    const resumo = this.state.erros.map(e => `${e.item}: ${e.motivo}`).join('\n');
                    alert(`⚠️ PROCESSO FINALIZADO COM FALHAS (${this.state.erros.length}):\n\n${resumo}`);
                    this.ui.log(`⚠️ ${this.state.erros.length} itens com erro.`);
                } else {
                    this.ui.log("🏆 Nenhum erro registrado.");
                    alert("✅ Processo Finalizado com Sucesso!");
                }

                this.state.rodando = false;
                this.state.fila = [];
                this.state.indice = 0;
                this.ui.atualizar();
                return;
            }

            const itemAtual = this.state.fila[this.state.indice];

            if (this.state.modo === 'contato') {
                await this.processarContato(itemAtual);
                this.state.indice++;
                this.ui.atualizar();
                this.loopPrincipal();
            }
            else if (this.state.modo === 'pdv') {
                await this.fluxoPDV(itemAtual);
            }
        }

        async processarContato(crm) {
            const i = this.state.indice + 1;
            const t = this.state.fila.length;
            const acao = this.state.acaoContato;

            this.ui.log(`[${i}/${t}] CRM: ${crm} (${acao})`);

            const input = await DOMHelper.esperarElemento('input_crm', 3000);
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Buscar'));

            if (input && btn) {
                DOMHelper.digitarAngular(input, crm);
                await DOMHelper.sleep(500);
                btn.click();

                if (acao === 'check') {
                    await DOMHelper.sleep(1500); // Wait for AJAX

                    const check = await DOMHelper.esperarElemento('check_contato', 4000);
                    if (check) {
                        if (!check.checked) {
                            check.click();
                            check.dispatchEvent(new Event('change', { bubbles: true }));

                            await DOMHelper.sleep(200);
                            if (!check.checked) { // Double Check
                                check.click();
                                check.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                            this.ui.log("✔ Marcado.");
                        } else {
                            this.ui.log("Info: Já marcado.");
                        }
                    }
                    else {
                        this.ui.log("⚠ Checkbox não encontrado.");
                        this.state.registrarErro(crm, "Checkbox não encontrado");
                    }
                    await DOMHelper.sleep(1000);
                }
                else if (acao === 'ativar') {
                    await DOMHelper.sleep(1000);
                    const linha = await DOMHelper.esperarElemento('datatable-body-row', 5000);

                    if (linha) {
                        const alvo = linha.querySelector('p.ng-star-inserted') || linha.querySelector('datatable-body-cell') || linha;
                        alvo.click();

                        const btnMenu = await DOMHelper.esperarElemento('btn_menu_tres_pontos', 2000);
                        if (btnMenu) {
                            btnMenu.click();
                            await DOMHelper.sleep(500);
                            const btnAtivar = DOMHelper.buscarBotao('Ativar');
                            if (btnAtivar) {
                                btnAtivar.click();
                                this.ui.log("⚡ Ativado.");
                                await DOMHelper.sleep(2500);
                            } else {
                                this.ui.log("⚠️ Botão Ativar?");
                                this.state.registrarErro(crm, "Botão Ativar não sumiu");
                            }
                        } else {
                            this.ui.log("⚠️ Menu?");
                            this.state.registrarErro(crm, "Menu não abriu");
                        }
                    } else {
                        this.ui.log("❌ Não encontrado.");
                        this.state.registrarErro(crm, "Não encontrado na busca");
                    }
                }

            } else {
                this.ui.log("❌ Erro Input/Busca.");
                this.state.registrarErro(crm, "Falha ao preencher Input");
            }
        }

        async fluxoPDV(itemAtual) {
            const estamosNaEdicao = document.body.innerText.includes('Editar Ponto de Venda') || document.querySelector('input[placeholder="Nome"]');

            if (this.state.acaoPDV === 'ativar' && estamosNaEdicao) {
                this.ui.log("⚠️ Em tela errada (Edição). Voltando...");
                const btnVoltar = DOMHelper.buscarBotao('Voltar');
                if (btnVoltar) btnVoltar.click();
                await DOMHelper.sleep(2000);
                this.state.etapa = 'LISTA';
                this.loopPrincipal();
                return;
            }

            if (this.state.acaoPDV !== 'ativar') {
                if (this.state.etapa === 'LISTA' && estamosNaEdicao) {
                    this.state.etapa = 'EDICAO';
                }
                if (this.state.etapa === 'EDICAO' && !estamosNaEdicao && document.querySelector('input[placeholder*="CNPJ"]')) {
                    this.ui.log("⚠️ Retorno manual detectado.");
                    this.state.etapa = 'LISTA';
                    this.state.indice++;
                    await DOMHelper.esperarElemento('input_cnpj', 10000);
                    await DOMHelper.sleep(1000);
                    this.loopPrincipal();
                    return;
                }
            }

            if (this.state.etapa === 'LISTA') {
                this.ui.log(`[${this.state.indice + 1}/${this.state.fila.length}] PDV: ${itemAtual}`);

                const regiaoOk = await this.garantirRegiaoPreenchida(this.state.regiaoSalva);
                if (!regiaoOk) {
                    this.state.rodando = false;
                    this.ui.atualizar();
                    this.ui.log("⚠️ Erro Região. Pausando.");
                    alert("Erro na Região (PDV).");
                    return; // Pausa real, nao conta erro
                }

                const resultado = await this.rotina_ListaPDV(itemAtual);

                if (resultado === 'SUCESSO_NAV') {
                    this.state.etapa = 'EDICAO';
                    this.ui.atualizar();
                    this.ui.log("🔄 Abrindo edição...");
                    await DOMHelper.sleep(2000);
                    this.loopPrincipal();
                }
                else if (resultado === 'SUCESSO_ATIVACAO') {
                    this.ui.log("🟢 Ativado com sucesso.");
                    this.state.indice++;
                    this.ui.atualizar();
                    await DOMHelper.sleep(1500);
                    this.loopPrincipal();
                }
                else {
                    this.ui.log("⚠️ Erro/Não encontrado. Pulando.");
                    this.state.registrarErro(itemAtual, "Não encontrado ou Erro Menu");
                    this.state.indice++;
                    this.ui.atualizar();
                    this.loopPrincipal();
                }
            }
            else if (this.state.etapa === 'EDICAO') {
                this.ui.log(`✏ Editando...`);
                const inputNome = await DOMHelper.esperarElemento('input_nome_pdv', 10000);

                if (inputNome) {
                    const resultadoEdicao = await this.rotina_EdicaoPDV(inputNome);

                    if (resultadoEdicao === 'ERRO_SALVAR') {
                        this.state.rodando = false;
                        this.ui.atualizar();
                        this.ui.log("🛑 ERRO AO SALVAR.");
                        alert("PAUSA: Site recusou salvar.\nCorrija e clique em START.");
                        return;
                    }

                    this.state.etapa = 'LISTA';
                    this.state.indice++;
                    this.ui.atualizar();

                    if (resultadoEdicao === 'VOLTOU_SEM_SALVAR') {
                        this.ui.log("🔙 Sem alterações.");
                    } else {
                        this.ui.log("💾 Salvando...");
                    }

                    await DOMHelper.sleep(500);
                    await DOMHelper.esperarElemento('input_cnpj', 10000);
                    this.loopPrincipal();
                } else {
                    this.ui.log("❌ Timeout Edição.");
                    this.state.rodando = false;
                    this.ui.atualizar();
                    alert("Erro: Edição não carregou.");
                }
            }
        }

        async rotina_ListaPDV(cnpj) {
            try {
                const inputCnpj = await DOMHelper.esperarElemento('input_cnpj', 5000);
                const btnBuscar = await DOMHelper.esperarElemento('btn_buscar_geral', 2000);
                if (!inputCnpj) return 'ERRO_GENERICO';

                DOMHelper.digitarAngular(inputCnpj, cnpj);
                await DOMHelper.sleep(500);
                btnBuscar.click();
                this.ui.log("🔎 Buscando...");

                const linhaTabela = await DOMHelper.esperarElemento('datatable-body-row', 5000);
                if (!linhaTabela) return 'NAO_ENCONTRADO';

                const alvo = linhaTabela.querySelector('p.ng-star-inserted') || linhaTabela.querySelector('datatable-body-cell') || linhaTabela;
                alvo.click();

                const btnMenu = await DOMHelper.esperarElemento('btn_menu_tres_pontos');
                if (btnMenu) {
                    btnMenu.click();
                    await DOMHelper.sleep(800);
                } else return 'ERRO_MENU';

                if (this.state.acaoPDV === 'ativar') {
                    const btnAtivar = DOMHelper.buscarBotao('Ativar');
                    if (btnAtivar) {
                        this.ui.log("⚡ Clicando em Ativar...");
                        btnAtivar.click();
                        await DOMHelper.sleep(2000);
                        return 'SUCESSO_ATIVACAO';
                    } else return 'ERRO_BOTAO';
                } else {
                    const btnEditar = await DOMHelper.esperarElemento('btn_editar_opcao');
                    if (btnEditar) {
                        btnEditar.click();
                        return 'SUCESSO_NAV';
                    } else return 'ERRO_EDITAR';
                }
            } catch (e) { return 'ERRO_CATCH'; }
        }

        async rotina_EdicaoPDV(inputNome) {
            try {
                const acao = this.state.acaoPDV;
                let nomeAtual = inputNome.value;
                let novoNome = nomeAtual;
                let alterou = false;

                if (acao === 'add') {
                    if (!nomeAtual.includes(Config.SUFIXO_EDICAO)) {
                        novoNome = nomeAtual + Config.SUFIXO_EDICAO;
                        alterou = true;
                        this.ui.log(`📝 Marcando ($)...`);
                    } else this.ui.log("Info: Já marcado.");
                } else if (acao === 'remove') {
                    if (nomeAtual.includes(Config.SUFIXO_EDICAO)) {
                        novoNome = nomeAtual.replace(Config.SUFIXO_EDICAO, "").trim();
                        alterou = true;
                        this.ui.log(`🧹 Limpando ($)...`);
                    } else this.ui.log("Info: Limpo.");
                }

                if (alterou) {
                    DOMHelper.digitarAngular(inputNome, novoNome);
                    await DOMHelper.sleep(500);
                    const btnSalvar = DOMHelper.buscarBotao('Salvar');
                    if (btnSalvar) {
                        btnSalvar.click();
                        await DOMHelper.sleep(3000);
                        const aindaNaEdicao = document.querySelector('input[placeholder="Nome"]');
                        if (aindaNaEdicao) return 'ERRO_SALVAR';
                        return 'SUCESSO';
                    }
                }
                else {
                    const btnVoltar = DOMHelper.buscarBotao('Voltar');
                    if (btnVoltar) {
                        btnVoltar.click();
                        return 'VOLTOU_SEM_SALVAR';
                    } else {
                        const btnSalvar = DOMHelper.buscarBotao('Salvar');
                        if (btnSalvar) {
                            btnSalvar.click();
                            await DOMHelper.sleep(3000);
                            if (document.querySelector('input[placeholder="Nome"]')) return 'ERRO_SALVAR';
                            return 'SUCESSO';
                        }
                    }
                }
                return 'ERRO_SALVAR';

            } catch (e) { return 'ERRO_SALVAR'; }
        }

        async garantirRegiaoPreenchida(valorRegiao) {
            return await DOMHelper.garantirFiltro('Região', valorRegiao);
        }
    }

    // --- INICIALIZAÇÃO ---
    const bot = new HebronBot();
    bot.init();

})();
