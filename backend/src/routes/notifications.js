const router = require('express').Router();
const c = require('../controllers/notificationController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const v = require('../validators/notifications');

router.use(protect);
router.get('/', validate(v.list, 'query'), c.list);
router.get('/unread-count', c.unreadCount);
router.patch('/read-all', c.markAllRead);
router.patch('/:id/read', c.markRead);

module.exports = router;
