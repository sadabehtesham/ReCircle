const router = require('express').Router();
const c = require('../controllers/requestController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const v = require('../validators/requests');

router.use(protect);
router.get('/', validate(v.list, 'query'), c.list);
router.post('/', validate(v.create), c.create);
router.patch('/:id/cancel', c.cancel);

module.exports = router;
