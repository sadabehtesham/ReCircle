const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const db = require('./db');

beforeAll(async () => {
  await db.connect();
  await User.init(); // make sure the unique email index exists
});
afterEach(db.clear);
afterAll(db.close);

const valid = { name: 'Asha', email: 'asha@college.edu', password: 'password123', college: 'IIT Delhi' };
const register = (body = valid) => request(app).post('/api/auth/register').send(body);

test('register sets httpOnly cookie and hides the hash', async () => {
  const res = await register();
  expect(res.status).toBe(201);
  expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
  expect(res.body.data.user.passwordHash).toBeUndefined();
});

test('register cannot set role', async () => {
  const res = await register({ ...valid, role: 'admin' });
  expect(res.body.data.user.role).toBe('student');
});

test('duplicate email returns 409', async () => {
  await register();
  expect((await register()).status).toBe(409);
});

test('invalid input returns 400', async () => {
  expect((await register({ ...valid, password: 'short' })).status).toBe(400);
  expect((await register({ ...valid, email: 'nope' })).status).toBe(400);
});

test('login works with correct password only', async () => {
  await register();
  const login = (password) =>
    request(app).post('/api/auth/login').send({ email: valid.email, password });
  expect((await login('password123')).status).toBe(200);
  expect((await login('wrongpass1')).status).toBe(401);
});

test('/me needs a cookie, then returns the user', async () => {
  expect((await request(app).get('/api/auth/me')).status).toBe(401);
  const agent = request.agent(app); // keeps cookies between requests
  await agent.post('/api/auth/register').send(valid);
  const res = await agent.get('/api/auth/me');
  expect(res.status).toBe(200);
  expect(res.body.data.user.email).toBe(valid.email);
});

test('suspended user is locked out immediately', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send(valid);
  await User.updateOne({ email: valid.email }, { accountStatus: 'suspended' });
  expect((await agent.get('/api/auth/me')).status).toBe(401);
});
