<div align="center">

# CRM & POS Automation Suite
### Enterprise Userscript for Bulk Operations

[🇺🇸 English](#-english) | [🇧🇷 Português](#-português)

</div>

---

<div id="-english"></div> 

## 🇺🇸 English

> **Note:** This repository contains a sanitized version of a productivity tool developed to automate workflows on a proprietary corporate ERP system. Sensitive data and specific URLs have been removed.

### 🚀 Overview
This project is a **Robotic Process Automation (RPA)** tool developed as a Tampermonkey userscript (JavaScript). It was designed to solve a critical bottleneck in the IT and Sales infrastructure: the manual execution of repetitive bulk actions for CRM (Doctors) and POS (Points of Sale) management.

Before this tool, the team had to manually navigate, search, and click through multiple screens for each record. This script injects a floating GUI into the browser, allowing for "Batch Processing" of hundreds of records, turning hours of manual work into minutes.

### ⚙️ Key Features

#### 🖥️ Injectable UI (User Interface)
- **Floating Control Panel:** A custom-built interface injected directly into the DOM, allowing users to control the bot without leaving the page.
- **Visual Feedback:** Includes a real-time progress bar and log console to monitor execution.

#### 🧠 Smart Logic & Persistence
- **State Persistence:** Uses `localStorage` to remember execution status (index, list, and mode) if the browser crashes or page reloads.
- **Context Awareness:** Automatically detects filters (e.g., "Inactive Users", "Region") before executing actions to ensure data integrity.

#### 🛠️ Operational Modes
1. **CRM Automation (Doctors):**
   - **Bulk Activation:** Iterates through a list of IDs, applies safety filters, and reactivates accounts.
   - **Bulk Transfer:** Automates the assignment of doctors to specific representatives.

2. **POS Automation (Points of Sale):**
   - **Smart Toggle:** Automatically enters the "Edit" mode to Add/Remove specific financial attributes.
   - **Direct Activation:** Bypasses the edit screen to activate POS accounts directly via the UI.

### 💻 Tech Stack
- **Language:** JavaScript (ES6+)
- **Environment:** Tampermonkey / Greasemonkey (Browser Context)
- **Core Concepts:** DOM Manipulation, Asynchronous Logic (Async/Await), LocalStorage API, Error Handling, Client-side scripting.

### 📉 Impact
- **Efficiency:** Reduced processing time for bulk updates by approximately **90%**.
- **Reliability:** Eliminated human error associated with repetitive clicking and form filling.
- **UX Improvement:** Provided a modern interface layer over a legacy web system.

---

<div id="-português"></div>

## 🇧🇷 Português

> **Nota:** Este repositório contém uma versão sanitizada de uma ferramenta desenvolvida para automatizar fluxos de trabalho em um sistema ERP corporativo. Dados sensíveis e URLs específicas foram removidos.

### 🚀 Resumo
Este projeto é uma ferramenta de **RPA (Automação de Processos Robóticos)** desenvolvida como um userscript do Tampermonkey. O objetivo foi resolver um gargalo na infraestrutura de TI e Vendas: a execução manual e repetitiva de ações em massa para gestão de CRMs (Médicos) e PDVs (Pontos de Venda).

Basicamente, transformamos horas de trabalho manual em minutos de processamento automático.

### ⚙️ Funcionalidades Principais

#### 🖥️ Interface Injetável (UI)
- **Painel de Controle Flutuante:** Uma interface injetada diretamente no DOM, permitindo controlar o bot sem sair da página.
- **Feedback Visual:** Barra de progresso em tempo real e console de logs.

#### 🧠 Lógica Inteligente & Persistência
- **Persistência de Estado:** Usa `localStorage` para lembrar onde parou (índice, lista e modo) caso a página recarregue.
- **Contexto:** Detecta filtros automaticamente antes de executar ações para garantir a integridade dos dados.

### 💻 Tecnologias
- **Linguagem:** JavaScript (ES6+)
- **Ambiente:** Tampermonkey (Browser Context)
- **Conceitos:** Manipulação de DOM, Lógica Assíncrona (Async/Await), LocalStorage API, Client-side scripting.

---

<div align="center">

**Developed by Nícolas Oliveira de Araújo (idogmal)**
<br>
IT Infrastructure Professional & Developer
<br>
[LinkedIn Profile](SEU_LINK_DO_LINKEDIN_AQUI)

</div>
