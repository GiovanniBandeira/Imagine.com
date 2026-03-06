const request = require('supertest');
const app = require('./server');

// Mock para googleapis
jest.mock('googleapis', () => {
  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => {
          return {
            setCredentials: jest.fn(),
            generateAuthUrl: jest.fn().mockReturnValue('http://mock-auth-url'),
            getToken: jest.fn().mockResolvedValue({ tokens: { access_token: 'mock-token' } })
          };
        }),
      },
      drive: jest.fn().mockReturnValue({
        files: {
          list: jest.fn().mockResolvedValue({
            data: {
              files: [
                { id: '1', name: 'Imagem teste 1', mimeType: 'image/jpeg' },
                { id: '2', name: 'Imagem teste 2', mimeType: 'image/png' }
              ]
            }
          }),
          get: jest.fn().mockResolvedValue({
            data: { mimeType: 'image/jpeg' } //Mocking meta
          })
        }
      })
    }
  };
});

// Mock para o fs tentar não quebrar tentando ler token.json real
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    readFileSync: jest.fn((path) => {
      if (path.includes('client_secret.json')) {
        return JSON.stringify({
          web: {
            client_id: 'mock_id',
            client_secret: 'mock_secret',
            redirect_uris: ['http://localhost:3000/oauth2callback']
          }
        });
      }
      if (path.includes('token.json')) {
        return JSON.stringify({ access_token: 'mock-token' });
      }
      return originalFs.readFileSync(path);
    }),
    writeFileSync: jest.fn()
  };
});

describe('Backend API Endpoints', () => {
  it('GET /api/showcase - deve retornar as imagens do showcase em formato JSON', async () => {
    const res = await request(app).get('/api/showcase');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('images');
    expect(res.body.images.length).toBeGreaterThan(0);
    expect(res.body.images[0]).toHaveProperty('name', 'Imagem teste 1');
  });

  it('GET /api/models - deve iniciar renderização do cache e retornar JSON', async () => {
    const res = await request(app).get('/api/models');
    expect(res.statusCode).toEqual(200);
    expect(res.headers).toHaveProperty('x-cache-status');
    expect(res.body).toHaveProperty('models');
  });
  
  it('GET /login - deve redirecionar para a URL de autorização do Google', async () => {
    const res = await request(app).get('/login');
    expect(res.statusCode).toEqual(302); // Redirecionamento
    expect(res.headers.location).toBe('http://mock-auth-url');
  });
});
