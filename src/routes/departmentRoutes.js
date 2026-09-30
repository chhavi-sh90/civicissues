// src/routes/departmentRoutes.js

const express = require('express');
const router = express.Router();

const departmentController = require('../controllers/departmentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validateMiddleware');
const departmentValidator = require('../validators/departmentValidator');

router.use(authMiddleware);

router.get('/', departmentController.list);
router.post('/', roleMiddleware('admin'), validate(departmentValidator.create), departmentController.create);
router.put(
  '/:id',
  roleMiddleware('admin'),
  validate(departmentValidator.update),
  departmentController.update
);
router.get('/:id/officials', roleMiddleware('admin'), departmentController.officials);

module.exports = router;
