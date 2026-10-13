const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Item = require('../src/models/Item');
const BorrowRequest = require('../src/models/BorrowRequest');
const db = require('./db');
const { signup, dates, day, makeItem, ask } = require('./helpers');

beforeAll(async () => {
  await db.connect();
  await User.init();
  await Item.init();
  await BorrowRequest.init();
});
afterEach(db.clear);
afterAll(db.close);

const act = (verb) => (u, id) => u.agent.patch(`/api/requests/${id}/${verb}`);
const approve = act('approve');
const reject = act('reject');
const cancel = act('cancel');

const setup = async (ranges) => {
  const o = await signup(1);
  const item = await makeItem(o.id);
  const reqs = [];
  for (const [i, [s, e]] of ranges.entries()) {
    const b = await signup(i + 2);
    const res = await ask(b, item._id, dates(s, e));
    reqs.push({ b, id: res.body.data.request._id });
  }
  return { o, item, reqs };
};

test('only the owner can approve or reject, and login is required', async () => {
  const { o, reqs: [r] } = await setup([[1, 3]]);
  expect((await request(app).patch(`/api/requests/${r.id}/approve`)).status).toBe(401);
  expect((await approve(r.b, r.id)).status).toBe(404);
  expect((await reject(r.b, r.id)).status).toBe(404);
  const stranger = await signup(9);
  expect((await approve(stranger, r.id)).status).toBe(404);
  expect((await approve(o, r.id)).status).toBe(200);
});

test('approval records who decided and when', async () => {
  const { o, reqs: [r] } = await setup([[1, 3]]);
  const res = await approve(o, r.id);
  expect(res.body.data.request).toMatchObject({ status: 'approved', reviewedBy: o.id });
  expect(res.body.data.request.reviewedAt).toBeTruthy();
});

test('overlap is inclusive of both end dates; adjacent days do not conflict', async () => {
  const { o, reqs: [a, b, c] } = await setup([[1, 3], [3, 5], [4, 6]]);
  expect((await approve(o, a.id)).status).toBe(200);
  const clash = await approve(o, b.id);
  expect(clash.status).toBe(409);
  expect(clash.body.message).toMatch(/overlaps/i);
  expect((await approve(o, c.id)).status).toBe(200);
});

test('cancelling an approved booking frees its dates', async () => {
  const { o, reqs: [a, b] } = await setup([[1, 3], [2, 4]]);
  await approve(o, a.id);
  expect((await approve(o, b.id)).status).toBe(409);
  expect((await cancel(o, a.id)).status).toBe(200);
  expect((await approve(o, b.id)).status).toBe(200);
});

test('concurrent approvals of overlapping requests: exactly one wins', async () => {
  const { o, item, reqs } = await setup([[1, 3], [2, 4]]);
  const res = await Promise.all(reqs.map((r) => approve(o, r.id)));
  expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await BorrowRequest.countDocuments({ itemId: item._id, status: 'approved' })).toBe(1);
});

test('five simultaneous approvals for the same dates: exactly one wins', async () => {
  const { o, item, reqs } = await setup(Array(5).fill([1, 3]));
  const res = await Promise.all(reqs.map((r) => approve(o, r.id)));
  expect(res.map((r) => r.status).sort()).toEqual([200, 409, 409, 409, 409]);
  expect(await BorrowRequest.countDocuments({ itemId: item._id, status: 'approved' })).toBe(1);
});

test('concurrent approvals for different dates both succeed', async () => {
  const { o, reqs } = await setup([[1, 2], [5, 6]]);
  const res = await Promise.all(reqs.map((r) => approve(o, r.id)));
  expect(res.map((r) => r.status)).toEqual([200, 200]);
});

test('rejecting works once, and a rejected request cannot be approved', async () => {
  const { o, reqs: [a] } = await setup([[1, 3]]);
  const res = await reject(o, a.id);
  expect(res.body.data.request).toMatchObject({ status: 'rejected', reviewedBy: o.id });
  expect((await reject(o, a.id)).status).toBe(409);
  expect((await approve(o, a.id)).status).toBe(409);
});

test('only pending borrow requests can be approved or rejected', async () => {
  const { o, reqs: [a] } = await setup([[1, 3]]);
  await cancel(a.b, a.id);
  expect((await approve(o, a.id)).status).toBe(409);

  const buyer = await signup(8);
  const sale = await makeItem(o.id, { lendingType: 'sell', price: 10 });
  const sold = (await ask(buyer, sale._id)).body.data.request;
  expect((await approve(o, sold._id)).status).toBe(409);
  expect((await reject(o, sold._id)).status).toBe(409);
});

test('a request whose start date has passed cannot be approved', async () => {
  const o = await signup(1);
  const b = await signup(2);
  const item = await makeItem(o.id);
  const r = await BorrowRequest.create({
    itemId: item._id, ownerId: o.id, borrowerId: b.id, type: 'borrow',
    startDate: new Date(day(-2)), endDate: new Date(day(1)),
  });
  expect((await approve(o, r._id)).status).toBe(409);
});

test('cannot approve when the item is no longer available', async () => {
  const { o, item, reqs: [a] } = await setup([[1, 3]]);
  await Item.updateOne({ _id: item._id }, { listingStatus: 'unavailable' });
  expect((await approve(o, a.id)).status).toBe(409);
});
