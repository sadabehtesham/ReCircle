jest.mock('../src/services/images', () => ({
  uploadAll: jest.fn(async (files = []) => files.map(() => ({ url: `http://img/${++mockN}.jpg`, publicId: `pid-${mockN}` }))),
  removeAll: jest.fn(async () => {}),
}));
let mockN = 0;

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Item = require('../src/models/Item');
const images = require('../src/services/images');
const db = require('./db');

beforeAll(async () => {
  await db.connect();
  await User.init();
});
afterEach(db.clear);
afterAll(db.close);

const signup = async (n) => {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/register').send({
    name: `User${n}`,
    email: `u${n}@college.edu`,
    password: 'password123',
    college: 'College',
  });
  expect(response.status).toBe(201);
  return { agent, id: response.body.data.user._id };
};

const avatar = (agent, type = 'image/jpeg') =>
  agent.patch('/api/users/me').attach('image', Buffer.from('x'), { filename: 'a.jpg', contentType: type });

test('editing requires login', async () => {
  expect((await request(app).patch('/api/users/me').send({ name: 'Hacker' })).status).toBe(401);
});

test('updates name and college but ignores email, role and status', async () => {
  const user = await signup(1);
  const response = await user.agent.patch('/api/users/me').send({
    name: 'New Name',
    college: 'New College',
    email: 'x@y.com',
    role: 'admin',
    accountStatus: 'suspended',
  });
  expect(response.status).toBe(200);
  expect(response.body.data.user.name).toBe('New Name');
  expect(response.body.data.user.email).toBe('u1@college.edu');
  expect(response.body.data.user.role).toBe('student');
  expect(response.body.data.user.accountStatus).toBe('active');
});

test('rejects invalid name', async () => {
  const user = await signup(1);
  expect((await user.agent.patch('/api/users/me').send({ name: 'x' })).status).toBe(400);
});

test('avatar upload, replacement deletes the old one, internal id hidden', async () => {
  const user = await signup(1);
  const first = await avatar(user.agent);
  expect(first.status).toBe(200);
  expect(first.body.data.user.profileImage).toMatch(/^http:\/\/img\//);
  expect(first.body.data.user.profileImageId).toBeUndefined();
  const { profileImageId } = await User.findById(user.id);

  await avatar(user.agent);
  expect(images.removeAll).toHaveBeenCalledWith([profileImageId]);
  expect((await avatar(user.agent, 'text/plain')).status).toBe(400);
});

test('public profile hides private data and lists only available items', async () => {
  const user = await signup(1);
  const item = {
    title: 'Calculator',
    description: 'Works well enough',
    category: 'calculators',
    condition: 'good',
    lendingType: 'borrow',
    pickupLocation: 'Library',
    images: [{ url: 'http://i/1.jpg', publicId: 'p1' }],
    ownerId: user.id,
  };
  await Item.create(item);
  await Item.create({ ...item, title: 'Hidden', listingStatus: 'unavailable' });

  const response = await request(app).get(`/api/users/${user.id}`);
  expect(response.status).toBe(200);
  expect(response.body.data.user.name).toBe('User1');
  expect(response.body.data.user.email).toBeUndefined();
  expect(response.body.data.user.profileImageId).toBeUndefined();
  expect(response.body.data.items).toHaveLength(1);
});

test('suspended or unknown users return 404, bad ids 400', async () => {
  const user = await signup(1);
  await User.updateOne({ _id: user.id }, { accountStatus: 'suspended' });
  expect((await request(app).get(`/api/users/${user.id}`)).status).toBe(404);
  expect((await request(app).get('/api/users/000000000000000000000000')).status).toBe(404);
  expect((await request(app).get('/api/users/nope')).status).toBe(400);
});
