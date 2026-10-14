const { z } = require('zod');

exports.list = z.object({
  role: z.enum(['borrower', 'owner']).default('borrower'),
  status: z.enum(['active', 'completed']).default('active'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
