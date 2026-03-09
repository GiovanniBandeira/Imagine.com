const { google } = require('googleapis');
const fs = require('fs');

async function testar() {
  const token = JSON.parse(fs.readFileSync('token.json'));
  const credentials = JSON.parse(fs.readFileSync('credentials.json'));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);
  
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  
  console.log('Listando filhos diretos de 1kDeJoqjFnsus3WOoWPTWgHHN8Ji9Wbcv...');
  const res = await drive.files.list({
      q: `'1kDeJoqjFnsus3WOoWPTWgHHN8Ji9Wbcv' in parents and trashed=false`,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields: 'files(id, name, mimeType)'
  });
  
  console.log(res.data.files);
}

testar();
