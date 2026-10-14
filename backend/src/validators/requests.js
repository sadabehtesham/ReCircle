const { z } = require('zod');
const { REQUEST_STATUSES, CONDITIONS } = require('../utils/constants');
const { today, dayCount, DAY } = require('../utils/dates');

const MAX_DAYS = 14;
const MAX_AHEAD_DAYS = 60;

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid ID');

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must look like 2026-12-31')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Invalid date')
  .transform((value) => new Date(`${value}T00:00:00Z`));

const dated = (check) => (data) => !data.startDate || !data.endDate || check(data);

exports.create = z
  .object({
    itemId: objectId,
    startDate: day.optional(),
    endDate: day.optional(),
    message: z.string().trim().max(300).optional(),
  })
  .refine((data) => !data.startDate === !data.endDate, {
    message: 'Provide both a start and an end date',
    path: ['startDate'],
  })
  .refine(dated((data) => data.endDate >= data.startDate), {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })
  .refine(dated((data) => data.startDate >= today()), {
    message: 'Start date cannot be in the past',
    path: ['startDate'],
  })
  .refine(dated((data) => data.startDate <= new Date(today().getTime() + MAX_AHEAD_DAYS * DAY)), {
    message: `Start date can be at most ${MAX_AHEAD_DAYS} days ahead`,
    path: ['startDate'],
  })
  .refine(dated((data) => dayCount(data.startDate, data.endDate) <= MAX_DAYS), {
    message: `You can borrow for at most ${MAX_DAYS} days`,
    path: ['endDate'],
  });

exports.list = z.object({
  role: z.enum(['borrower', 'owner']).default('borrower'),
  status: z.enum(REQUEST_STATUSES).optional(),
  itemId: objectId.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

exports.handover = z.object({
  condition: z.enum(CONDITIONS).optional(),
  paymentReceived: z.boolean().optional(),
});

exports.handback = z.object({
  condition: z.enum(CONDITIONS).optional(),
});
