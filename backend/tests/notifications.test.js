const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const Notification = require('../src/models/Notification');
const Transaction = require('../src/models/Transaction');
const db = require('./db');
const { signup, dates, day, makeItem, ask } = require('./helpers');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

const get = async (user, query = {}) => (await user.agent.get('/api/notifications').query(query)).body.data;
const types = async (user) => (await get(user)).notifications.map((notification) => notification.type).sort();
const step = (verb, method = 'patch') => (user, id) => user.agent[method](`/api/requests/${id}/${verb}`).send({});
const approve = step('approve');
const reject = step('reject');
const cancel = step('cancel');
const handover = step('handover', 'post');
const handback = step('return', 'post');

const loan = (owner, borrower, itemId, dueDay, extra = {}) =>
  Transaction.create({
    requestId: new mongoose.Types.ObjectId(),
    itemId,
    ownerId: owner.id,
    borrowerId: borrower.id,
    type: 'borrow',
    pickupAt: new Date(),
    currentStatus: 'active',
    dueAt: new Date(day(dueDay)),
    ...extra,
  });

test('every endpoint requires login', async () => {
  const routes = [
    ['get', '/api/notifications'],
    ['get', '/api/notifications/unread-count'],
    ['patch', '/api/notifications/read-all'],
    ['patch', '/api/notifications/000000000000000000000000/read'],
  ];
  for (const [method, url] of routes) expect((await request(app)[method](url)).status).toBe(401);
});

test('each workflow step notifies the right person', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const item = await makeItem(owner.id);
  const id = (await ask(borrower, item._id, dates())).body.data.request._id;

  const first = (await get(owner)).notifications[0];
  expect(first).toMatchObject({ type: 'request_new', link: '/requests/incoming', relatedEntityId: id });
  expect(first.message).toContain('User2');
  expect(first.message).toContain('Calculator');
  expect(first.readAt).toBeUndefined();
  expect(first.key).toBeUndefined();
  expect(await types(borrower)).toEqual([]);

  await approve(owner, id);
  await handover(owner, id);
  await handback(owner, id);
  expect(await types(borrower)).toEqual(['handover', 'request_approved', 'return']);
  expect(await types(owner)).toEqual(['request_new']);
});

test('rejections, cancellations and sale reservations notify the other side', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const otherBorrower = await signup(3);
  const item = await makeItem(owner.id);

  const rejectedId = (await ask(borrower, item._id, dates())).body.data.request._id;
  await reject(owner, rejectedId);
  expect(await types(borrower)).toEqual(['request_rejected']);

  const cancelledId = (await ask(otherBorrower, item._id, dates())).body.data.request._id;
  await cancel(otherBorrower, cancelledId);
  expect(await types(owner)).toEqual(['request_cancelled', 'request_new', 'request_new']);
  expect(await types(otherBorrower)).toEqual([]);

  const saleItem = await makeItem(owner.id, { lendingType: 'sell', price: 100 });
  const saleId = (await ask(borrower, saleItem._id)).body.data.request._id;
  expect((await get(owner)).notifications.some((notification) => /is buying/.test(notification.message))).toBe(true);
  await cancel(owner, saleId);
  expect(await types(borrower)).toEqual(['request_cancelled', 'request_rejected']);
});

test('a failed action sends nothing', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const otherBorrower = await signup(3);
  const item = await makeItem(owner.id);
  const firstId = (await ask(borrower, item._id, dates(1, 3))).body.data.request._id;
  const overlappingId = (await ask(otherBorrower, item._id, dates(2, 4))).body.data.request._id;

  expect((await approve(owner, firstId)).status).toBe(200);
  expect((await approve(owner, overlappingId)).status).toBe(409);
  expect(await types(otherBorrower)).toEqual([]);
  expect((await handover(borrower, firstId)).status).toBe(403);
  expect(await types(borrower)).toEqual(['request_approved']);
});

test('read state is private and idempotent; filters and counts agree', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  for (let index = 0; index < 2; index++) {
    await ask(borrower, (await makeItem(owner.id))._id, dates());
  }

  const { notifications, unreadCount } = await get(owner);
  expect(unreadCount).toBe(2);
  const id = notifications[0]._id;
  const read = (user) => user.agent.patch(`/api/notifications/${id}/read`);

  expect((await read(borrower)).status).toBe(404);
  const first = (await read(owner)).body.data.notification;
  expect(first.readAt).toBeTruthy();
  expect((await read(owner)).body.data.notification.readAt).toBe(first.readAt);

  expect((await get(owner, { unread: 'true' })).total).toBe(1);
  const count = async () => (await owner.agent.get('/api/notifications/unread-count')).body.data.count;
  expect(await count()).toBe(1);
  expect((await owner.agent.patch('/api/notifications/read-all')).body.data.updated).toBe(1);
  expect(await count()).toBe(0);
  expect((await owner.agent.patch('/api/notifications/nope/read')).status).toBe(400);
  expect((await owner.agent.get('/api/notifications').query({ unread: 'maybe' })).status).toBe(400);
});

test('due-soon and overdue reminders appear once, only for the right people', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const stranger = await signup(3);
  const item = await makeItem(owner.id);
  await loan(owner, borrower, item._id, 2);
  await loan(owner, borrower, item._id, 0);
  await loan(owner, borrower, item._id, 3);
  await loan(owner, borrower, item._id, 0, { currentStatus: 'completed' });

  await Promise.all([
    get(borrower),
    get(borrower),
    get(owner),
    get(owner),
    owner.agent.get('/api/notifications/unread-count'),
  ]);

  expect(await types(borrower)).toEqual(['due_soon', 'overdue']);
  expect(await types(owner)).toEqual(['overdue']);
  expect(await types(stranger)).toEqual([]);
  expect((await get(owner)).notifications[0].message).toContain('User2');
  expect((await get(borrower)).notifications.find((notification) => notification.type === 'overdue').message).toContain('Calculator');
  expect(await Notification.countDocuments()).toBe(3);
});
