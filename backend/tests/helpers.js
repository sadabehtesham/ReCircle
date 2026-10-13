const request = require('supertest');
const app = require('../src/app');
const Item = require('../src/models/Item');
const { today } = require('../src/utils/dates');

exports.signup = async (n) => {
  const agent = request.agent(app);
  const r = await agent.post('/api/auth/register').send({
    name: `User${n}`,
    email: `u${n}@college.edu`,
    password: 'password123',
    college: 'Test College',
  });
  return { agent, id: r.body.data.user._id };
};

exports.day = (n) => new Date(today().getTime() + n * 86400000).toISOString().slice(0, 10);
exports.dates = (s = 1, e = 3) => ({ startDate: exports.day(s), endDate: exports.day(e) });

exports.makeItem = (ownerId, extra = {}) =>
  Item.create({
    title: 'Calculator', description: 'Works well enough', category: 'calculators', condition: 'good',
    lendingType: 'borrow', pickupLocation: 'Library', images: [{ url: 'http://i/1.jpg', publicId: 'p1' }], ownerId, ...extra,
  });

exports.ask = (u, itemId, extra = {}) => u.agent.post('/api/requests').send({ itemId: String(itemId), ...extra });
