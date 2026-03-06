const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Pasta raiz que o usuário configurou
const TARGET_FOLDER_ID = '1gvrWAHuWKCDGGKQ6wkKy1nUO9fK4ZUPO'; // ID da pasta ATUALIZAÇÕES 2024

async function testDrive() {
  try {
    const credsPath = path.join(__dirname, 'client_secret.json');
    const tokenPath = path.join(__dirname, 'token.json');
    
    const credentials = JSON.parse(fs.readFileSync(credsPath));
    const token = JSON.parse(fs.readFileSync(tokenPath));
    
    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(token);
    
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    
    console.log(`[TESTE] Buscando conteúdo DENTRO de ATUALIZAÇÕES 2024: ${TARGET_FOLDER_ID}`);
    const q = `'${TARGET_FOLDER_ID}' in parents and trashed = false`;
    
    console.log(`[TESTE] Query exata: ${q}`);
    
    const res = await drive.files.list({
      q: q,
      fields: 'files(id, name, mimeType, shortcutDetails)',
      pageSize: 50
    });
    
    console.log(`[TESTE] Retorno cru do Google:`);
    console.log(JSON.stringify(res.data.files.map(f => ({ name: f.name, type: f.mimeType })), null, 2));
    

  } catch (err) {
    console.error("❌ ERRO DA API OAUTH2:", err.message);
  }
}

testDrive();
