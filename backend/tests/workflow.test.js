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
  await Item.init();
  await BorrowRequest.init();
  await Transaction.init();
});
afterEach(db.clear);
afterAll(db.close);

const post = (verb) => (u, id, body = {}) => u.agent.post(`/api/requests/${id}/${verb}`).send(body);
const handover = post('handover');
const handback = post('return');
const patch = (verb) => (u, id) => u.agent.patch(`/api/requests/${id}/${verb}`);
const approve = patch('approve');
const cancel = patch('cancel');

const approved = async (extra = {}) => {
  const o = await signup(1);
  const b = await signup(2);
  const item = await makeItem(o.id, extra);
  const dated = !extra.lendingType || extra.lendingType === 'borrow';
  const r = (await ask(b, item._id, dated ? dates(1, 3) : {})).body.data.request;
  if (r.status === 'pending') await approve(o, r._id);
  return { o, b, item, id: r._id };
};

test('borrow: handover then return, owner only, with a full audit trail', async () => {
  const { o, b, item, id } = await approved();
  const stranger = await signup(9);
  expect((await request(app).post(`/api/requests/${id}/handover`)).status).toBe(401);
  expect((await handover(b, id)).status).toBe(403);
  expect((await handover(stranger, id)).status).toBe(404);
  expect((await handover(o, id, { condition: 'bogus' })).status).toBe(400);

  const res = await handover(o, id, { condition: 'good' });
  expect(res.status).toBe(200);
  expect(res.body.data.request.status).toBe('active');
  const t = res.body.data.transaction;
  expect(t).toMatchObject({
    type: 'borrow',
    currentStatus: 'active',
    handedOverBy: o.id,
    conditionBefore: 'good',
    overdue: false,
  });
  expect(t.dueAt).toBe(`${day(4)}T00:00:00.000Z`);
  expect((await Item.findById(item._id)).listingStatus).toBe('available');
  expect((await handover(o, id)).status).toBe(409);

  expect((await handback(b, id)).status).toBe(403);
  const back = await handback(o, id, { condition: 'fair' });
  expect(back.status).toBe(200);
  expect(back.body.data.request.status).toBe('returned');
  expect(back.body.data.transaction).toMatchObject({
    currentStatus: 'completed',
    returnConfirmedBy: o.id,
    conditionAfter: 'fair',
  });
  expect(back.body.data.transaction.returnedAt).toBeTruthy();
  expect((await handback(o, id)).status).toBe(409);
});

test('handover needs an approved request; return needs an active loan', async () => {
  const o = await signup(1);
  const b = await signup(2);
  const item = await makeItem(o.id);
  const id = (await ask(b, item._id, dates())).body.data.request._id;
  expect((await handover(o, id)).status).toBe(409);
  await approve(o, id);
  expect((await handback(o, id)).status).toBe(409);
  await cancel(b, id);
  expect((await handover(o, id)).status).toBe(409);
});

test('sale: the owner must confirm payment, then the item is closed', async () => {
  const { o, item, id } = await approved({ lendingType: 'sell', price: 250 });
  expect((await handover(o, id)).status).toBe(400);
  expect((await handover(o, id, { paymentReceived: false })).status).toBe(400);
  const res = await handover(o, id, { paymentReceived: true });
  expect(res.status).toBe(200);
  expect(res.body.data.request.status).toBe('completed');
  expect(res.body.data.transaction).toMatchObject({ type: 'sell', currentStatus: 'completed', price: 250 });
  expect(res.body.data.transaction.paymentReceivedAt).toBeTruthy();
  expect((await Item.findById(item._id)).listingStatus).toBe('closed');
  expect((await handback(o, id)).status).toBe(409);
});

test('give away: no payment needed, completes at handover, item closed', async () => {
  const { o, item, id } = await approved({ lendingType: 'giveaway' });
  const res = await handover(o, id);
  expect(res.status).toBe(200);
  expect(res.body.data.transaction).toMatchObject({ type: 'giveaway', currentStatus: 'completed' });
  expect(res.body.data.transaction.price).toBeUndefined();
  expect((await Item.findById(item._id)).listingStatus).toBe('closed');
});

test('a handed-over item cannot be cancelled', async () => {
  const { o, b, id } = await approved();
  await handover(o, id);
  expect((await cancel(b, id)).status).toBe(409);
  expect((await cancel(o, id)).status).toBe(409);
});

test('concurrent handovers: exactly one succeeds and one transaction exists', async () => {
  const { o, id } = await approved();
  const res = await Promise.all([handover(o, id), handover(o, id)]);
  expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await Transaction.countDocuments({ requestId: id })).toBe(1);
});

test('handover racing a cancel: exactly one wins and the data stays consistent', async () => {
  const { o, b, id } = await approved();
  const res = await Promise.all([handover(o, id), cancel(b, id)]);
  expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
  const { status } = await BorrowRequest.findById(id);
  expect(await Transaction.countDocuments({ requestId: id })).toBe(status === 'active' ? 1 : 0);
});

test('a booking whose end date has passed cannot be handed over', async () => {
  const o = await signup(1);
  const b = await signup(2);
  const item = await makeItem(o.id);
  const r = await BorrowRequest.create({
    itemId: item._id,
    ownerId: o.id,
    borrowerId: b.id,
    type: 'borrow',
    startDate: new Date(day(-3)),
    endDate: new Date(day(-1)),
    status: 'approved',
  });
  expect((await handover(o, r._id)).status).toBe(409);
});

test('transaction lists are private; overdue comes from the due date', async () => {
  const o = await signup(1);
  const b = await signup(2);
  const c = await signup(3);
  const item = await makeItem(o.id);
  const base = { itemId: item._id, ownerId: o.id, borrowerId: b.id, type: 'borrow', pickupAt: new Date() };
  const id = () => new mongoose.Types.ObjectId();
  await Transaction.create({ ...base, requestId: id(), currentStatus: 'active', dueAt: new Date(day(0)) });
  await Transaction.create({ ...base, requestId: id(), currentStatus: 'active', dueAt: new Date(day(1)) });
  await Transaction.create({ ...base, requestId: id(), currentStatus: 'completed', dueAt: new Date(day(-5)), completedAt: new Date() });
  const get = (u, q) => u.agent.get('/api/transactions').query(q);

  const mine = (await get(b, {})).body.data;
  expect(mine.transactions.map((t) => t.overdue).sort()).toEqual([false, true]);
  expect(mine.transactions[0].itemId.title).toBe('Calculator');
  expect(mine.transactions[0].borrowerId.email).toBeUndefined();
  expect((await get(b, { status: 'completed' })).body.data.transactions).toHaveLength(1);
  expect((await get(o, { role: 'owner' })).body.data.transactions).toHaveLength(2);
  expect((await get(o, {})).body.data.transactions).toHaveLength(0);
  expect((await get(c, { role: 'owner' })).body.data.transactions).toHaveLength(0);
  expect((await get(b, { status: 'bogus' })).status).toBe(400);
  expect((await request(app).get('/api/transactions')).status).toBe(401);
});
