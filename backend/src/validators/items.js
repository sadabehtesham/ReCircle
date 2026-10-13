const { z } = require('zod');
const { CATEGORIES, CONDITIONS, LENDING_TYPES } = require('../utils/constants');

const base = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(1000),
  category: z.enum(CATEGORIES),
  condition: z.enum(CONDITIONS),
  lendingType: z.enum(LENDING_TYPES),
  price: z.coerce.number().int().min(0).max(100000).optional(),
  pickupLocation: z.string().trim().min(2).max(100),
});

exports.create = base.refine((data) => (data.lendingType === 'sell') === (data.price !== undefined), {
  message: 'Price is required for items for sale, and only for them',
  path: ['price'],
});

exports.update = base
  .omit({ lendingType: true })
  .partial()
  .extend({
    listingStatus: z.enum(['available', 'unavailable']).optional(),
    removeImages: z.union([z.string().transform((value) => [value]), z.array(z.string())]).default([]),
  });

exports.list = z.object({
  search: z.string().trim().max(60).optional(),
  category: z.enum(CATEGORIES).optional(),
  condition: z.enum(CONDITIONS).optional(),
  lendingType: z.enum(LENDING_TYPES).optional(),
  sort: z.enum(['newest', 'oldest', 'title']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
