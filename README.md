# Finance App 

Um aplicativo de gestão financeira pessoal **local-first** focado em privacidade, velocidade e experiência móvel (Mobile-First). Construído com React, TypeScript e armazenamento em IndexedDB, seus dados ficam com você.

##  Funcionalidades
- **100% Offline (Local-First):** Seus dados são salvos diretamente no seu navegador usando o banco de dados `Dexie.js` (IndexedDB). O aplicativo funciona instantaneamente sem depender de um servidor backend.
- **Sincronização em Nuvem:** Faça login com sua conta do Google e o aplicativo fará o backup automático dos seus dados na pasta oculta (`appDataFolder`) do seu Google Drive. Isso permite que você acesse seus dados de qualquer dispositivo sem expor seus arquivos no Drive público.
- **Contas e Saldos Múltiplos:** Gerencie saldos em diversas contas bancárias, além do clássico "Dinheiro Físico".
- **Ganhos e Gastos Fixos:** Configure despesas e rendimentos recorrentes para que o Dashboard projete seu saldo final nos próximos meses automaticamente.
- **Parcelamentos:** Adicione compras parceladas e veja como o seu orçamento de longo prazo será impactado.
- **Modo Escuro Premium:** UI responsiva e moderna feita em CSS puro, utilizando uma paleta de cores Roxo Escuro pensada para dispositivos móveis.

##  Como Executar Localmente

### Pré-requisitos
- Node.js instalado

### Instalação e Execução
1. Clone este repositório:
   ```bash
   git clone https://github.com/seu-usuario/finance.git
   cd finance/frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Acesse em seu navegador: `http://localhost:5173/`

## Tecnologias Utilizadas
- [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
- [Lucide Icons](https://lucide.dev/)
- [Google Identity Services / Drive API](https://developers.google.com/identity)

## Uso de IA's
Este projeto foi idealizado e desenvolvido em par com uma Inteligência Artificial (Google DeepMind Antigravity AI Agent). A arquitetura do código, o design da UI e as integrações foram desenvolvidas através de requisições interativas.
