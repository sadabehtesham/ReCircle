const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Item = require('../src/models/Item');
const BorrowRequest = require('../src/models/BorrowRequest');
const Transaction = require('../src/models/Transaction');
const db = require('./db');
const { signup, dates, day, makeItem, ask } = require('./helpers');

beforeAll(async () => {
  await db.connect();
  await User.init();
  await BorrowRequest.init();
  await Transaction.init();
});
afterEach(db.clear);
afterAll(db.close);

const get = async (user) => (await user.agent.get('/api/dashboard')).body.data;
const counts = (data) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.count]));

test('both endpoints require login', async () => {
  expect((await request(app).get('/api/dashboard')).status).toBe(401);
  expect((await request(app).get('/api/items/mine')).status).toBe(401);
});

test('counts come from real data and are private to each user', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const stranger = await signup(3);
  const item = await makeItem(owner.id);
  await makeItem(owner.id);
  await makeItem(owner.id, { listingStatus: 'removed' });
  await ask(borrower, item._id, dates());

  const base = { itemId: item._id, ownerId: owner.id, borrowerId: borrower.id, type: 'borrow', pickupAt: new Date() };
  const requestId = () => new mongoose.Types.ObjectId();
  await Transaction.create({ ...base, requestId: requestId(), currentStatus: 'active', dueAt: new Date(day(2)) });
  await Transaction.create({ ...base, requestId: requestId(), currentStatus: 'active', dueAt: new Date(day(0)) });
  await Transaction.create({
    ...base,
    requestId: requestId(),
    currentStatus: 'completed',
    dueAt: new Date(day(-5)),
    completedAt: new Date(),
  });

  const ownerDashboard = await get(owner);
  expect(counts(ownerDashboard)).toEqual({
    listings: 2,
    incoming: 1,
    requests: 0,
    borrowed: 0,
    lent: 2,
    completed: 1,
    overdue: 1,
  });
  expect(ownerDashboard.overdue.items[0].overdue).toBe(true);
  expect(counts(await get(borrower))).toEqual({
    listings: 0,
    incoming: 0,
    requests: 1,
    borrowed: 2,
    lent: 0,
    completed: 1,
    overdue: 1,
  });
  expect(counts(await get(stranger))).toEqual({
    listings: 0,
    incoming: 0,
    requests: 0,
    borrowed: 0,
    lent: 0,
    completed: 0,
    overdue: 0,
  });
});

test('previews are capped at 5 while counts stay exact, and hide private fields', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const items = [];
  for (let i = 0; i < 7; i++) items.push(await makeItem(owner.id));
  await ask(borrower, items[0]._id, dates());

  const dashboard = await get(owner);
  expect(dashboard.listings.count).toBe(7);
  expect(dashboard.listings.items).toHaveLength(5);
  expect(dashboard.incoming.items[0].borrowerId.name).toBe('User2');
  expect(dashboard.incoming.items[0].borrowerId.email).toBeUndefined();
  expect(dashboard.incoming.items[0].itemId.title).toBe('Calculator');
});

test('/items/mine lists my items in every status except removed, with paging', async () => {
  const owner = await signup(1);
  const other = await signup(2);
  for (const listingStatus of ['available', 'unavailable', 'reserved', 'closed', 'removed']) {
    await makeItem(owner.id, { listingStatus });
  }
  await makeItem(other.id);

  const all = (await owner.agent.get('/api/items/mine')).body.data;
  expect(all.total).toBe(4);
  expect(all.items.map((item) => item.listingStatus).sort()).toEqual(['available', 'closed', 'reserved', 'unavailable']);
  const page2 = (await owner.agent.get('/api/items/mine').query({ limit: 3, page: 2 })).body.data;
  expect(page2.items).toHaveLength(1);
  expect((await other.agent.get('/api/items/mine')).body.data.total).toBe(1);
  expect((await owner.agent.get('/api/items/mine').query({ limit: 100 })).status).toBe(400);
});
