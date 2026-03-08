const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// CORRETOR AUTOMÁTICO DE URL (Precisa vir ANTES do require do Cloudinary)
if (process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_URL.startsWith('cloudinary://')) {
  process.env.CLOUDINARY_URL = 'cloudinary://' + process.env.CLOUDINARY_URL;
}

const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// === CONFIGURAÇÃO CLOUDINARY ===
// O usuário fornecerá essas chaves via Vercel/Railway depois, e usaremos fallbacks locais para simulação caso não existam
if (process.env.CLOUDINARY_URL) {
  // A SDK do Cloudinary se autoconfigura sozinha se achar a variável CLOUDINARY_URL formatada certa
  console.log("✅ Conectado ao Cloudinary via CLOUDINARY_URL (Produção)");
} else {
  // Modo de Segurança / Simulação antes do usuário entregar as senhas
  console.log("⚠️ Chaves do Cloudinary ausentes. Rodando em Modo Simulado (MOCK).");
}

/**
 * ROTA PRINCIPAL: Lista os Modelos (Álbuns)
 * Na estrutura do Cloudinary:
 * 1. Pesquisamos pastas dentro da raiz 'Modelos'
 * 2. Para cada pasta, buscamos suas fotos
 */
app.get('/api/models', async (req, res) => {
  const searchQuery = req.query.search || '';
  const pageToken = parseInt(req.query.pageToken) || 0; // O Token agora é nossa base matemática de Offset (0, 15, 30)
  const LIMIT = 15;

  if (!process.env.CLOUDINARY_URL) {
    // Modo Simulação se usuário não botou a senha ainda
    if (pageToken > 0) return res.json({ models: [], nextPageToken: null });
    return res.json({
      models: [
        {
          id: 'mock1',
          name: 'Modelo Cloudinary Simulado 1',
          images: [{ name: 'img1', url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' }]
        },
        {
          id: 'mock2',
          name: 'Modelo Cloudinary Simulado 2',
          images: [{ name: 'img2', url: 'https://res.cloudinary.com/demo/image/upload/cld-sample.jpg' }]
        }
      ],
      nextPageToken: null
    });
  }

  try {
    // ABORDAGEM FREE-TIER: Pega todos os recursos físicos dentro de "Modelos" de uma vez pra escapar do bloqueio do sub_folders()
    const resourcesRes = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'Modelos/',
      max_results: 500, // Puxa logo meio milheiro de imagens para o NodeJS mapear e agrupar
      tags: true // Puxa as Tags (+18 / sfw) adicionadas pelo robô da Gemini Vision
    });

    if (!resourcesRes.resources || resourcesRes.resources.length === 0) {
      return res.json({ models: [], nextPageToken: null });
    }

    // Ordena da mais recente para a mais antiga globalmente
    const sortedAll = resourcesRes.resources.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Agrupamento na Munheca (JavaScript puro):
    const albumsMap = {};

    for (const img of sortedAll) {
      // API_Resources Free retorna "asset_folder" e não "folder"
      const folderPath = img.asset_folder || img.folder;
      
      if (!folderPath) continue; // Pula imagens perdidas sem pasta

      // Ignora arquivos soltos direto na raiz Modelos (se tiver)
      if (folderPath === 'Modelos') continue;
      if (folderPath === 'Showcase') continue; // Ignora se vier misturado acidentalmente
      
      const folderName = folderPath.replace('Modelos/', ''); // "Busto Homem de Ferro"

      if (!albumsMap[folderPath]) {
        albumsMap[folderPath] = {
          id: folderPath,
          name: folderName,
          images: [],
          isNsfw: false, // Pressupõe Livre até achar Prova do Contrário
          isSfw: false   // Nova flag para saber se já foi validado manualmente como Livre
        };
      }

      // Se qualquer recurso da galeria detiver NUDEZ, carimba a pasta inteira.
      if (img.tags && img.tags.includes('nsfw')) {
        albumsMap[folderPath].isNsfw = true;
      }
      // Registra também se já foi explicitamente classificado como SFW no painel
      if (img.tags && img.tags.includes('sfw')) {
        albumsMap[folderPath].isSfw = true;
      }

      albumsMap[folderPath].images.push({
        name: img.filename,
        url: img.secure_url
      });
    }

    // Transforma o Objeto agrupado em Array
    let allModels = Object.values(albumsMap);

    // BÔNUS PESQUISA GLOBAL: O Backend varre todo o armazenamento de imagens filtrando silenciosamente Pela string do App React
    if (searchQuery) {
      const lowerSearch = searchQuery.toLowerCase();
      allModels = allModels.filter(m => m.name.toLowerCase().includes(lowerSearch));
    }

    // APLICAÇÃO DE PAGINAÇÃO MATEMÁTICA: Pega da Gaveta Atual até a Gaveta Atual + 15
    const validModels = allModels.slice(pageToken, pageToken + LIMIT);
    const nextOffset = pageToken + LIMIT;
    const hasMore = nextOffset < allModels.length;

    res.json({
      models: validModels,
      nextPageToken: hasMore ? nextOffset.toString() : null
    });

  } catch (error) {
    console.error("Erro /api/models (Cloudinary):", error);
    res.status(500).json({ error: 'Falha ao buscar modelos no Storage', details: error.message || error.error?.message || error.toString() });
  }
});

/**
 * ROTA ADMIN POST: Aplica etiquetas (SFW ou NSFW) a uma pasta inteira no Cloudinary.
 * O Frontend do Painel Admin enviará o 'folderId' e a 'tag'.
 */
app.post('/api/admin/tag', async (req, res) => {
  const { folderId, tag } = req.body;
  if (!process.env.CLOUDINARY_URL) {
    return res.status(200).json({ success: true, mock: true, message: 'Modo simulação. Tagging não efetuado.' });
  }

  if (!folderId || !['nsfw', 'sfw'].includes(tag)) {
    return res.status(400).json({ error: 'Parâmetros inválidos. Informe folderId e tag ("nsfw" ou "sfw").' });
  }

  try {
    // 1. Pega todas as imagens dentro daquela pasta específica do modelo
    const resourcesRes = await cloudinary.api.resources({
      type: 'upload',
      prefix: folderId + '/', // A barra no final garante que não puxe nomes parecidos
      max_results: 500
    });

    if (!resourcesRes.resources || resourcesRes.resources.length === 0) {
      return res.status(404).json({ error: 'Nenhuma imagem encontrada nesta pasta.' });
    }

    const publicIds = resourcesRes.resources.map(img => img.public_id);

    // 2. Aplica a tag no grupo inteiro (Economiza chamadas de rede no Cloudinary)
    await cloudinary.uploader.add_tag(tag, publicIds);

    // 3. Remove a tag oposta para não gerar conflitos futuros
    const oppositeTag = tag === 'nsfw' ? 'sfw' : 'nsfw';
    try {
      await cloudinary.uploader.remove_tag(oppositeTag, publicIds);
    } catch(e) { /* Ignora se a tag oposta não existir */ }

    console.log(`✅ Pasta "${folderId}" classificada como [${tag.toUpperCase()}] por comando Manual.`);
    return res.json({ success: true, message: `Tag ${tag} aplicada com sucesso.` });
  } catch (error) {
    console.error("Erro /api/admin/tag:", error);
    res.status(500).json({ error: 'Falha ao classificar a pasta.', details: error.message || error.toString() });
  }
});

/**
 * ROTA PÚBLICA DE DENÚNCIA (ON-DEMAND AI)
 * Aciona o cérebro da Google Gemini apenas para uma imagem em um report específico.
 */
app.post('/api/report', async (req, res) => {
  const { folderId, imageUrl } = req.body;
  if (!process.env.GEMINI_API_KEY) {
     return res.status(500).json({ error: 'Filtro Automático de IA offline. Apenas moderação manual disponível.' });
  }
  
  try {
     const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
     const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

     // 1. Baixa a foto apontada
     const imgRes = await fetch(imageUrl);
     const arrayBuffer = await imgRes.arrayBuffer();
     const buffer = Buffer.from(arrayBuffer);

     // 2. IA Inspeciona a foto em frações de segundo
     const prompt = 'Analise esta imagem de um modelo 3D/miniatura. Ela contém nudez explícita, sensualização extrema (foco indevido em partes íntimas se for feminina), ou conteúdo sexual destinado para adultos (+18)? Responda APENAS com "SIM" ou "NAO".';
     
     const iaResponse = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: buffer.toString('base64') } },
              { text: prompt }
            ]
          }
        ],
        generationConfig: { temperature: 0.0 } // 100% Preciso, sem criatividade
     });

     const isAdult = iaResponse.response.text().trim().toUpperCase().includes('SIM');

     if (isAdult) {
        // Se for +18 mesmo, pune a pasta inteira no servidor Cloudinary para blindar ela imediamante na vitrine
        const resourcesRes = await cloudinary.api.resources({ type: 'upload', prefix: folderId + '/', max_results: 500 });
        if (resourcesRes.resources && resourcesRes.resources.length > 0) {
           const publicIds = resourcesRes.resources.map(img => img.public_id);
           await cloudinary.uploader.add_tag('nsfw', publicIds);
           console.log(`🚨 [DENÚNCIA PROCEDE] Gemini AI marcou a pasta "${folderId}" como +18.`);
           return res.json({ success: true, banned: true, message: 'Conteúdo Removido Imediatamente pelo Sistema.' });
        }
     } else {
        // Alarme falso do cliente/criança que quis sacanear o botão
        console.log(`ℹ️ [DENÚNCIA Falsa] A pasta "${folderId}" é segura. Denúncia arquivada.`);
        return res.json({ success: true, banned: false, message: 'O conteúdo foi analisado mas considerado seguro.' });
     }
  } catch (err) {
      console.error("Erro no /api/report (Gemini Engine):", err.message);
      res.status(500).json({ error: 'Sistema Analítico ocupado. A equipe manual verificará sua denúncia em breve!', details: err.message || err.toString() });
  }
});

/**
 * ROTA SHOWCASE (HOME): Pegas as fotos de uma pasta específica
 * O frontend usa isso para montar o banner rotativo animado.
 */
app.get('/api/showcase', async (req, res) => {
  if (!process.env.CLOUDINARY_URL) {
    return res.json({
      images: [
        { name: 'Mock 1', url: 'https://images.unsplash.com/photo-1608889825103-eb5ed706fc64?w=800&h=400&fit=crop' },
        { name: 'Mock 2', url: 'https://images.unsplash.com/photo-1549313861-3358f54407b3?w=800&h=400&fit=crop' },
        { name: 'Mock 3', url: 'https://images.unsplash.com/photo-1588666309990-d68f08e3d4a6?w=800&h=400&fit=crop' }
      ]
    });
  }

  try {
    // Puxa as fotos apenas da pasta Showcase via API padrão para não quebrar limite Free
    const response = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'Showcase/',
      max_results: 15
    });

    if (response.resources && response.resources.length > 0) {
      const sortedResources = response.resources.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      const showcaseImages = sortedResources.map(img => ({
        name: img.filename,
        url: img.secure_url
      }));
      res.json({ images: showcaseImages });
    } else {
      res.json({ images: [] });
    }
  } catch (err) {
    console.warn(`[SHOWCASE] Erro Cloudinary:`, err);
    res.json({ images: [], error: 'Falha ao recuperar Showcase', details: err.message || err.error?.message || err.toString() });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rolando na porta ${PORT}`);
    console.log(`🔌 Conectado ao Storage via Cloudinary CDN!`);
  });
}

module.exports = app;
