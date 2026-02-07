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
        static get TEMPO_DIGITACAO() { return 100; } // Reduced from 500
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
                    else if (tipo === 'check_contato') el = document.querySelector('datatable-body-row input[type="checkbox"]');
                    else if (tipo === 'input_crm') el = document.querySelector('input#crm') || document.querySelector('input[placeholder*="Classe"]');
                    else if (tipo === 'input_nome_search') el = document.querySelector('input#name') || document.querySelector('input[placeholder*="descrição"]');
                    else if (tipo === 'checkbox_flutuante') el = document.querySelector('input.w-5.h-5.accent-orange-400[type="checkbox"]');
                    else el = document.querySelector(tipo);

                    if (el) { clearInterval(timer); resolve(el); }
                    if (Date.now() - start > timeout) { clearInterval(timer); resolve(null); }
                }, 200);
            });
        }

        static buscarBotao(texto) {
            if (texto === 'Salvar') {
                const btnClass = document.querySelector('button.bg-orange-dark');
                if (btnClass) return btnClass;
                return Array.from(document.querySelectorAll('button')).find(b => /Salvar/i.test(b.innerText));
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
                await this.sleep(1500); // Increased from 200 to allow dropdown fetch

                let opcao = document.querySelector('.ng-option');
                if (opcao) {
                    opcao.click();
                    return true;
                } else {
                    // Force Enter more robustly
                    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter' }));
                    input.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter' }));
                    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter' }));
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
                acaoPDV: 'add',
                acaoContato: 'check',
                setorTransferencia: ''
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

        get setorTransferencia() { return this.dados.setorTransferencia || ''; }
        set setorTransferencia(v) { this.dados.setorTransferencia = v; this.salvar(); }
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
                position: fixed; top: 60px; right: 20px; width: 120px; height: 40px;
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
                            <label style="cursor:pointer; color:#9b59b6;">
                                <input type="radio" name="acaoContato" value="flutuante" ${this.bot.state.acaoContato === 'flutuante' ? 'checked' : ''}> 🟣 <b>Flutuante</b> (Setor)
                            </label>
                        </div>
                        <div id="box-regiao-contato" style="display:none; margin-top:5px; border-top:1px solid #444; padding-top:5px;">
                                    <span id="lbl-regiao-contato" style="font-size:11px; color:#aaa; display:block; margin-bottom:2px;">Região (Para Ativar/Transf):</span>
                                    <input type="text" id="bot-input-regiao-contato" value="${this.bot.state.regiaoSalva || ''}" placeholder="Ex: 50" style="width:100%; box-sizing:border-box; background:#222; border:1px solid #444; color:white; padding:4px;">
                                </div>

                                <div id="box-tipo-contato" style="margin-bottom:8px; display:none;">
                                    <span style="font-size:11px; color:#aaa; display:block; margin-bottom:2px;">Tipo de Contato (Flutuante):</span>
                                    <input type="text" id="bot-input-tipo-contato" value="${this.bot.state.tipoContatoFlutuante || 'Médico'}" placeholder="Ex: Farmacêutico" style="width:100%; box-sizing:border-box; background:#222; border:1px solid #444; color:white; padding:4px;">
                                </div>
                                
                                <div id="div-setor-dest" style="margin-bottom:8px; display:none; border-top:1px dashed #444; padding-top:5px;">
                                <label style="color:#aaa;">Setor Destino (Transf):</label>
                                <input type="text" id="bot-input-setor" value="${this.bot.state.setorTransferencia || ''}" placeholder="Ex: Setor X" style="width:100%; background:#222; color:white; border:1px solid #555; padding:5px; margin-top:2px;">
                            </div>
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

            const inputSetor = document.getElementById('bot-input-setor');
            inputSetor.oninput = (e) => {
                this.bot.state.setorTransferencia = e.target.value;
            };

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
                    painel.style.height = '40px'; // Force compact height
                    painel.style.overflow = 'hidden'; // Hide overflow
                    btnMin.innerText = '[ + ]';
                    titulo.style.display = 'none'; // Esconde título para não quebrar
                    logoMin.style.display = 'inline';
                } else {
                    corpo.style.display = 'block';
                    painel.style.width = '340px';
                    painel.style.height = 'auto'; // Auto height for content
                    painel.style.overflow = 'visible';
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

                // Mostrar/Esconder campo Setor apenas se for Check/Transferir
                const divSetor = document.getElementById('div-setor-dest');
                // Mostrar/Esconder campo Tipo Contato apenas se for Flutuante
                const boxTipo = document.getElementById('box-tipo-contato');

                if (state.acaoContato === 'check') {
                    divSetor.style.display = 'block';
                } else {
                    divSetor.style.display = 'none';
                }

                if (state.acaoContato === 'flutuante') {
                    boxTipo.style.display = 'block';
                } else {
                    boxTipo.style.display = 'none';
                }

                if (!state.rodando && state.fila.length === 0) txt.placeholder = "Lista de CRMs...";

                // Atualiza label dependendo do modo
                const lblRegiao = document.getElementById('lbl-regiao-contato');
                const inputRegiao = document.getElementById('bot-input-regiao-contato');
                if (state.acaoContato === 'flutuante') {
                    if (lblRegiao) lblRegiao.innerText = "Setor Completo (Ex: 90.10.001):";
                    if (inputRegiao) inputRegiao.placeholder = "90.10.001";
                } else {
                    if (lblRegiao) lblRegiao.innerText = "Região (Para Ativar/Transf):";
                    if (inputRegiao) inputRegiao.placeholder = "Ex: 50";
                }
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

            const precisaRegiao = (this.state.modo === 'pdv') || (this.state.modo === 'contato' && (this.state.acaoContato === 'ativar' || this.state.acaoContato === 'check' || this.state.acaoContato === 'flutuante'));

            if (precisaRegiao) {
                const regiao = this.state.regiaoSalva;
                if (!regiao || regiao.trim() === '') {
                    alert("ERRO: Preencha o campo 'Região/Setor' no painel!");
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
            }
            else if (this.state.modo === 'contato' && this.state.acaoContato === 'check') {
                this.ui.log("⚙️ Configurando região...");
                this.garantirRegiaoPreenchida(this.state.regiaoSalva).then(() => {
                    this.loopPrincipal();
                });
            }
            else if (this.state.modo === 'contato' && this.state.acaoContato === 'flutuante') {
                this.prepararFiltrosFlutuante(this.state.regiaoSalva).then(() => this.loopPrincipal());
            }
            else {
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

        async prepararFiltrosFlutuante(codigoSetor) {
            this.ui.log(`⚙️ Configurando filtros Flutuante: ${codigoSetor}`);

            // Parse Sector: 90.10.001
            // Regiao: 90
            // Distrito: 90.10
            // Setor: 90.10.001
            try {
                const partes = codigoSetor.split('.');
                if (partes.length < 3) {
                    this.ui.log("⚠️ Formato de setor inválido! Use XX.XX.XXX");
                    // Tenta usar o que tem
                }

                const regiao = partes[0];
                const distrito = partes.length >= 2 ? `${partes[0]}.${partes[1]}` : "";
                const setor = codigoSetor;

                // USER STRICT ORDER: Region -> District -> Sector -> Type -> Situation
                await DOMHelper.garantirFiltro('Região', regiao);

                if (distrito) {
                    await DOMHelper.garantirFiltro('Distrito', distrito);
                }

                await DOMHelper.garantirFiltro('Setor', setor);

                // Generic filters applied AFTER location
                // Dinâmico: Pega o valor do UI. Se estiver vazio ou só espaços, PULA o filtro.
                const tipoContatoInput = document.getElementById('bot-input-tipo-contato').value;

                if (tipoContatoInput && tipoContatoInput.trim().length > 0) {
                    this.ui.log(`🔍 Filtro Tipo: ${tipoContatoInput}`);
                    await DOMHelper.garantirFiltro('Tipo de contato', tipoContatoInput);
                } else {
                    this.ui.log(`⚪ Sem filtro de Tipo (Geral).`);
                }

                await DOMHelper.garantirFiltro('Situação', 'Ativados');

                // Pequeno sleep final apenas para garantir que a tabela carregue
                await DOMHelper.sleep(500);

                this.ui.log("⚙️ Filtros setor prontos.");

            } catch (e) {
                this.ui.log("❌ Erro config filtros: " + e.message);
            }
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

                // SE FINALIZOU A LISTA DE CONTATOS E ESTAVA MARCANDO (TENTAR TRANSFERIR)
                if (this.state.modo === 'contato' && this.state.acaoContato === 'check') {
                    this.ui.log("📋 Lista finalizada. Iniciando Transferência...");
                    await this.executarTransferenciaFinal();
                    this.state.rodando = false;
                    this.state.fila = [];
                    this.state.indice = 0;
                    this.ui.atualizar();
                    return;
                }

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

            // FIX: Re-garantir filtros no modo Flutuante, pois a página reseta ao voltar
            if (this.state.modo === 'contato' && acao === 'flutuante') {
                await this.prepararFiltrosFlutuante(this.state.regiaoSalva);
            }

            // OTIMIZAÇÃO/CORREÇÃO: Aumentado timeout para 10s para evitar "Erro Input" quando o reload é lento
            // SMART SEARCH: Detect if CRM (digits) or Name (Text)
            const isCRM = /\d/.test(crm);
            const inputSelector = isCRM ? 'input_crm' : 'input_nome_search';
            const logType = isCRM ? 'CRM' : 'NOME';

            const input = await DOMHelper.esperarElemento(inputSelector, 10000);
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Buscar'));

            if (input && btn) {
                // Se for nome, limpar input CRM para garantir (e vice-versa, se possível, mas o HTML separa)
                if (!isCRM) {
                    const inputCrm = document.querySelector('input#crm');
                    if (inputCrm && inputCrm.value) { DOMHelper.digitarAngular(inputCrm, ''); await DOMHelper.sleep(200); }
                }

                DOMHelper.digitarAngular(input, crm);
                await DOMHelper.sleep(500);
                btn.click();

                if (acao === 'check') {
                    await DOMHelper.sleep(1500); // Wait for AJAX

                    // Verificação de Duplicidade
                    const linhas = document.querySelectorAll('datatable-body-row');
                    if (linhas.length >= 2) {
                        this.ui.log(`⚠ Duplicidade: ${linhas.length} contatos.`);
                        this.state.registrarErro(crm, `Duplicidade: ${linhas.length} contatos encontrados`);
                        return; // Pula este item
                    }

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
                else if (acao === 'flutuante') {
                    await DOMHelper.sleep(1000);
                    // Mesma lógica de navegação do 'ativar' ou 'check' para entrar no detalhes?
                    // O usuario disse: selecionar contato -> 3 pontinhos -> Editar -> Checkbox -> Salvar

                    const linha = await DOMHelper.esperarElemento('datatable-body-row', 5000);
                    if (linha) {
                        // Clica na linha para abrir detalhes (se necessario) ou seleciona direto
                        // No fluxo de ativar usamos click na linha.
                        const alvo = linha.querySelector('p.ng-star-inserted') || linha.querySelector('datatable-body-cell') || linha;
                        alvo.click();

                        // 3 pontinhos
                        const btnMenu = await DOMHelper.esperarElemento('btn_menu_tres_pontos', 3000);
                        if (btnMenu) {
                            btnMenu.click();
                            await DOMHelper.sleep(500);

                            // Botão Editar
                            const btnEditar = await DOMHelper.esperarElemento('btn_editar_opcao');
                            if (btnEditar) {
                                btnEditar.click();
                                this.ui.log("✏ Entrando na edição...");
                                await DOMHelper.sleep(3000); // Explicit sleep for loading stability

                                // Esperar Checkbox Flutuante
                                // Selector: input.w-5.h-5.accent-orange-400
                                // Vamos buscar por classe
                                // await DOMHelper.sleep(2500); // Wait load (REMOVED: Using dynamic wait now)

                                const checkFlutuante = await DOMHelper.esperarElemento('checkbox_flutuante', 10000); // Increased timeout to wait for loading animation

                                if (checkFlutuante) {
                                    if (!checkFlutuante.checked) {
                                        this.ui.log("🟣 Marcando Flutuante...");
                                        checkFlutuante.click();
                                        checkFlutuante.dispatchEvent(new Event('change', { bubbles: true }));
                                        await DOMHelper.sleep(500);

                                        // Salvar
                                        await DOMHelper.sleep(200); // Reduced delay
                                        const btnSalvar = DOMHelper.buscarBotao('Salvar');

                                        if (btnSalvar) {
                                            this.ui.log(`🔎 Botão Salvar achado. Disabled: ${btnSalvar.disabled}`);

                                            // VISUAL DEBUG
                                            btnSalvar.style.border = "5px solid red";
                                            btnSalvar.style.boxShadow = "0 0 15px yellow";

                                            // FORCE CLICK STRATEGY
                                            btnSalvar.scrollIntoView({ block: 'center' });
                                            btnSalvar.focus(); // NEW: Focus first

                                            // Validate Checkbox before saving
                                            this.ui.log(`Values: Checkbox=${checkFlutuante.checked}`);

                                            btnSalvar.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                                            btnSalvar.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                                            btnSalvar.click();
                                            btnSalvar.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

                                            this.ui.log("💾 Clique disparado. Voltando...");

                                            // OTIMIZACAO FINAL: Reduzido para 500ms para agilizar (was 1000ms)
                                            await DOMHelper.sleep(500);

                                            // Aguardar retorno à lista (sem forçar)
                                            const voltou = await DOMHelper.esperarElemento('input_crm', 10000);
                                            if (voltou) {
                                                this.ui.log("🔙 Lista carregada.");
                                            } else {
                                                this.ui.log("⚠️ Demorou voltar (Timeout).");
                                                // Opcional: Tentar voltar se realmente travou
                                                const btnVoltar = DOMHelper.buscarBotao('Voltar');
                                                if (btnVoltar) btnVoltar.click();
                                            }
                                            // Removemos sleep extra de 1000ms
                                            await DOMHelper.sleep(200);

                                        } else {
                                            this.ui.log("⚠️ Botão Salvar não achado.");
                                            this.state.registrarErro(crm, "Botão Salvar sumiu");
                                        }
                                    } else {
                                        this.ui.log("Info: Já é flutuante.");
                                        // Voltar ou Salvar? Melhor voltar para não editar sem necessidade?
                                        // Usuario disse: "marcar... clicar em salvar". O bot pode salvar mesmo assim.
                                        const btnSalvar = DOMHelper.buscarBotao('Salvar');
                                        if (btnSalvar) {
                                            btnSalvar.click();
                                            await DOMHelper.sleep(1000);
                                            await DOMHelper.esperarElemento('input_crm', 10000); // Wait return
                                        }
                                        await DOMHelper.sleep(1000);
                                    }
                                } else {
                                    this.ui.log("❌ Checkbox Flutuante não achado.");
                                    this.state.registrarErro(crm, "Checkbox Flutuante não encontrado");
                                    // Tenta voltar
                                    const btnVoltar = DOMHelper.buscarBotao('Voltar');
                                    if (btnVoltar) btnVoltar.click();
                                }

                            } else {
                                this.ui.log("⚠️ Botão Editar não achado.");
                                this.state.registrarErro(crm, "Botão Editar não encontrado");
                            }
                        } else {
                            this.ui.log("⚠️ Menu '...' não achado.");
                            this.state.registrarErro(crm, "Menu não abriu");
                        }
                    } else {
                        this.ui.log("❌ Contato não encontrado.");
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

        async executarTransferenciaFinal() {
            try {
                this.ui.log("Botão '...' (Menu)...");

                // 1. Clicar nos 3 pontinhos GERAIS (Geralmente acima da tabela ou no cabeçalho)
                // Precisamos garantir que pegamos o certo. O usuario disse "ir nos 3 pontinhos".
                // Vamos tentar achar o botão que tem o menu de ações em massa.

                // Tenta achar pelo texto ou classe, geralmente é um botão de menu context
                // O helper busca qualquer '...'
                const btnMenu = await DOMHelper.esperarElemento('btn_menu_tres_pontos', 5000);

                if (!btnMenu) {
                    this.ui.log("❌ Menu '...' não encontrado!");
                    alert("Não foi possível achar o menu '...' para transferir.");
                    return;
                }
                btnMenu.click();
                await DOMHelper.sleep(1000);

                // 2. Clicar em "Transferir"
                // CUIDADO: Pode ter "Transferir todos". O usuario quer "Transferir".
                const btns = Array.from(document.querySelectorAll('button, a, div[role="menuitem"]'));
                const btnTransferir = btns.find(b => b.innerText.trim() === 'Transferir'); // Exato, sem "todos"

                if (!btnTransferir) {
                    this.ui.log("❌ Opção 'Transferir' não achada.");
                    // Tenta fallback parcial caso o texto tenha icone
                    const fallback = btns.find(b => b.innerText.includes('Transferir') && !b.innerText.includes('Todos'));
                    if (fallback) {
                        fallback.click();
                    } else {
                        alert("Opção 'Transferir' não encontrada no menu.");
                        return;
                    }
                } else {
                    btnTransferir.click();
                }

                this.ui.log("Aguardando modal...");
                await DOMHelper.sleep(2000);

                // 3. Selecionar o Setor de Destino
                // O usuario informou: <input aria-autocomplete="list" ... >
                const setorDesejado = this.state.setorTransferencia;
                if (!setorDesejado) {
                    this.ui.log("⚠️ Setor não informado. Pausando para input manual.");
                    alert("Preencha o Setor manualmente e confirme.");
                    return;
                }

                // Tenta achar o input
                const inputs = Array.from(document.querySelectorAll('input[aria-autocomplete="list"]'));
                // Pode haver mais de um, geralmente é o que está visivel no modal
                const inputSetor = inputs.find(i => i.offsetParent !== null); // Visivel

                if (inputSetor) {
                    this.ui.log(`Preenchendo Setor: ${setorDesejado}`);
                    DOMHelper.digitarAngular(inputSetor, setorDesejado);

                    // Tenta confirmar a seleção da lista (dropdown)
                    await DOMHelper.sleep(1000);

                    // Verificar se apareceu opção para clicar
                    const opcao = document.querySelector('.ng-option');
                    if (opcao) {
                        opcao.click();
                        this.ui.log("✔ Opção de setor clicada.");
                    } else {
                        // Tentar Enter
                        const enterEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter' });
                        inputSetor.dispatchEvent(enterEvent);
                    }

                    this.ui.log("✅ Setor preenchido!");
                    alert("Tudo pronto! Verifique o setor e clique em CONFIRMAR manualmente.");

                } else {
                    this.ui.log("❌ Input de Setor não encontrado.");
                    alert("Não achei o campo de Setor. Preencha manualmente.");
                }

            } catch (e) {
                console.error(e);
                this.ui.log("❌ Erro na transf: " + e.message);
                alert("Erro ao tentar transferir.");
            }
        }
    }

    // --- INICIALIZAÇÃO ---
    const bot = new HebronBot();
    bot.init();

})();
