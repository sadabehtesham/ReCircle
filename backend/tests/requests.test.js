const request = require('supertest');
const app = require('../src/app');
const BorrowRequest = require('../src/models/BorrowRequest');
const Item = require('../src/models/Item');
const User = require('../src/models/User');
const { DAY, today } = require('../src/utils/dates');
const db = require('./db');

beforeAll(async () => {
  await db.connect();
  await Promise.all([BorrowRequest.init(), Item.init(), User.init()]);
});
afterEach(db.clear);
afterAll(db.close);

const signup = async (number) => {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/register').send({
    name: `Request User ${number}`,
    email: `request-user-${number}@college.edu`,
    password: 'password123',
    college: 'Test College',
  });
  expect(response.status).toBe(201);
  return { agent, id: response.body.data.user._id };
};

const createItem = (owner, overrides = {}) =>
  Item.create({
    title: 'Request test item',
    description: 'An item used for request API tests.',
    category: 'calculators',
    condition: 'good',
    images: [{ url: 'https://images.example/item.png', publicId: 'request-test-image' }],
    ownerId: owner.id,
    lendingType: 'borrow',
    pickupLocation: 'Library',
    ...overrides,
  });

const dateString = (date) => date.toISOString().slice(0, 10);
const futureDate = (days) => dateString(new Date(today().getTime() + days * DAY));

test('request creation requires authentication and rejects own or missing items', async () => {
  expect((await request(app).post('/api/requests').send({ itemId: '000000000000000000000000' })).status).toBe(401);

  const owner = await signup(1);
  const item = await createItem(owner);
  expect((await owner.agent.post('/api/requests').send({ itemId: item.id })).status).toBe(400);

  const borrower = await signup(2);
  expect((await borrower.agent.post('/api/requests').send({ itemId: '000000000000000000000000' })).status).toBe(404);
});

test('borrow requests require valid inclusive dates and are created pending', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const item = await createItem(owner);
  const startDate = futureDate(0);
  const endDate = futureDate(13);

  const response = await borrower.agent.post('/api/requests').send({
    itemId: item.id,
    startDate,
    endDate,
    message: 'I will take good care of it.',
  });
  expect(response.status).toBe(201);
  expect(response.body.data.request).toMatchObject({
    itemId: item.id,
    ownerId: owner.id,
    borrowerId: borrower.id,
    type: 'borrow',
    status: 'pending',
    message: 'I will take good care of it.',
  });
  expect(response.body.data.request.startDate).toBe(`${startDate}T00:00:00.000Z`);
  expect(response.body.data.request.endDate).toBe(`${endDate}T00:00:00.000Z`);

  const duplicate = await borrower.agent.post('/api/requests').send({ itemId: item.id, startDate, endDate });
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.message).toBe('You already have an open request for this item');

  const edit = await owner.agent.patch(`/api/items/${item.id}`).send({ title: 'Changed while requested' });
  expect(edit.status).toBe(409);
  expect(edit.body.message).toBe('This listing has open requests and cannot be changed');
  expect((await owner.agent.delete(`/api/items/${item.id}`)).status).toBe(409);
});

test('request participants and initial status come from the session and item, not the body', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const item = await createItem(owner);
  const response = await borrower.agent.post('/api/requests').send({
    itemId: item.id,
    startDate: futureDate(1),
    endDate: futureDate(3),
    borrowerId: owner.id,
    ownerId: borrower.id,
    status: 'approved',
  });

  expect(response.status).toBe(201);
  expect(response.body.data.request).toMatchObject({
    borrowerId: borrower.id,
    ownerId: owner.id,
    status: 'pending',
    type: 'borrow',
  });
});

test('borrow requests reject unavailable, removed, unknown, and malformed item IDs', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const item = await createItem(owner);
  const dates = { startDate: futureDate(1), endDate: futureDate(3) };

  await Item.updateOne({ _id: item.id }, { listingStatus: 'unavailable' });
  expect((await borrower.agent.post('/api/requests').send({ itemId: item.id, ...dates })).status).toBe(409);
  await Item.updateOne({ _id: item.id }, { listingStatus: 'removed' });
  expect((await borrower.agent.post('/api/requests').send({ itemId: item.id, ...dates })).status).toBe(404);
  expect((await borrower.agent.post('/api/requests').send({
    itemId: '000000000000000000000000',
    ...dates,
  })).status).toBe(404);
  expect((await borrower.agent.post('/api/requests').send({ itemId: 'not-an-id', ...dates })).status).toBe(400);
});

test('borrow date validation rejects missing, malformed, impossible, past, too-far, and overlong dates', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const item = await createItem(owner);
  const post = (dates) => borrower.agent.post('/api/requests').send({ itemId: item.id, ...dates });

  expect((await post({ startDate: futureDate(0) })).status).toBe(400);
  expect((await post({})).status).toBe(400);
  expect((await post({ startDate: '14/10/2026', endDate: '15/10/2026' })).status).toBe(400);
  expect((await post({ startDate: '2026-02-31', endDate: '2026-03-01' })).status).toBe(400);
  expect((await post({ startDate: futureDate(-1), endDate: futureDate(0) })).status).toBe(400);
  expect((await post({ startDate: futureDate(61), endDate: futureDate(61) })).status).toBe(400);
  expect((await post({ startDate: futureDate(0), endDate: futureDate(14) })).status).toBe(400);
  expect((await post({ startDate: futureDate(2), endDate: futureDate(1) })).status).toBe(400);
});

test('sell and giveaway requests atomically reserve the item and auto-approve', async () => {
  const owner = await signup(1);
  const firstBuyer = await signup(2);
  const secondBuyer = await signup(3);

  for (const lendingType of ['sell', 'giveaway']) {
    const item = await createItem(owner, {
      lendingType,
      ...(lendingType === 'sell' ? { price: 500 } : {}),
    });
    const response = await firstBuyer.agent.post('/api/requests').send({ itemId: item.id });
    expect(response.status).toBe(201);
    expect(response.body.data.request).toMatchObject({ type: lendingType, status: 'approved' });
    expect(response.body.data.request.reviewedBy).toBeUndefined();
    expect((await Item.findById(item.id)).listingStatus).toBe('reserved');

    const unavailable = await secondBuyer.agent.post('/api/requests').send({ itemId: item.id });
    expect(unavailable.status).toBe(409);
  }
});

test('concurrent sell requests have exactly one winner', async () => {
  const owner = await signup(1);
  const buyers = await Promise.all([signup(2), signup(3), signup(4), signup(5)]);
  const item = await createItem(owner, { lendingType: 'sell', price: 500 });
  const responses = await Promise.all(
    buyers.map(({ agent }) => agent.post('/api/requests').send({ itemId: item.id }))
  );

  expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
  expect(responses.filter((response) => response.status === 409)).toHaveLength(3);
  expect(await BorrowRequest.countDocuments({ itemId: item.id, status: 'approved' })).toBe(1);
  expect((await Item.findById(item.id)).listingStatus).toBe('reserved');
});

test('concurrent duplicate borrow submissions create only one open request', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const item = await createItem(owner);
  const body = {
    itemId: item.id,
    startDate: futureDate(1),
    endDate: futureDate(2),
  };

  const responses = await Promise.all([
    borrower.agent.post('/api/requests').send(body),
    borrower.agent.post('/api/requests').send(body),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  expect(await BorrowRequest.countDocuments({
    itemId: item.id,
    borrowerId: borrower.id,
    status: { $in: ['pending', 'approved', 'active', 'overdue'] },
  })).toBe(1);
});

test('dates are rejected for sell and giveaway items', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  for (const lendingType of ['sell', 'giveaway']) {
    const item = await createItem(owner, {
      lendingType,
      ...(lendingType === 'sell' ? { price: 500 } : {}),
    });
    const response = await borrower.agent.post('/api/requests').send({
      itemId: item.id,
      startDate: futureDate(0),
      endDate: futureDate(1),
    });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Dates only apply to borrowing');
  }
});

test('borrower and owner cancellation permissions are enforced and reservations released', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const stranger = await signup(3);
  const borrowItem = await createItem(owner);
  const borrowResponse = await borrower.agent.post('/api/requests').send({
    itemId: borrowItem.id,
    startDate: futureDate(0),
    endDate: futureDate(1),
  });
  const borrowRequest = borrowResponse.body.data.request;
  expect((await owner.agent.patch(`/api/requests/${borrowRequest._id}/cancel`)).status).toBe(409);
  expect((await stranger.agent.patch(`/api/requests/${borrowRequest._id}/cancel`)).status).toBe(404);
  expect((await owner.agent.patch(`/api/requests/${borrowRequest._id}/cancel`)).status).toBe(409);
  const cancelledBorrow = await borrower.agent.patch(`/api/requests/${borrowRequest._id}/cancel`);
  expect(cancelledBorrow.status).toBe(200);
  expect(cancelledBorrow.body.data.request.status).toBe('cancelled');
  expect(cancelledBorrow.body.data.request.cancelledBy).toBe(borrower.id);
  expect((await borrower.agent.patch(`/api/requests/${borrowRequest._id}/cancel`)).status).toBe(409);
  const retried = await borrower.agent.post('/api/requests').send({
    itemId: borrowItem.id,
    startDate: futureDate(2),
    endDate: futureDate(3),
  });
  expect(retried.status).toBe(201);

  const sellItem = await createItem(owner, { lendingType: 'sell', price: 500 });
  const saleResponse = await borrower.agent.post('/api/requests').send({ itemId: sellItem.id });
  const saleRequest = saleResponse.body.data.request;
  const cancelledSale = await owner.agent.patch(`/api/requests/${saleRequest._id}/cancel`);
  expect(cancelledSale.status).toBe(200);
  expect(cancelledSale.body.data.request.status).toBe('cancelled');
  expect((await Item.findById(sellItem.id)).listingStatus).toBe('available');
});

test('borrowers can cancel approved sale reservations and reopen the item', async () => {
  const owner = await signup(1);
  const buyer = await signup(2);
  const item = await createItem(owner, { lendingType: 'sell', price: 500 });
  const response = await buyer.agent.post('/api/requests').send({ itemId: item.id });
  expect(response.status).toBe(201);
  expect((await Item.findById(item.id)).listingStatus).toBe('reserved');

  const cancelled = await buyer.agent.patch(`/api/requests/${response.body.data.request._id}/cancel`);
  expect(cancelled.status).toBe(200);
  expect(cancelled.body.data.request.cancelledBy).toBe(buyer.id);
  expect((await Item.findById(item.id)).listingStatus).toBe('available');
});

test('request lists are private, filterable and populate safe related fields', async () => {
  const owner = await signup(1);
  const borrower = await signup(2);
  const item = await createItem(owner);
  const created = await borrower.agent.post('/api/requests').send({
    itemId: item.id,
    startDate: futureDate(0),
    endDate: futureDate(1),
  });
  expect(created.status).toBe(201);

  const borrowerList = await borrower.agent.get('/api/requests?limit=1&page=1');
  expect(borrowerList.status).toBe(200);
  expect(borrowerList.body.data).toMatchObject({ total: 1, pages: 1, page: 1, limit: 1 });
  expect(borrowerList.body.data.requests[0].itemId.title).toBe('Request test item');
  expect(borrowerList.body.data.requests[0].borrowerId.name).toBe('Request User 2');
  expect(borrowerList.body.data.requests[0].ownerId.email).toBeUndefined();
  expect((await borrower.agent.get('/api/requests?role=owner')).body.data.requests).toHaveLength(0);
  expect((await borrower.agent.get('/api/requests?status=approved')).body.data.requests).toHaveLength(0);

  const ownerList = await owner.agent.get(`/api/requests?role=owner&status=pending&itemId=${item.id}`);
  expect(ownerList.status).toBe(200);
  expect(ownerList.body.data.requests).toHaveLength(1);
  expect((await owner.agent.get('/api/requests')).body.data.requests).toHaveLength(0);
  expect((await owner.agent.get('/api/requests?role=invalid')).status).toBe(400);
  expect((await request(app).get('/api/requests')).status).toBe(401);
});
