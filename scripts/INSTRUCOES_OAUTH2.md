# Guia Rápido: Conectando Seu Próprio Drive ao Extrator

Como essas pastas não aceitam e-mails de fora, o nosso Script Extrator vai precisar operar logado na SUA conta do Google. Para conseguir isso, precisaremos baixar uma Ferramenta de Acesso chamada **Client ID (Oauth2 Desktop App)**.

Siga os passos abaixo (É mais fácil que o anterior!):

## 1. Acesse o Projeto Existente no Google Cloud:
1. Vá novamente em: **[https://console.cloud.google.com/](https://console.cloud.google.com/)**
2. Confira se o projeto "Catalogo Imagine" (ou o nome que você deu) está selecionado no topo da tela.

## 2. Configurar a "Telinha de Login" (Consent Screen)
O Google exige que a gente monte uma telinha onde você vai confirmar *"Sim, eu autorizo este script a ler meu drive"*.
1. Na pesquisa do topo, digite **Tela de consentimento OAuth** (OAuth consent screen) e clique na opção.
2. Vai perguntar o tipo de usuário. Escolha **Externo** (External) e clique em "Criar".
3. Preencha apenas o que tiver asterisco vermelho:
   - **Nome do app:** Extrator 3D
   - **E-mail de suporte:** (Coloque o seu)
   - **Informações do desenvolvedor (Lá embaixo):** (Coloque o seu e-mail de novo)
4. Clique em **Salvar e Continuar**.
5. Na tela de "Escopos" pule, apenas clique **Salvar e Continuar**.
6. Na tela de "Usuários de teste", clique em **Add Users** e coloque O SEU E-MAIL (O dono do Drive). Clique em **Salvar e Continuar**.

## 3. Gerar a Chave Desktop App (O Seu Token Secreto)
Agora vamos baixar o arquivo que o script precisa ler.
1. Na pesquisa do topo do Google Cloud, digite **Credenciais** e clique na opção Mágica ("API e Serviços > Credenciais").
2. No menu superior, clique em **+ CRIAR CREDENCIAIS**.
3. Escolha a segunda opção: **ID do cliente OAuth** (OAuth client ID).
4. No campo "Tipo de Aplicativo", escolha **App para computador** (Desktop app).
5. Nome: pode colocar "Script Node". Clique em **CRIAR**.
6. Uma janelinha vai abrir com letras e números e um botão de **Download JSON** no canto direito. Clique nele!
7. Jogue esse arquivo que baixou dentro da pasta `scripts` do seu Visual Studio Code.
8. Renomeie esse arquivo maldito com nome longo para apenas: **`credentials.json`** (tudo minúsculo!).

---

Pronto! **Apague aquele arquivo antigo `gcp-credentials.json` se ele ainda estiver aí**, e me avise quando o arquivo novo oficial (`credentials.json`) estiver aparecendo no seu VSCode. O Extrator já está engatilhado pra usar ele.
