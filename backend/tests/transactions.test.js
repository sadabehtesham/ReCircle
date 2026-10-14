const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Item = require('../src/models/Item');
const BorrowRequest = require('../src/models/BorrowRequest');
const Transaction = require('../src/models/Transaction');
const db = require('./db');
const { DAY, today } = require('../src/utils/dates');
const { signup, dates, makeItem, ask } = require('./helpers');

beforeAll(async () => {
  await db.connect();
  await Promise.all([User.init(), Item.init(), BorrowRequest.init(), Transaction.init()]);
});
afterEach(db.clear);
afterAll(db.close);

const setup = async (type = 'borrow', extra = {}) => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const item = await makeItem(owner.id, {
    lendingType: type,
    ...(type === 'sell' ? { price: 500 } : {}),
    ...extra,
  });
  const response = await ask(borrower, item.id, type === 'borrow' ? dates(1, 3) : {});
  expect(response.status).toBe(201);
  const id = response.body.data.request._id;
  if (type === 'borrow') expect((await owner.agent.patch(`/api/requests/${id}/approve`)).status).toBe(200);
  return { owner, borrower, item, id };
};

const handover = (user, id, body) => {
  const req = user.agent.post(`/api/requests/${id}/handover`);
  return body === undefined ? req : req.send(body);
};
const handback = (user, id, body) => {
  const req = user.agent.post(`/api/requests/${id}/return`);
  return body === undefined ? req : req.send(body);
};

test('handover requires authentication and is restricted to the item owner', async () => {
  const { owner, borrower, id } = await setup();
  const stranger = await signup(3);
  expect((await request(app).post(`/api/requests/${id}/handover`)).status).toBe(401);
  expect((await handover(borrower, id)).status).toBe(403);
  expect((await handover(stranger, id)).status).toBe(404);
  expect((await handover(owner, '000000000000000000000000')).status).toBe(404);
  expect((await handover(owner, id)).status).toBe(200);
});

test('borrow handover creates one active transaction and leaves the item available', async () => {
  const { owner, borrower, item, id } = await setup();
  const response = await handover(owner, id, { condition: 'good' });
  expect(response.status).toBe(200);
  expect(response.body.data.request).toMatchObject({ status: 'active', overdue: false });
  expect(response.body.data.transaction).toMatchObject({
    requestId: id,
    itemId: item.id,
    ownerId: owner.id,
    borrowerId: borrower.id,
    type: 'borrow',
    currentStatus: 'active',
    conditionBefore: 'good',
    overdue: false,
  });
  expect(response.body.data.transaction.dueAt).toBeTruthy();
  expect(await Transaction.countDocuments({ requestId: id })).toBe(1);
  expect((await Item.findById(item.id)).listingStatus).toBe('available');
});

test('handover rejects an expired booking and invalid conditions', async () => {
  const { owner, id } = await setup();
  expect((await handover(owner, id, { condition: 'broken' })).status).toBe(400);

  await BorrowRequest.updateOne(
    { _id: id },
    { startDate: new Date(today().getTime() - 2 * DAY), endDate: new Date(today().getTime() - DAY) }
  );
  const expired = await handover(owner, id);
  expect(expired.status).toBe(409);
  expect(await Transaction.countDocuments({ requestId: id })).toBe(0);
});

test('sale handover requires payment confirmation and snapshots sale details', async () => {
  const { owner, item, id } = await setup('sell');
  const missingPayment = await handover(owner, id);
  expect(missingPayment.status).toBe(400);
  expect((await BorrowRequest.findById(id)).status).toBe('approved');

  const response = await handover(owner, id, { paymentReceived: true, condition: 'new' });
  expect(response.status).toBe(200);
  expect(response.body.data.request.status).toBe('completed');
  expect(response.body.data.transaction).toMatchObject({
    type: 'sell',
    currentStatus: 'completed',
    conditionBefore: 'new',
    price: 500,
  });
  expect(response.body.data.transaction.paymentReceivedAt).toBeTruthy();
  expect(response.body.data.transaction.completedAt).toBeTruthy();
  expect((await Item.findById(item.id)).listingStatus).toBe('closed');
});

test('giveaway handover completes the request without payment confirmation', async () => {
  const { owner, item, id } = await setup('giveaway');
  const response = await handover(owner, id);
  expect(response.status).toBe(200);
  expect(response.body.data.request.status).toBe('completed');
  expect(response.body.data.transaction).toMatchObject({ type: 'giveaway', currentStatus: 'completed' });
  expect((await Item.findById(item.id)).listingStatus).toBe('closed');
});

test('return records condition and closes the borrowed item', async () => {
  const { owner, item, id } = await setup();
  await handover(owner, id);
  const response = await handback(owner, id, { condition: 'fair' });
  expect(response.status).toBe(200);
  expect(response.body.data.request.status).toBe('returned');
  expect(response.body.data.transaction).toMatchObject({
    currentStatus: 'completed',
    conditionAfter: 'fair',
    returnConfirmedBy: owner.id,
  });
  expect(response.body.data.transaction.returnedAt).toBeTruthy();
  expect(response.body.data.transaction.completedAt).toBeTruthy();
  expect((await Item.findById(item.id)).listingStatus).toBe('closed');
});

test('borrowers cannot confirm a return and non-active requests cannot be returned', async () => {
  const { owner, borrower, id } = await setup();
  expect((await handback(borrower, id)).status).toBe(403);
  expect((await handback(owner, id)).status).toBe(409);
  await handover(owner, id);
  expect((await handback(owner, id)).status).toBe(200);
  expect((await handback(owner, id)).status).toBe(409);
});

test('concurrent handovers create exactly one transaction', async () => {
  const { owner, id } = await setup();
  const responses = await Promise.all([handover(owner, id), handover(owner, id)]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  expect(await Transaction.countDocuments({ requestId: id })).toBe(1);
});

test('handover racing borrower cancellation has one winner', async () => {
  const { owner, borrower, id } = await setup();
  const responses = await Promise.all([
    handover(owner, id),
    borrower.agent.patch(`/api/requests/${id}/cancel`),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  const savedRequest = await BorrowRequest.findById(id);
  if (savedRequest.status === 'active') {
    expect(await Transaction.countDocuments({ requestId: id })).toBe(1);
  } else {
    expect(savedRequest.status).toBe('cancelled');
    expect(await Transaction.countDocuments({ requestId: id })).toBe(0);
  }
});

test('concurrent returns complete the loan only once', async () => {
  const { owner, id } = await setup();
  await handover(owner, id);
  const responses = await Promise.all([handback(owner, id), handback(owner, id)]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  expect(await Transaction.countDocuments({ requestId: id, currentStatus: 'completed' })).toBe(1);
});

test('transaction listing filters by participant and exposes computed overdue status', async () => {
  const { owner, borrower, id } = await setup();
  await handover(owner, id);
  const transaction = await Transaction.findOne({ requestId: id });
  transaction.dueAt = today();
  await transaction.save();

  const ownerResults = await owner.agent.get('/api/transactions').query({ role: 'owner' });
  expect(ownerResults.status).toBe(200);
  expect(ownerResults.body.data).toMatchObject({ page: 1, limit: 10, total: 1, pages: 1 });
  expect(ownerResults.body.data.transactions[0]).toMatchObject({ requestId: id, overdue: true });

  const borrowerResults = await borrower.agent.get('/api/transactions');
  expect(borrowerResults.status).toBe(200);
  expect(borrowerResults.body.data.transactions).toHaveLength(1);
  expect((await owner.agent.get('/api/transactions?status=invalid')).status).toBe(400);
  expect((await request(app).get('/api/transactions')).status).toBe(401);
});

test('request JSON includes computed overdue status and omits the legacy id alias', async () => {
  const { owner, borrower, id } = await setup();
  await handover(owner, id);
  await BorrowRequest.updateOne({ _id: id }, { endDate: new Date(today().getTime() - DAY) });

  const response = await borrower.agent.get('/api/requests');
  expect(response.status).toBe(200);
  expect(response.body.data.requests[0]).toMatchObject({ _id: id, status: 'active', overdue: true });
  expect(response.body.data.requests[0].id).toBeUndefined();
});
