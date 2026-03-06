const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// === CONFIGURAÇÃO OAUTH 2.0 ===
const KEYFILEPATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

let drive;
let oAuth2Client;
let useMock = false;

try {
  let credentials;
  // 1. Tenta carregar do Cofre (Railway Environment Variables)
  if (process.env.GOOGLE_CREDENTIALS) {
    console.log("[OAUTH] Carregando chaves via Variáveis de Ambiente (Produção)...");
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } else {
    // 2. Fica no arquivo físico (Localhost)
    credentials = JSON.parse(fs.readFileSync(KEYFILEPATH));
  }
  
  const { client_secret, client_id, redirect_uris } = credentials.web;
  oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  try {
    let tokenData;
    if (process.env.GOOGLE_TOKEN) {
      tokenData = JSON.parse(process.env.GOOGLE_TOKEN);
    } else {
      tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH));
    }
    oAuth2Client.setCredentials(tokenData);
    console.log("✅ Token de acesso encontrado! Servidor já está autenticado.");
  } catch (err) {
    console.log("⚠️ Servidor não está autenticado ainda. Você precisa acessar a Rota /login primeiro!");
  }

  drive = google.drive({ version: 'v3', auth: oAuth2Client });
} catch (err) {
  console.log("⚠️ Arquivo/Variável client_secret não encontrado. Iniciando no modo MOCK (Simulação) para testes E2E/Locais.");
  useMock = true;
  oAuth2Client = {
    generateAuthUrl: () => 'http://localhost:3000/mock-login-simulado',
  };
}

/**
 * ROTA DE LOGIN: Acesse localhost:3000/login no navegador para dar a permissão
 */
app.get('/login', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline', // Pede para gerar um Refresh Token que nunca expira
    scope: SCOPES,
    prompt: 'consent' // Força o Google a sempre exibir a tela e devolver o Refresh Token
  });
  res.redirect(authUrl);
});

/**
 * ROTA DE CALLBACK: O Google te joga de volta pra cá após você aceitar
 */
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    // Salva o token no computador para o Servidor lembrar pra sempre!
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    res.send('<h1>✅ Autenticação concluída!</h1><p>O servidor agora está conectado à sua conta do Google Drive com sucesso. Você pode fechar esta aba e testar a pesquisa no site principal.</p>');
    console.log("✅ Token salvo com sucesso em token.json!");
  } catch (error) {
    console.error('Erro ao recuperar o token:', error);
    res.status(500).send('Erro na autorização');
  }
});

// === CACHE EM MEMÓRIA PARA PESQUISA RÁPIDA ===
let CACHED_FOLDERS = [];
let isCacheBuilding = false;
let cacheLastBuilt = 0;

/**
 * Faz uma varredura (BFS) profunda no Drive para achar todas as subpastas.
 * Fica em cache para que a navegação do site (paginação) seja instantânea.
 */
async function buildFolderCache(rootId) {
  if (isCacheBuilding) return;
  isCacheBuilding = true;
  console.log(`[CACHE] Iniciando varredura profunda de pastas a partir da raiz...`);

  try {
    let queue = [{ id: rootId, name: 'Raiz', depth: 0 }];
    let discoveredFolders = [];

    while (queue.length > 0) {
      const current = queue.shift();

      console.log(`[CACHE] Consultando Pasta: ${current.name} (Profundidade ${current.depth})`);

      // Limite de profundidade para não travar o servidor (Vai até pastas de 3º nível)
      if (current.depth > 3) continue;

      try {
        const q = `'${current.id}' in parents and trashed = false`;
        const res = await drive.files.list({
          q: q,
          fields: 'files(id, name, mimeType, shortcutDetails)',
          pageSize: 1000
        });

        for (const file of res.data.files) {
          const lowerName = file.name.toLowerCase();
          
          // SPEED HACK: Ignora a pasta de atualização inteira pra não perder tempo extraindo imagens dela atoa
          if (lowerName.includes('atualiza') || lowerName.includes('pedidos') || lowerName.includes('finalizad')) {
            continue;
          }

          const newPathName = current.name === 'Raiz' ? file.name : `${current.name} - ${file.name}`;
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            discoveredFolders.push({ id: file.id, name: newPathName, type: 'folder' });
            queue.push({ id: file.id, name: newPathName, depth: current.depth + 1 });
          } else if (file.mimeType === 'application/vnd.google-apps.shortcut') {
            if (file.shortcutDetails && file.shortcutDetails.targetMimeType === 'application/vnd.google-apps.folder') {
              discoveredFolders.push({ id: file.shortcutDetails.targetId, name: newPathName, type: 'shortcut' });
              queue.push({ id: file.shortcutDetails.targetId, name: newPathName, depth: current.depth + 1 });
            }
          }
        }

        // Atualiza a memória aos poucos (Partial Cache Hit support)
        CACHED_FOLDERS = discoveredFolders.filter(f => f.name !== 'Raiz');
      } catch (e) {
        console.warn(`[CACHE AVISO] Sem permissão para ler a pasta: ${current.name}`);
      }
    }

    // Ordena alfabeticamente Z-A para as mais novas (como Dezembro, Novembro) aparecerem primeiro
    discoveredFolders.sort((a, b) => b.name.localeCompare(a.name));

    // Conforme o cache é construído no loop principal, podemos alimentá-lo
    CACHED_FOLDERS = discoveredFolders.filter(f => f.name !== 'Raiz');
    cacheLastBuilt = Date.now();
    console.log(`[CACHE PARCIAL] Foram mapeadas ${CACHED_FOLDERS.length} subpastas até agora...`);

  } catch (err) {
    console.error(`[CACHE ERRO] Falha ao construir árvore:`, err.message);
  } finally {
    isCacheBuilding = false;
  }
}

/**
 * ROTA PRINCIPAL: Lista os Modelos (Álbuns)
 * Suporta Paginação via query param `?pageToken=NUMERO` (onde NUMERO é o offset na array)
 */
app.get('/api/models', async (req, res) => {
  // === ID DA PASTA RAIZ COM OS ATALHOS ===
  const ROOT_FOLDER_ID = '1kDeJoqjFnsus3WOoWPTWgHHN8Ji9Wbcv';

  // Se o cache estiver vazio ou muito velho, recria EM BACKGROUND (sem travar)
  if (CACHED_FOLDERS.length === 0 || Date.now() - cacheLastBuilt > 3600000) {
    // Não usamos "await". O processo roda assíncrono.
    buildFolderCache(ROOT_FOLDER_ID);
  }

  // Avisa o Frontend se ele deve ficar tentando recarregar em breve
  res.setHeader('x-cache-status', isCacheBuilding ? 'building' : 'ready');

  const offset = parseInt(req.query.pageToken, 10) || 0;
  const LIMIT = 15; // Retorna 15 modelos por vez

  if (useMock) {
    if (offset > 0) return res.json({ models: [], nextPageToken: null });
    
    return res.json({
      models: [
        {
          id: 'mock1',
          name: 'Modelo Simulado 1 (Mock)',
          images: [{ name: 'img1', url: 'https://images.unsplash.com/photo-1608889825103-eb5ed706fc64?w=500&h=500&fit=crop' }]
        },
        {
          id: 'mock2',
          name: 'Modelo Simulado 2 (Mock)',
          images: [{ name: 'img2', url: 'https://images.unsplash.com/photo-1549313861-3358f54407b3?w=500&h=500&fit=crop' }]
        }
      ],
      nextPageToken: null
    });
  }

  try {
    console.log(`[DEBUG] Nova requisição /api/models. Offset: ${offset}`);
    const allTargets = CACHED_FOLDERS;

    let result = [];
    let cursor = offset;

    // Busca até preencher o LIMIT (15) ou acabar as pastas do cache
    while (result.length < LIMIT && cursor < allTargets.length) {
      // Pega um lote de 10 pastas para checar em paralelo (acelera MUITO a resposta)
      const batchSize = 10;
      const batch = allTargets.slice(cursor, cursor + batchSize);
      cursor += batch.length;

      console.log(`[DEBUG] Analisando lote de ${batch.length} pastas para achar álbuns com imagens...`);

      const batchPromises = batch.map(async (target) => {
        try {
          const q = `'${target.id}' in parents and mimeType contains 'image/' and trashed = false`;
          const imagesRes = await drive.files.list({
            q: q,
            fields: 'files(id, name, mimeType)',
            pageSize: 50
          });

          if (imagesRes.data.files && imagesRes.data.files.length > 0) {
            
            // FILTRA AS IMAGENS: Remove as fotos administrativas que o usuário não quer ver ("A a Z.png", etc)
            const validImages = imagesRes.data.files.filter(img => {
              const nameLow = img.name.toLowerCase();
              if (nameLow.includes('a a z')) return false;
              if (nameLow.includes('envie seu pedido aqui')) return false;
              if (nameLow.includes('recesso')) return false; // Adicionei recesso pois vi no seu console!
              return true; // Se passar por tudo, a imagem é um produto válido
            });

            // Se depois de filtrar as regras, a pasta sobrou vazia (só tinha imagem de aviso dento dela), a gente ignora a pasta inteira.
            if (validImages.length === 0) return null;

            const imagesMapped = validImages.map(img => ({
              name: img.name,
              url: `/api/image/${img.id}`
            }));

            return {
              id: target.id,
              name: target.name,
              images: imagesMapped
            };
          }
        } catch (innerErr) {
          // Silencia avisos de permissão para não sujar o terminal
        }
        return null; // Retorna nulo se for uma pasta vazia/estrutural (ex: "Meses")
      });

      // Roda as 10 requisições do Drive ao mesmo tempo!
      const batchResults = await Promise.all(batchPromises);

      // Filtra só as pastas que de fato tinham imagens e adiciona no resultado final
      for (const validAlbum of batchResults) {
        if (validAlbum) {
          result.push(validAlbum);
          if (result.length === LIMIT) break; // Trava exatamente no limite (15)
        }
      }
    }

    const nextOffset = cursor < allTargets.length ? cursor : null;

    // 3. (Opcional) Adiciona imagens soltas na raiz da sua própria pasta, apenas na página 1
    if (offset === 0) {
      try {
        const qRoot = `'${ROOT_FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`;
        const rootImgRes = await drive.files.list({
          q: qRoot,
          fields: 'files(id, name)',
          pageSize: 20
        });

        if (rootImgRes.data.files && rootImgRes.data.files.length > 0) {
          const looseImages = rootImgRes.data.files.map(img => ({
            name: img.name,
            url: `/api/image/${img.id}`
          }));

          result.unshift({
            id: ROOT_FOLDER_ID + "_main",
            name: "Outros Mimos",
            images: looseImages
          });
        }
      } catch (e) { }
    }

    console.log(`[DEBUG] Enviando resposta para o Frontend com ${result.length} modelos processados.`);
    return res.json({
      models: result,
      nextPageToken: nextOffset ? nextOffset.toString() : null
    });

  } catch (error) {
    console.error("Erro Crítico /api/models:", error);
    res.status(500).json({ error: error.toString() });
  }
});

// Força a recriação do cache (útil para adicionar um botão de 'Atualizar' no Site depois)
app.get('/api/refresh-cache', async (req, res) => {
  const ROOT_FOLDER_ID = '1kDeJoqjFnsus3WOoWPTWgHHN8Ji9Wbcv';
  await buildFolderCache(ROOT_FOLDER_ID);
  res.send('Cache atualizado com sucesso!');
});

/**
 * ROTA PROXY DE IMAGEM: Contorna o problema de Imagem Privada e CORS
 * O Frontend do React vai fazer <img src="http://localhost:3000/api/image/ID_DA_IMAGEM">
 * Nosso servidor, como tem credenciais do robô, faz o download do Drive e entrega os bytes em Stream direto pro navegador!
 */
app.get('/api/image/:id', async (req, res) => {
  try {
    const fileId = req.params.id;

    // Descobre o MimeType real
    const meta = await drive.files.get({
      fileId: fileId,
      fields: 'mimeType, size'
    });

    res.setHeader('Content-Type', meta.data.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Manda o navegador salvar a imagem por 24h para não gastar dados!

    // Transmite a imagem em Stream (Muito mais rápido e leve que Base64)
    const result = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    }, { responseType: 'stream' });

    result.data
      .on('end', () => { })
      .on('error', err => {
        console.error('Erro no Stream:', err);
        if (!res.headersSent) res.status(500).send('Erro ao baixar imagem');
      })
      .pipe(res);

  } catch (err) {
    console.error("Erro /api/image:", err.message);
    if (!res.headersSent) res.status(500).send('Erro ao carregar recurso visual');
  }
});

/**
 * ROTA SHOWCASE (HOME): Pegas as fotos de uma pasta específica (ex: Modelos Finalizados)
 * O frontend usa isso para montar o banner rotativo animado.
 */
app.get('/api/showcase', async (req, res) => {
  // ATENÇÃO: É preciso substituir isso pelo ID real da pasta "Modelos/Finalizados" depois!
  const SHOWCASE_FOLDER_ID = '1SbKIJj_sXz1dQt-mqwsWpPCZ9cpC_TSa';

  if (useMock) {
    return res.json({
      images: [
        { name: 'Mock 1', url: 'https://images.unsplash.com/photo-1608889825103-eb5ed706fc64?w=800&h=400&fit=crop' },
        { name: 'Mock 2', url: 'https://images.unsplash.com/photo-1549313861-3358f54407b3?w=800&h=400&fit=crop' },
        { name: 'Mock 3', url: 'https://images.unsplash.com/photo-1588666309990-d68f08e3d4a6?w=800&h=400&fit=crop' }
      ]
    });
  }

  try {
    const q = `'${SHOWCASE_FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`;
    const response = await drive.files.list({
      q: q,
      fields: 'files(id, name)',
      pageSize: 15, // Puxa as 15 últimas fotos pra rodar no slider
      orderBy: 'createdTime desc' // Pega sempre as recém adicionadas
    });

    if (response.data.files && response.data.files.length > 0) {
      const showcaseImages = response.data.files.map(img => ({
        name: img.name,
        url: `/api/image/${img.id}` // Usa nosso proxy rápido
      }));
      res.json({ images: showcaseImages });
    } else {
      res.json({ images: [] });
    }
  } catch (err) {
    console.warn(`[SHOWCASE] Erro ou Pasta não configurada: ${err.message}`);
    res.json({ images: [], error: 'Pasta não configurada' });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rolando na porta ${PORT}`);
    console.log(`🔌 Conectado ao Google Apps via OAuth2!`);
  });
}

module.exports = app;
