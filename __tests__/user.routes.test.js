const express = require('express');
const request = require('supertest');

// --- Mocks pour les méthodes du modèle Mongoose ---
const mockSave = jest.fn(async function save() { return this; });
const mockFind = jest.fn(async () => [{ _id: '1', name: 'john' }]);
const mockFindById = jest.fn(async (id) => (
  id === '1' ? { 
    _id: '1', 
    name: 'john', 
    cloudinary_id: 'pid123', 
    deleteOne: jest.fn(),
    save: mockSave // Permet de mocker la méthode save sur les instances trouvées
  } : null
));
const mockFindByIdAndUpdate = jest.fn(async (_id, data) => ({ _id, ...data }));


// 🛠️ CORRECTION CRITIQUE : Mock Multer
// Le mock doit retourner un objet avec une méthode .single() qui, à son tour, 
// retourne la fonction middleware réelle.
jest.mock('../utils/multer', () => ({
  // Simule l'appel de upload.single('image')
  single: jest.fn(() => (req, _res, next) => {
    // Injecte un fichier factice
    req.file = { path: '/tmp/fake-file.png' };
    // Express ne parse pas multipart/form-data sans Multer.
    // On peuple donc req.body pour le test.
    req.body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    if (!req.body.name) req.body.name = 'alice';
    next();
  }),
}));


// Mock cloudinary uploader
jest.mock('../utils/cloudinary', () => ({
  uploader: {
    upload: jest.fn(async () => ({ secure_url: 'https://cloud/f.png', public_id: 'pid123' })),
    destroy: jest.fn(async () => ({})),
  },
}));

// Mock User model
jest.mock('../model/user', () => {
  return function User(doc) {
    Object.assign(this, doc);
    this.save = mockSave;
  };
});

// Patch static methods on the mocked constructor
const User = require('../model/user');
User.find = mockFind;
User.findById = mockFindById;
User.findByIdAndUpdate = mockFindByIdAndUpdate;

const userRouter = require('../routes/user');

function createApp() {
  const app = express();
  app.use(express.json());
  // Remarque : Si vous avez un bodyParser ou un middleware de compression qui interfère,
  // il pourrait être nécessaire de le mocker aussi.
  app.use('/user', userRouter);
  return app;
}

describe('User routes', () => {
  // Réinitialiser les mocks après chaque test pour un environnement propre
  afterEach(() => {
    mockSave.mockClear();
    mockFind.mockClear();
    mockFindById.mockClear();
    mockFindByIdAndUpdate.mockClear();
  });

  test('GET /user returns list', async () => {
    const app = createApp();
    const res = await request(app).get('/user');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /user creates a user', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/user')
      .field('name', 'alice')
      // Note: L'appel .attach est nécessaire même si Multer est mocké, 
      // car il simule le format de requête multipart/form-data.
      .attach('image', Buffer.from('fake'), 'avatar.png'); 
      
    expect(res.status).toBe(200);
    expect(mockSave).toHaveBeenCalled();
    expect(res.body).toHaveProperty('name', 'alice');
    // Vérifier que Cloudinary a été appelé après le mock de Multer
    expect(require('../utils/cloudinary').uploader.upload).toHaveBeenCalled();
  });

  test('GET /user/:id not found', async () => {
    const app = createApp();
    const res = await request(app).get('/user/unknown');
    expect(res.status).toBe(404);
  });

  test('GET /user/:id found', async () => {
    const app = createApp();
    const res = await request(app).get('/user/1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('_id', '1');
  });
});