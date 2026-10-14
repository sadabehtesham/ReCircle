const { z } = require('zod');

exports.list = z.object({
  unread: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});
