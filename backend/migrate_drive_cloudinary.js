const path = require('path');
const dotenv = require('dotenv');
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

console.log(`[INIT] Tentando ler variáveis do Cache local: ${envPath}`);
const { google } = require('googleapis');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// ==============================================
// 1. CONFIGURAÇÕES A PREENCHER
// ==============================================
const PASTA_RAIZ_DRIVE_ID = '1kDeJoqjFnsus3WOoWPTWgHHN8Ji9Wbcv'; 
const PASTA_RAIZ_CLOUDINARY = 'Modelos';

// ==============================================
// 2. CONEXÃO GOOGLE DRIVE
// ==============================================
const KEYFILEPATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

let drive;
try {
  const credentials = JSON.parse(fs.readFileSync(KEYFILEPATH));
  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  
  const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oAuth2Client.setCredentials(tokenData);
  drive = google.drive({ version: 'v3', auth: oAuth2Client });
  console.log("✅ Google Drive Autenticado com Sucesso!");
} catch (e) {
  console.error("❌ ERRO GOOGLE DEV: Não achei os arquivos client_secret.json ou token.json na pasta backend!");
  process.exit(1);
}

// ==============================================
// 3. TRANSFERÊNCIA DIRETA DRIVE -> CLOUDINARY
// ==============================================

async function migrateFolder(driveFolderId, cloudFolder, depth = 0) {
  try {
    const q = `'${driveFolderId}' in parents and trashed = false`;
    const res = await drive.files.list({
      q: q,
      fields: 'files(id, name, mimeType, shortcutDetails)',
      pageSize: 1000
    });

    const arquivos = res.data.files || [];
    if (depth === 0) console.log(`🔍 Encontrados ${arquivos.length} itens na raiz do Drive...`);

    for (const file of arquivos) {
      // Regra Antiga de Ignorar pastas de Admins
      const lowerName = file.name.toLowerCase();
      if (lowerName.includes('atualiza') || lowerName.includes('pedidos') || lowerName.includes('finalizad')) {
         continue;
      }

      // TRATAMENTO DE PASTAS
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const newCloudFolder = `${cloudFolder}/${file.name}`;
        console.log(`📁 Acessando Álbum: ${file.name}...`);
        await migrateFolder(file.id, newCloudFolder, depth + 1);
      } 
      // TRATAMENTO DE ATALHOS (SHORTCUTS) - A raiz do cliente é cheia deles!
      else if (file.mimeType === 'application/vnd.google-apps.shortcut') {
        if (file.shortcutDetails && file.shortcutDetails.targetMimeType === 'application/vnd.google-apps.folder') {
           const newCloudFolder = `${cloudFolder}/${file.name}`;
           console.log(`🔗 Seguindo Atalho para Álbum: ${file.name}...`);
           await migrateFolder(file.shortcutDetails.targetId, newCloudFolder, depth + 1);
        }
      }
      // TRATAMENTO DE IMAGENS
      else if (file.mimeType.includes('image/')) {
        // É FOTO! Vamos transferir direto da memoria do Google para o Cloudinary
        console.log(`⏳ Transferindo foto: ${file.name}...`);
        
        try {
          // Coleta os bytes reais da foto no Google Drive em Stream
          const imgResponse = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' });
          
          // E dispara os bytes direto pelo cano para o Cloudinary via Buffer Upload
          await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream({
              folder: cloudFolder,
              use_filename: true,
              unique_filename: false,
              overwrite: false 
            }, (err, result) => {
              if (err) return reject(err);
              console.log(`✅ Sucesso Cloudinary: ${result.secure_url}`);
              resolve(result);
            });

            // Encaixa o Cano do Drive no Cano do Cloudinary
            imgResponse.data.pipe(uploadStream);
          });
          
        } catch(uploadErr) {
           console.error(`❌ Falhou ao transferir ${file.name}: ${uploadErr.message}`);
        }
      }
    }
  } catch(e) {
    console.warn(`[AVISO] Erro na pasta raiz/lote:`, e.message);
  }
}

async function startMigration() {
  if (!process.env.CLOUDINARY_URL) {
    console.error("❌ ERRO: Faltou colar o CLOUDINARY_URL no seu arquivo .env!");
    return;
  }
  
  console.log(`🚀 Iniciando Transferência Massiva de Nuvem para Nuvem (Drive -> Cloudinary)...`);
  await migrateFolder(PASTA_RAIZ_DRIVE_ID, PASTA_RAIZ_CLOUDINARY);
  console.log('🎉 MIGRAÇÃO 100% CONCLUÍDA!');
}

startMigration();
