const router = require('express').Router();
const c = require('../controllers/userController');
const validate = require('../middleware/validate');
const { avatar } = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const v = require('../validators/users');

router.get('/:id', c.getPublic);
router.patch('/me', protect, avatar, validate(v.update), c.updateMe);

module.exports = router;
