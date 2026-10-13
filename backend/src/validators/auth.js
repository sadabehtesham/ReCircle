const { z } = require('zod');

const email = z.string().trim().toLowerCase().email('Invalid email');

exports.register = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(60),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  college: z.string().trim().min(2).max(100),
});

exports.login = z.object({ email, password: z.string().min(1, 'Password is required') });
