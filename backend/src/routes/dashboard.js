const router = require('express').Router();
const { get } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.get('/', protect, get);

module.exports = router;
