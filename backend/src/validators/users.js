const { z } = require('zod');

exports.update = z.object({
  name: z.string().trim().min(2).max(60),
  college: z.string().trim().min(2).max(100),
}).partial();
