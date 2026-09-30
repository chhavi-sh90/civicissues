// src/routes/categoryRoutes.js

const express = require('express');
const router = express.Router();

const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validateMiddleware');
const categoryValidator = require('../validators/categoryValidator');

router.use(authMiddleware);

router.get('/', categoryController.list);
router.post('/', roleMiddleware('admin'), validate(categoryValidator.create), categoryController.create);
router.put('/:id', roleMiddleware('admin'), validate(categoryValidator.update), categoryController.update);
router.delete('/:id', roleMiddleware('admin'), categoryController.remove);

module.exports = router;
