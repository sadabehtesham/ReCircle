const router = require('express').Router();
const c = require('../controllers/requestController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const v = require('../validators/requests');

router.use(protect);
router.get('/', validate(v.list, 'query'), c.list);
router.post('/', validate(v.create), c.create);
router.patch('/:id/cancel', c.cancel);
router.patch('/:id/approve', c.approve);
router.patch('/:id/reject', c.reject);
router.post('/:id/handover', validate(v.handover), c.handover);
router.post('/:id/return', validate(v.handback), c.handback);

module.exports = router;
