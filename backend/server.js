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
    // 1. Busca subpastas (que representam os "Álbuns/Modelos") dentro da pasta raiz "Modelos"
    const foldersRes = await cloudinary.api.sub_folders('Modelos', { max_results: LIMIT, next_cursor: nextCursor });
    
    // Se não tiver pastas, retorna vazio
    if (!foldersRes.folders || foldersRes.folders.length === 0) {
      return res.json({ models: [], nextPageToken: null });
    }

    // 2. Para cada subpasta encontrada, busca as fotos lá de dentro
    const modelsPromises = foldersRes.folders.map(async (folder) => {
      try {
        const imagesRes = await cloudinary.search
          .expression(`folder:"${folder.path}"`)
          .sort_by('created_at', 'desc')
          .max_results(50)
          .execute();

        if (imagesRes.resources && imagesRes.resources.length > 0) {
          const imagesMapped = imagesRes.resources.map(img => ({
            name: img.filename,
            // O Cloudinary já nos dá a URL pública e segura pronta para uso, sem precisar de proxy!
            url: img.secure_url 
          }));

          return {
            id: folder.path, // Usamos o caminho como ID
            name: folder.name, // Nome final do modelo
            images: imagesMapped
          };
        }
      } catch (err) { }
      return null;
    });

    const results = await Promise.all(modelsPromises);
    const validModels = results.filter(m => m !== null); // Filtra pastas sem fotos

    res.json({
      models: validModels,
      nextPageToken: foldersRes.next_cursor || null
    });

  } catch (error) {
    console.error("Erro /api/models (Cloudinary):", error);
    res.status(500).json({ error: 'Falha ao buscar modelos no Storage' });
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
    // Puxa as fotos apenas da pasta Showcase
    const response = await cloudinary.search
      .expression('folder:"Showcase"')
      .sort_by('created_at', 'desc')
      .max_results(15)
      .execute();

    if (response.resources && response.resources.length > 0) {
      const showcaseImages = response.resources.map(img => ({
        name: img.filename,
        url: img.secure_url
      }));
      res.json({ images: showcaseImages });
    } else {
      res.json({ images: [] });
    }
  } catch (err) {
    console.warn(`[SHOWCASE] Erro Cloudinary: ${err.message}`);
    res.json({ images: [], error: 'Falha ao recuperar Showcase' });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rolando na porta ${PORT}`);
    console.log(`🔌 Conectado ao Storage via Cloudinary CDN!`);
  });
}

module.exports = app;
