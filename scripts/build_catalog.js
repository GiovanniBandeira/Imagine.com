require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { google } = require('googleapis');
const nsfw = require('nsfwjs');
const tf = require('@tensorflow/tfjs-node');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURAÇÃO DO CLOUDINARY
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

if (process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_URL.startsWith('cloudinary://')) {
  process.env.CLOUDINARY_URL = 'cloudinary://' + process.env.CLOUDINARY_URL;
}

// ============================================
// CONFIGURAÇÕES DO EXTRATOR
// ============================================
const PASTA_ID_RAIZ = 'INSERIR_ID_DA_PASTA_MODELOS_AQUI'; // Lojista: O código que fica no link URL do Drive
const AMOSTRAS_POR_SUBCATEGORIA = 5;
const LIMIAR_NSFW = 0.6;
const OUTPUT_FILE = path.join(__dirname, '../src/data/galeria.json');

// Autorização da API do Drive via Conta de Serviço
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'gcp-credentials.json'), // Lojista deverá baixar este arquivo do Console do Google
  scopes: ['https://drive.google.com/drive/folders/1kDeJoqjFnsus3WOoWPTWgHHN8Ji9Wbcv?usp=drive_link'],
});
const drive = google.drive({ version: 'v3', auth });

/**
 * Faz o Download de um Arquivo do Drive direto para a Memória RAM do Script (Buffer)
 */
async function baixarArquivoMemoria(fileId) {
  try {
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
  } catch (err) {
    console.error(`Erro ao baixar arquivo ${fileId}:`, err.message);
    return null;
  }
}

/**
 * Função para injetar Stream da Memória RAM (Buffer) diretamente no Uploader do Cloudinary sem salvar no Disco
 */
const uploadBufferToCloudinary = (buffer, folderPath) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folderPath, format: 'webp', quality: 'auto' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

async function processarNuvem() {
  console.log('🚀 Conectando Inteligência Artificial e API do Google Drive...');

  // 1. Inicia IA
  let model;
  try {
    model = await nsfw.load();
    console.log('✅ Inteligência Artificial de Visão carregada!');
  } catch (e) {
    console.error('❌ Falha ao carregar a IA Tensorflow:', e);
    return;
  }

  // Verifica se o lojista já salvou as senhas de Serviço do Google
  if (!fs.existsSync(path.join(__dirname, 'gcp-credentials.json'))) {
    console.error('❌ FATAL: Arquivo de Credenciais gcp-credentials.json do Serviço do Google não encontrado na pasta scripts/ !');
    console.log('💡 DICA: Vá no painel do Google Cloud Platform > Contas de Serviço > Criar Chave > Coloque nesta pasta com este nome exato.');
    return;
  }
  if (PASTA_ID_RAIZ === 'INSERIR_ID_DA_PASTA_MODELOS_AQUI') {
    console.error('❌ FATAL: Você não informou qual a "Tag/Id" da pasta raiz compartilhada na linha 22 do código.');
    return;
  }

  const galeria = [];

  try {
    console.log('📂 Acessando nuvem: Consultando Categorias Raiz...');
    const rootRes = await drive.files.list({
      q: `'${PASTA_ID_RAIZ}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });
    const categorias = rootRes.data.files;

    for (const cat of categorias) {
      console.log(`\n📦 Explorando Categoria: [${cat.name}]`);
      const subRes = await drive.files.list({
        q: `'${cat.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
      });
      const subcategorias = subRes.data.files;

      for (const sub of subcategorias) {
        // Recupera lista de fotos puras dentro dessa gaveta (Busto de Fulano)
        const imgRes = await drive.files.list({
          q: `'${sub.id}' in parents and mimeType contains 'image/' and trashed=false`,
          fields: 'files(id, name)',
        });
        const arquivos = imgRes.data.files;
        if (!arquivos || arquivos.length === 0) continue;

        // Sorteia N amostras usando embaralhamento rápido
        const selecionados = arquivos.sort(() => 0.5 - Math.random()).slice(0, AMOSTRAS_POR_SUBCATEGORIA);
        console.log(`   └─ Gaveta: [${sub.name}] -> Puxando da internet as ${selecionados.length} melhores poses...`);

        for (const foto of selecionados) {
          const buffer = await baixarArquivoMemoria(foto.id);
          if (!buffer) continue;

          try {
            // LÓGICA TENSORFLOW (Decodifica o ArrayBuffer da Nuvem)
            const imgTensor = tf.node.decodeImage(buffer, 3);
            const predictions = await model.classify(imgTensor);
            imgTensor.dispose(); // Destroi a imagem da Memória (Limpa Lixo)

            const neutralProb = predictions.find(p => p.className === 'Neutral')?.probability || 0;
            const drawingProb = predictions.find(p => p.className === 'Drawing')?.probability || 0;
            const isSafe = (neutralProb + drawingProb) > LIMIAR_NSFW;

            if (isSafe) {
              console.log(`      ⭐ [SEGURO] ${foto.name} -> Transferindo para a Alta-Disponibilidade Cloudinary...`);

              // Envia o que restou na memória RAM pro Cloudinary empinar no site global
              const res = await uploadBufferToCloudinary(buffer, `catalogo_3d/${cat.name.replace(/\s+/g, '_')}/${sub.name.replace(/\s+/g, '_')}`);

              galeria.push({
                id: res.public_id,
                title: sub.name,
                fileName: foto.name.replace(/\.[^/.]+$/, ""),
                category: cat.name,
                subcategory: sub.name,
                url: res.secure_url,
                createdAt: res.created_at
              });

            } else {
              // DESCARTADO POR CONTEÚDO IMPRÓPRIO NSFW
              const p18 = predictions.find(p => p.className === 'Porn')?.probability || 0;
              const s18 = predictions.find(p => p.className === 'Sexy')?.probability || 0;
              const h18 = predictions.find(p => p.className === 'Hentai')?.probability || 0;
              console.log(`      🚨 [BLOQUEADO PELA IA] ${foto.name} -> Porn:${(p18 * 100).toFixed(0)}% Sexy:${(s18 * 100).toFixed(0)}% Hentai:${(h18 * 100).toFixed(0)}%`);
            }
          } catch (tensorErr) {
            console.log(`      ⚠️  A foto ${foto.name} estava corrompida. Ignorando.`);
          }
        }
      }
    }

    // Gravando o Compilado Final (A Matriz!)
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(galeria, null, 2));
    console.log(`\n🎉 Operação em Nuvem Finalizada! O seu Site agora possui um JSON estático com ${galeria.length} modelos ultra-rápidos e seguros.`);
    console.log(`✅ O Frontend React se encarregará de usar as categorias descobertas automaticamente.`);

  } catch (e) {
    console.error('❌ ERRO NA LEITURA DO GOOGLE DRIVE: ', e.message);
  }
}

processarNuvem();
