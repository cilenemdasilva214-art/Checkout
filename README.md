# 💳 Secure Sandbox - Gateway Test Checkout

Um checkout de alta fidelidade visual (premium glassmorphic theme) desenvolvido para validar, formatar e salvar com total segurança rascunhos de cartões de crédito na sua própria base de dados do **Supabase**, projetado especificamente para hospedagem rápida e serverless na **Netlify**.

---

## 🌟 Recursos Premium Incluídos

*   **Design Ultramoderno (Deep Violet Glass)**: Efeito de vidro fosco (glassmorphism), gradientes vibrantes no fundo, transições de foco elegantes e micro-animações.
*   **Cartão 3D Interativo**:
    *   **Flip 3D Automático**: O cartão gira fisicamente para revelar o verso ao focar no campo CVV.
    *   **Detecção de Bandeira Dinâmica**: Identifica em tempo real (via regex) bandeiras como *Visa, Mastercard, American Express, Diners Club, Discover, JCB e Elo*, exibindo os respectivos logotipos na hora.
    *   **Atualização em Tempo Real**: Conforme o usuário digita, o nome do titular, número formatado (com espaçamento inteligente) e validade são refletidos visualmente.
*   **Formulário em Etapas (Accordion)**: Fluxo guiado em 3 passos intuitivos (Identificação, Endereço, Cartão) com validações animadas.
*   **Autocomplete de CEP (ViaCEP)**: Busca instantânea que autocompleta logradouro, bairro, cidade e estado assim que o CEP de 8 dígitos é preenchido.
*   **Modo Sandbox/Edição de Preços**: Permite alterar o preço do pacote em tempo real para testes rápidos de valor dinâmico (`amount`).
*   **Arquitetura 100% Segura**: Usa **Netlify Serverless Functions** como camada intermediária. As chaves de acesso do Supabase ficam seguras no servidor e nunca são expostas para o navegador do cliente.

---

## 🛠️ Tecnologia Utilizada

*   **Frontend**: HTML5 Semântico, Vanilla CSS3 (com Grid, Flexbox e Perspectiva 3D), Vanilla Javascript (ES6).
*   **Backend / API**: Netlify Serverless Functions (Node.js nativo - sem dependências de pacotes pesados para deploy ultraveloz).
*   **Banco de Dados**: Supabase (PostgreSQL) com triggers de auditoria e índices otimizados.

---

## 🚀 Como Configurar e Rodar Localmente

### 1. Preparar o Supabase
1. Acesse o console do seu projeto no **Supabase**.
2. Vá em **SQL Editor** e crie uma nova query.
3. Copie e cole todo o conteúdo do arquivo localizado em `supabase/01_card_checkout_test_raw.sql` no editor do Supabase e execute. Esse script criará a tabela `card_checkout_test_raw`, os índices e o trigger de sincronização de data (`updated_at`).

### 2. Rodar o Projeto Localmente
Como este projeto utiliza **Netlify Serverless Functions** para comunicação segura com o banco, a melhor forma de rodar localmente com suporte às funções serverless é utilizando a **Netlify CLI**.

1. **Instalar a CLI da Netlify** globalmente (caso não tenha):
   ```bash
   npm install -g netlify-cli
   ```

2. **Configurar as Variáveis de Ambiente**:
   Crie um arquivo chamado `.env` na raiz do projeto (ou duplique o `.env.example`) e adicione as suas chaves do Supabase:
   ```env
   SUPABASE_URL=https://seu-subdominio.supabase.co
   SUPABASE_ANON_KEY=sua-chave-anonima-publica
   ```

3. **Iniciar o Servidor de Desenvolvimento**:
   Na pasta raiz do projeto, execute:
   ```bash
   netlify dev
   ```
   A CLI da Netlify lerá o arquivo `netlify.toml`, carregará as variáveis do seu arquivo `.env`, compilará a função serverless localmente e abrirá o checkout no navegador (geralmente em `http://localhost:8888`).

---

## 🚀 Como Fazer o Deploy na Netlify (Produção)

Fazer o deploy deste projeto na Netlify é extremamente rápido e gratuito:

### Método 1: Pelo Painel Web da Netlify
1. Faça login na [Netlify](https://www.netlify.com/).
2. Clique em **Add new site** > **Import an existing project** (conecte seu repositório do GitHub/GitLab) ou simplesmente **arraste e solte** a pasta do projeto na área de upload manual.
3. No painel do site na Netlify, vá em **Site Configuration** > **Environment variables** > **Add a variable**.
4. Adicione as duas variáveis:
   *   `SUPABASE_URL`
   *   `SUPABASE_ANON_KEY`
5. Pronto! A Netlify detectará automaticamente o arquivo `netlify.toml`, configurará as rotas da função serverless em `/api/checkout` e o site estará online de forma segura.

### Método 2: Pela CLI da Netlify
Na pasta do projeto, execute os comandos:
```bash
# Logar na sua conta da Netlify
netlify login

# Inicializar o projeto no painel da Netlify
netlify init

# Configurar as variáveis de ambiente na produção
netlify env:set SUPABASE_URL "https://sua-url.supabase.co"
netlify env:set SUPABASE_ANON_KEY "sua-chave-anon"

# Fazer o deploy em produção
netlify deploy --prod
```

---

## 🛡️ Mock Mode (Teste Rápido sem Supabase)
Se você rodar o projeto localmente ou fizer deploy sem definir as variáveis de ambiente `SUPABASE_URL` e `SUPABASE_ANON_KEY`, a aplicação entrará automaticamente em **MOCK MODE**. 

Nesse modo, a Netlify Function simulará um salvamento bem-sucedido de transação, gerando um ID aleatório e retornando todo o JSON no modal do frontend. Isso permite validar e apresentar o fluxo completo do checkout instantaneamente sem precisar configurar nenhuma credencial logo de início!
