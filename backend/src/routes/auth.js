const router = require('express').Router();
const c = require('../controllers/authController');
const validate = require('../middleware/validate');
const authLimiter = require('../middleware/rateLimit');
const { protect } = require('../middleware/auth');
const schemas = require('../validators/auth');

router.post('/register', authLimiter, validate(schemas.register), c.register);
router.post('/login', authLimiter, validate(schemas.login), c.login);
router.post('/logout', c.logout);
router.get('/me', protect, c.me);

module.exports = router;
