// src/routes/userRoutes.js

const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validateMiddleware');
const authValidator = require('../validators/authValidator');

// All routes below require authentication
router.use(authMiddleware);

// Self-service profile management (any authenticated user)
router.get('/profile', userController.getProfile);
router.put('/profile', validate(authValidator.updateProfile), userController.updateProfile);
router.put(
  '/profile/password',
  validate(authValidator.updatePassword),
  userController.updatePassword
);
router.put(
  '/profile/fcm-token',
  validate(authValidator.updateFcmToken),
  userController.updateFcmToken
);

// Admin-only user management
router.post(
  '/',
  roleMiddleware('admin'),
  validate(authValidator.createUserByAdmin),
  authController.createUserByAdmin
);
router.get('/', roleMiddleware('admin', 'department_official'), userController.listUsers);
router.put(
  '/:id/status',
  roleMiddleware('admin'),
  validate(authValidator.setUserStatus),
  userController.setUserStatus
);

module.exports = router;
