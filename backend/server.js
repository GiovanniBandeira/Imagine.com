require('dotenv').config();

// CORRETOR AUTOMÁTICO DE URL (Precisa vir ANTES do require do Cloudinary)
if (process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_URL.startsWith('cloudinary://')) {
  process.env.CLOUDINARY_URL = 'cloudinary://' + process.env.CLOUDINARY_URL;
}

const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;

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
  const nextCursor = req.query.pageToken || null;
  const LIMIT = 15;

  if (!process.env.CLOUDINARY_URL) {
    // Modo Simulação se usuário não botou a senha ainda
    if (nextCursor) return res.json({ models: [], nextPageToken: null });
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
      max_results: 500 // Puxa logo meio milheiro de imagens para o NodeJS mapear e agrupar
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
          images: []
        };
      }

      albumsMap[folderPath].images.push({
        name: img.filename,
        url: img.secure_url
      });
    }

    // Transforma o Objeto agrupado em Array e aplica Limite de Paginação do Infinite Scroll (15 items)
    const allModels = Object.values(albumsMap);
    const validModels = allModels.slice(0, LIMIT);

    res.json({
      models: validModels,
      nextPageToken: validModels.length === allModels.length ? null : 'END_OF_PAGE'
    });

  } catch (error) {
    console.error("Erro /api/models (Cloudinary):", error);
    res.status(500).json({ error: 'Falha ao buscar modelos no Storage', details: error.message || error.error?.message || error.toString() });
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
