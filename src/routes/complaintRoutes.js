// src/routes/complaintRoutes.js

const express = require('express');
const router = express.Router();

const complaintController = require('../controllers/complaintController');
const imageController = require('../controllers/imageController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validateMiddleware');
const { multipleImages, singleImage } = require('../middleware/uploadMiddleware');
const complaintValidator = require('../validators/complaintValidator');

router.use(authMiddleware);

router.post(
  '/',
  roleMiddleware('citizen'),
  multipleImages,
  validate(complaintValidator.create),
  complaintController.create
);

router.get('/my', roleMiddleware('citizen'), validate(complaintValidator.listQuery, { source: 'query' }), complaintController.myComplaints);

router.get(
  '/assigned',
  roleMiddleware('department_official'),
  validate(complaintValidator.listQuery, { source: 'query' }),
  complaintController.assignedToMe
);

router.get('/', validate(complaintValidator.listQuery, { source: 'query' }), complaintController.list);

router.get('/:id', complaintController.getOne);
router.get('/:id/history', complaintController.getHistory);

router.put(
  '/:id/status',
  roleMiddleware('department_official', 'admin'),
  validate(complaintValidator.updateStatus),
  complaintController.updateStatus
);

router.post('/:id/images', singleImage, imageController.addImage);
router.delete('/:id/images/:imageId', imageController.deleteImage);

module.exports = router;
