const request = require('supertest');
const app = require('../src/app');
const errorHandler = require('../src/middleware/errorHandler');
const ApiError = require('../src/utils/ApiError');

test('unknown routes return a JSON 404', async () => {
  const res = await request(app).get('/not-a-route');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ success: false, message: 'Not found' });
});

test('ApiError status and message are preserved by the error handler', () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  errorHandler(new ApiError(403, 'Forbidden'), {}, res, jest.fn());

  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Forbidden' });
});
