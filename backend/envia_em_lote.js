require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

/**
 * Mude este caminho para onde a pasta com todas as fotos estão no seu Notebook!
 * Exemplo: 'C:/Users/Giovanni/Pictures/Minhas Impressoes'
 */
const PASTA_NO_COMPUTADOR = 'COLOQUE_O_CAMINHO_AQUI'; 

// Nome da pasta raiz onde cairão os Álbuns dentro do site Cloudinary
const PASTA_RAIZ_CLOUDINARY = 'Modelos';

async function uploadFolder(localPath, cloudFolder) {
  try {
    const files = fs.readdirSync(localPath);

    for (const file of files) {
      const fullPath = path.join(localPath, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
         // Se for uma Sub-pasta (ex: "Busto Homem de Ferro"), cria a estrutura lá e acessa
         const newCloudFolder = `${cloudFolder}/${file}`;
         console.log(`📁 Entrando na pasta: ${file}...`);
         await uploadFolder(fullPath, newCloudFolder);
      } else {
        // É um arquivo (Imagem)!
        const ext = path.extname(file).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          console.log(`⏳ Fazendo upload de ${file}...`);
          try {
            await cloudinary.uploader.upload(fullPath, {
              folder: cloudFolder,
              use_filename: true,
              unique_filename: false,
              overwrite: false // Se a foto já existir lá, ele ignora
            });
            console.log(`✅ Sucesso: ${file}`);
          } catch (uploadErr) {
            console.error(`❌ Erro em ${file}: ${uploadErr.message}`);
          }
        }
      }
    }
  } catch (err) {
    console.error("Erro fatal ao ler o computador:", err.message);
  }
}

async function startUpload() {
  if (PASTA_NO_COMPUTADOR === 'COLOQUE_O_CAMINHO_AQUI') {
     console.log('⚠️ AVISO: Abra o script envia_em_lote.js e coloque o caminho da sua pasta de fotos na variável "PASTA_NO_COMPUTADOR" antes de pular!');
     return;
  }

  console.log(`🚀 Iniciando Upload em Lote de: ${PASTA_NO_COMPUTADOR}`);
  await uploadFolder(PASTA_NO_COMPUTADOR, PASTA_RAIZ_CLOUDINARY);
  console.log('🎉 UPLOAD CONCLUÍDO!');
}

startUpload();
