require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { google } = require('googleapis');
const nsfw = require('nsfwjs');
const tf = require('@tensorflow/tfjs');
const { createCanvas, loadImage } = require('canvas');
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
const PASTA_ID_RAIZ = '1kDeJoqjFnsus3WOoWPTWgHHN8Ji9Wbcv'; // ID Extraído do seu Link
const AMOSTRAS_MAX_POR_ALBUM = 8; // Máximo de 8 ângulos/fotos por modelo 3D
const MAX_MODELOS_JSON = 500; // Limite máximo total do Json imposto pelo comercial
const LIMIAR_NSFW = 0.6; 
const IGNORAR_TERMOS = [
  'a a z', 'atualização', 'atualizacao', 'comunicado', 'aviso', 'recesso', 'informativo',
  '12 dezembro', '11 novembro', '10 outubro', '09 setembro', '08 agosto',
  '07 julho', '06 junho', '05 maio', '04 abril', '03 março', '02 fevereiro', '01 janeiro'
];
const TRENDING_KEYWORDS = [
  'naruto', 'one piece', 'marvel', 'cachorro', 'deadpool', 'yugioh', 'mickey', 'donald', 'pernalonga',
  'anime', 'dragon ball', 'goku', 'batman', 'spider', 'x-men', 'wolverine', 'pokemon', 'zelda', 'mario'
];
const OUTPUT_FILE = path.join(__dirname, 'src/data/galeria.json');

// Autorização da API do Drive via Conta de Usuário (Desktop App Flow)
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

async function authorize() {
  let credentials;
  try {
    const content = fs.readFileSync(CREDENTIALS_PATH);
    credentials = JSON.parse(content);
  } catch (err) {
    console.error('❌ ERRO FATAL: Arquivo credentials.json (App Desktop) não encontrado na pasta scripts!');
    console.log('💡 DICA: Siga o Passo a Passo no arquivo INSTRUCOES_OAUTH2.md para gerar e baixar este arquivo.');
    process.exit(1);
  }

  // Desestruturando as chaves padrão que vêm do Google Cloud Console
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Se já tivermos o Token salvo da última vez que o usuário autorizou, lemos ele.
  try {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  } catch (err) {
    return getAccessToken(oAuth2Client);
  }
}

/**
 * Pega um Token Exclusivo caso seja a Primeira Execução
 */
function getAccessToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    console.log('\n🔒 AÇÃO NECESSÁRIA! O Google precisa da sua autorização.');
    console.log('1. CLIQUE NESTE LINK PARA AUTORIZAR A LEITURA DO SEU DRIVE:');
    console.log('👉', authUrl);
    console.log('\n2. Após aceitar as permissões, o Google te dará um CÓDIGO BRANCO ("Code").');
    console.log('3. COLE ESTE CÓDIGO AQUI NO TERMINAL:');

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question('>> Cole o código aqui: ', (code) => {
      readline.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject(new Error('Erro pegando o Token: ' + err));
        oAuth2Client.setCredentials(token);
        // Salva o Token para nunca mais te pedir na vida!
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        console.log('✅ Autorização Concluída! Token guardado com sucesso.');
        resolve(oAuth2Client);
      });
    });
  });
}

/**
 * Faz o Download de um Arquivo do Drive direto para a Memória RAM do Script (Buffer)
 */
async function baixarArquivoMemoria(drive, fileId) {
  try {
    const res = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
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

/**
 * Verifica se um nome contém termos de ruído (ex: Atualizações, Comunidado, A a Z)
 */
function isNomeValido(nome) {
    const limpo = nome.toLowerCase();
    for (const lixo of IGNORAR_TERMOS) {
        if (limpo.includes(lixo)) return false;
    }
    return true;
}

/**
 * Escaneador Recursivo V2 (Mergulho Profundo em Sub-Pastas)
 */
async function vasculharPastaRecursiva(drive, currentFolderId, pathTrilha, galeriaRef, modelIA) {
    // Escudo comercial: Limite Absoluto
    if (galeriaRef.length >= MAX_MODELOS_JSON) {
        return;
    }

    // 1. Pesquisa o que há DENTRO dessa pasta atuando nos atalhos virtuais
    const listaGeralRes = await drive.files.list({
        q: `'${currentFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, shortcutDetails)',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
    });
    
    const conteudo = listaGeralRes.data.files;
    if (!conteudo || conteudo.length === 0) return;

    // Divide em duas pilhas: O que é Subpasta e O que é Imagem/Arquivo
    const subGavetas = [];
    const imagens = [];

    for (const item of conteudo) {
        if (item.mimeType === 'application/vnd.google-apps.folder' || 
           (item.mimeType === 'application/vnd.google-apps.shortcut' && item.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder')) {
           subGavetas.push(item);
        } else if (item.mimeType.includes('image/')) {
           if (isNomeValido(item.name)) {
               imagens.push(item);
           }
        }
    }

    // Se essa Gaveta FINAL conter imagens de um Único Modelo 3D (ex: Busto Deadpool/frente.png, costas.png) - VIRA UM ÁLBUM!
    if (imagens.length > 0) {
        // Nomeia o modelo pela pasta mãe atual (pathTrilha possui o Pão de Migalhas "Marvel > Deadpool")
        const nomeDoModelo = pathTrilha[pathTrilha.length - 1]; // "Deadpool Busto"
        // A categoria verdadeira é a pasta mãe (diretamente acima do Álbum) e não a Raiz do Drive. Ex: "Biblioteca STL > Heróis > Marvel > Deadpool": A Categoria do Deadpool é "Marvel"
        const categoriaPai = pathTrilha.length > 1 ? pathTrilha[pathTrilha.length - 2] : 'Miscelânea';
        
        // Bloqueio extra: não salva álbuns de gavetas sistêmicas genéricas 
        if (isNomeValido(nomeDoModelo)) {
            console.log(`\n📸 Encontrado Álbum de Modelo: [${nomeDoModelo}] - Possui ${imagens.length} ângulos/fotos.`);
            
            const imagensSegurasWebP = [];
            const selecionados = imagens.sort(() => 0.5 - Math.random()).slice(0, AMOSTRAS_MAX_POR_ALBUM);

            // Filtro IA e Nuvem Múltiplo
            for (const foto of selecionados) {
                const buffer = await baixarArquivoMemoria(drive, foto.id);
                if (!buffer) continue;

                try {
                    const img = await loadImage(buffer);
                    const canvas = createCanvas(img.width, img.height);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const imgTensor = tf.browser.fromPixels(canvas);
                    const predictions = await modelIA.classify(imgTensor);
                    imgTensor.dispose();

                    const isSafe = (predictions.find(p => p.className === 'Neutral')?.probability || 0) + 
                                   (predictions.find(p => p.className === 'Drawing')?.probability || 0) > LIMIAR_NSFW;

                    if (isSafe) {
                        const pathServer = `catalogo_3d/${categoriaPai.replace(/\s+/g, '_')}/${nomeDoModelo.replace(/\s+/g, '_')}`;
                        console.log(`      ⭐ [SEGURO] 1 ângulo processado em IA... Mandando pro Cloudinary.`);
                        const uploaded = await uploadBufferToCloudinary(buffer, pathServer);
                        imagensSegurasWebP.push(uploaded.secure_url);
                    } else {
                        console.log(`      🚨 [BLOQUEADO] ${foto.name} barrou no Teste NSFW.`);
                    }
                } catch (err) {
                     console.log(`      ⚠️  A foto ${foto.name} corrompeu no Decoder. Ignorando.`);
                }
            }

            if (imagensSegurasWebP.length > 0) {
                 galeriaRef.push({
                     id: `algo_${Date.now()}_${Math.random()}`,
                     title: nomeDoModelo,                      // Deadpool Busto
                     category: categoriaPai,                   // Marvel
                     breadcrumb: pathTrilha.join(' > '),       // Biblioteca > Heróis > Marvel > Deadpool Busto
                     url: imagensSegurasWebP[0],               // Foto Principal de Capa
                     images: imagensSegurasWebP,               // Todas as poses para Carrossel
                     createdAt: new Date().toISOString()
                 });
                 // SALVAMENTO EM TEMPO REAL PARA O SITE ATUALIZAR AO VIVO!
                 fs.writeFileSync(OUTPUT_FILE, JSON.stringify(galeriaRef, null, 2));
                 console.log(`      📦✅ Álbum Rankeado [${galeriaRef.length}/${MAX_MODELOS_JSON}] com ${imagensSegurasWebP.length} visões!`);
                 
                 // Interrompe execução forçada se bateu o lote teto de 500 peças do comercial
                 if (galeriaRef.length >= MAX_MODELOS_JSON) {
                      console.log(`\n\n🎉💰 LIMITE COMERCIAL ATINGIDO! Foram extraídos exatamente ${MAX_MODELOS_JSON} Modelos Premium.`);
                      return;
                 }
            }
        }
    }

    // 2. Ordenação de Prioridade (O Comercial Lojista quer focar nos Lucrativos Antes)
    // Seleciona as Gavetas que correspondem ao Ouro primeiro, e deixa pra focar sub-pastas vazias depois
    subGavetas.sort((a, b) => {
        const nomeA = a.name.toLowerCase();
        const nomeB = b.name.toLowerCase();
        const rankA = TRENDING_KEYWORDS.some(kw => nomeA.includes(kw)) ? 1 : 0;
        const rankB = TRENDING_KEYWORDS.some(kw => nomeB.includes(kw)) ? 1 : 0;
        return rankB - rankA; // Garante que gavetas Premium como "Marvel" venham pro topo do array de varredura
    });

    // Mergulha mais fundo no Limbo (Recursão) pelas subgavetas dessa pasta
    for (const sub of subGavetas) {
        // Trava final se sub-thread ultrapassou o teto
        if (galeriaRef.length >= MAX_MODELOS_JSON) return;
        
        const idReal = sub.mimeType === 'application/vnd.google-apps.shortcut' ? sub.shortcutDetails.targetId : sub.id;
        const subNome = sub.name;
        // Não mergulhamos em gavetas com lixo explícito
        if (isNomeValido(subNome)) {
            const novaTrilha = [...pathTrilha, subNome];
            await vasculharPastaRecursiva(drive, idReal, novaTrilha, galeriaRef, modelIA);
        }
    }
}

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

  if (PASTA_ID_RAIZ === 'INSERIR_ID_DA_PASTA_MODELOS_AQUI') {
      console.error('❌ FATAL: Você não informou a tag na linha 22.');
      return;
  }

  const galeria = [];
  
  try {
      console.log('🔐 Conectando à Conta Oficial do Google Drive...');
      const oAuth2Client = await authorize();
      const drive = google.drive({ version: 'v3', auth: oAuth2Client });

      console.log('📂 Iniciando Mergulho Recursivo nas Profundezas do seu Drive...');

      // Começa da Gaveta Matriarca (A raiz do Link Compartilhado)
      await vasculharPastaRecursiva(drive, PASTA_ID_RAIZ, [], galeria, model);

      // Gravando o Compilado Final V2
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(galeria, null, 2));
      console.log(`\n🎉 Operação V2 em Nuvem Finalizada com ÊXITO TOTAL!`);
      console.log(`   └─ Foram agrupados e assegurados ${galeria.length} coleções de Álbuns 3D.`);
      console.log(`✅ O Frontend React usará os múltiplos ângulos das imagens agora.`);

  } catch(e) {
      console.error('❌ ERRO NA LEITURA PROFUNDA DO GOOGLE DRIVE: ', e);
  }
}

processarNuvem();
