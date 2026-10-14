const router = require('express').Router();
const c = require('../controllers/transactionController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const v = require('../validators/transactions');

router.get('/', protect, validate(v.list, 'query'), c.list);

module.exports = router;
