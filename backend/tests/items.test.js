const request = require('supertest');
const app = require('../src/app');
const Item = require('../src/models/Item');
const User = require('../src/models/User');
const images = require('../src/services/images');
const db = require('./db');

const valid = {
  title: 'Scientific calculator',
  description: 'A calculator available for student use.',
  category: 'calculators',
  condition: 'good',
  lendingType: 'borrow',
  pickupLocation: 'Library',
};
const photo = { url: 'https://images.example/item.png', publicId: 'reuseloop/items/item' };

beforeAll(async () => {
  await db.connect();
  await Promise.all([Item.init(), User.init()]);
});
afterEach(async () => {
  jest.restoreAllMocks();
  await db.clear();
});
afterAll(db.close);

const register = async (agent, email) => {
  const response = await agent.post('/api/auth/register').send({
    name: 'Item Owner',
    email,
    password: 'password123',
    college: 'Test College',
  });
  expect(response.status).toBe(201);
  return response.body.data.user._id;
};

const createListing = async (agent, overrides = {}) => {
  const uploadAll = jest.spyOn(images, 'uploadAll').mockResolvedValue([photo]);
  const response = await agent
    .post('/api/items')
    .field({ ...valid, ...overrides })
    .attach('images', Buffer.from('image data'), { filename: 'item.png', contentType: 'image/png' });
  if (response.status === 201) {
    expect(uploadAll).toHaveBeenCalledWith(
      [expect.objectContaining({ originalname: 'item.png' })],
      'items'
    );
  }
  return response;
};

test('list validates and normalizes query parameters without assigning to req.query', async () => {
  const res = await request(app).get('/api/items?page=2&limit=5&sort=oldest&search=%20calculator%20');
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({ items: [], page: 2, limit: 5, total: 0, pages: 0 });

  const invalid = await request(app).get('/api/items?category=not-a-category');
  expect(invalid.status).toBe(400);
  expect(invalid.body.message).toContain('category');

  const empty = await request(app).get('/api/items?category=');
  expect(empty.status).toBe(400);
  expect(empty.body.message).toContain('category');
});

test('create requires a user and at least one image', async () => {
  const unauthorized = await request(app).post('/api/items').send(valid);
  expect(unauthorized.status).toBe(401);

  const agent = request.agent(app);
  await register(agent, 'no-photo@college.edu');
  const missingPhoto = await agent.post('/api/items').send(valid);
  expect(missingPhoto.status).toBe(400);
  expect(missingPhoto.body.message).toBe('At least one photo is required');
});

test('only student accounts can create listings', async () => {
  const admin = request.agent(app);
  await register(admin, 'admin-item@college.edu');
  await User.updateOne({ email: 'admin-item@college.edu' }, { role: 'admin' });

  const response = await admin
    .post('/api/items')
    .field(valid)
    .attach('images', Buffer.from('image data'), { filename: 'item.png', contentType: 'image/png' });

  expect(response.status).toBe(403);
  expect(response.body.message).toBe('Forbidden');
});

test('create stores images and list responses only expose safe owner fields', async () => {
  const agent = request.agent(app);
  const ownerId = await register(agent, 'owner@college.edu');
  const created = await createListing(agent, {
    ownerId: '000000000000000000000000',
    listingStatus: 'removed',
  });
  expect(created.status).toBe(201);
  expect(created.body.data.item.ownerId).toBe(ownerId);
  expect(created.body.data.item.images).toEqual([photo]);
  expect(created.body.data.item.listingStatus).toBe('available');

  const listed = await request(app).get('/api/items?category=calculators');
  expect(listed.status).toBe(200);
  expect(listed.body.data.items).toHaveLength(1);
  expect(listed.body.data.items[0].ownerId).toMatchObject({ name: 'Item Owner', college: 'Test College' });
  expect(listed.body.data.items[0].ownerId.email).toBeUndefined();
  expect(listed.body.data.items[0].ownerId.passwordHash).toBeUndefined();

  const detail = await request(app).get(`/api/items/${created.body.data.item._id}`);
  expect(detail.status).toBe(200);
  expect(detail.body.data.item.ownerId.email).toBeUndefined();
});

test('price is required for sell items and forbidden otherwise', async () => {
  const agent = request.agent(app);
  await register(agent, 'price-validation@college.edu');

  expect((await createListing(agent, { lendingType: 'sell' })).status).toBe(400);
  expect((await createListing(agent, { price: '100' })).status).toBe(400);

  const sale = await createListing(agent, { lendingType: 'sell', price: '500' });
  expect(sale.status).toBe(201);
  expect(sale.body.data.item.price).toBe(500);
  expect((await createListing(agent, { lendingType: 'giveaway' })).status).toBe(201);
});

test('price and lending type cannot be changed on a non-sell item', async () => {
  const agent = request.agent(app);
  await register(agent, 'price-update@college.edu');
  const created = await createListing(agent);
  const id = created.body.data.item._id;

  expect((await agent.patch(`/api/items/${id}`).send({ price: 100 })).status).toBe(400);
  const response = await agent.patch(`/api/items/${id}`).send({ lendingType: 'sell' });
  expect(response.status).toBe(200);
  expect(response.body.data.item.lendingType).toBe('borrow');
});

test('list filters, searches, safely handles regex characters, and paginates', async () => {
  const agent = request.agent(app);
  await register(agent, 'listing-filters@college.edu');
  await createListing(agent, { title: 'Casio Calculator' });
  await createListing(agent, {
    title: 'Chemistry Textbook',
    description: 'A useful reference for chemistry students.',
    category: 'textbooks',
  });
  await createListing(agent, {
    title: 'Cricket Bat',
    description: 'Equipment for outdoor cricket games.',
    category: 'sports',
  });

  const get = (query) => request(app).get('/api/items').query(query);
  expect((await get({ category: 'sports' })).body.data.items).toHaveLength(1);
  expect((await get({ search: 'calc' })).body.data.items[0].title).toBe('Casio Calculator');
  expect((await get({ search: '(' })).status).toBe(200);

  const page = (await get({ limit: 2, page: 2 })).body.data;
  expect(page).toMatchObject({ total: 3, pages: 2, page: 2, limit: 2 });
  expect(page.items).toHaveLength(1);
});

test('unavailable listings are hidden from the marketplace but remain viewable', async () => {
  const agent = request.agent(app);
  await register(agent, 'unavailable-item@college.edu');
  const created = await createListing(agent);
  const id = created.body.data.item._id;

  const updated = await agent.patch(`/api/items/${id}`).send({ listingStatus: 'unavailable' });
  expect(updated.status).toBe(200);
  expect((await request(app).get('/api/items')).body.data.items).toHaveLength(0);
  expect((await request(app).get(`/api/items/${id}`)).status).toBe(200);
});

test('reserved or closed listings cannot be edited or removed', async () => {
  const agent = request.agent(app);
  await register(agent, 'transaction-item@college.edu');

  for (const status of ['reserved', 'closed']) {
    const created = await createListing(agent);
    const id = created.body.data.item._id;
    await Item.updateOne({ _id: id }, { listingStatus: status });

    const update = await agent.patch(`/api/items/${id}`).send({ title: 'New title' });
    expect(update.status).toBe(409);
    expect(update.body.message).toBe('This listing is in a transaction and cannot be changed');

    const remove = await agent.delete(`/api/items/${id}`);
    expect(remove.status).toBe(409);
    expect((await Item.findById(id)).listingStatus).toBe(status);
  }
});

test('rejects non-image uploads and reports invalid item IDs as 400', async () => {
  const agent = request.agent(app);
  await register(agent, 'upload-check@college.edu');

  const invalidFile = await agent
    .post('/api/items')
    .field(valid)
    .attach('images', Buffer.from('not an image'), { filename: 'note.txt', contentType: 'text/plain' });
  expect(invalidFile.status).toBe(400);
  expect(invalidFile.body.message).toBe('Only JPEG, PNG or WebP images are allowed');

  const invalidId = await request(app).get('/api/items/not-an-object-id');
  expect(invalidId.status).toBe(400);
  expect(invalidId.body.message).toBe('Invalid ID');
});

test('only the owner can update or remove a listing; delete is a soft removal', async () => {
  const owner = request.agent(app);
  await register(owner, 'first-owner@college.edu');
  const created = await createListing(owner);
  const id = created.body.data.item._id;

  const otherUser = request.agent(app);
  await register(otherUser, 'second-owner@college.edu');
  const forbidden = await otherUser.patch(`/api/items/${id}`).send({ title: 'Changed title' });
  expect(forbidden.status).toBe(403);
  expect((await otherUser.delete(`/api/items/${id}`)).status).toBe(403);

  const emptyImages = await owner.patch(`/api/items/${id}`).field('removeImages', photo.publicId);
  expect(emptyImages.status).toBe(400);
  expect(emptyImages.body.message).toBe('At least one photo is required');

  const updatedPhoto = { url: 'https://images.example/replacement.png', publicId: 'reuseloop/items/replacement' };
  jest.spyOn(images, 'uploadAll').mockResolvedValue([updatedPhoto]);
  jest.spyOn(images, 'removeAll').mockResolvedValue([]);
  const updated = await owner
    .patch(`/api/items/${id}`)
    .field('removeImages', photo.publicId)
    .attach('images', Buffer.from('replacement image'), { filename: 'replacement.png', contentType: 'image/png' });
  expect(updated.status).toBe(200);
  expect(updated.body.data.item.images).toEqual([updatedPhoto]);
  expect(images.removeAll).toHaveBeenCalledWith([photo.publicId]);

  const removed = await owner.delete(`/api/items/${id}`);
  expect(removed.status).toBe(200);
  expect(removed.body.data).toBeNull();
  expect((await request(app).get(`/api/items/${id}`)).status).toBe(404);
  expect(await Item.countDocuments({ listingStatus: 'removed' })).toBe(1);
});
