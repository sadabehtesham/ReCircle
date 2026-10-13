const router = require('express').Router();
const c = require('../controllers/itemController');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { protect, requireRole } = require('../middleware/auth');
const v = require('../validators/items');

router.get('/', validate(v.list, 'query'), c.list);
router.get('/:id', c.getOne);
router.post('/', protect, requireRole('student'), upload, validate(v.create), c.create);
router.patch('/:id', protect, upload, validate(v.update), c.update);
router.delete('/:id', protect, c.remove);

module.exports = router;
