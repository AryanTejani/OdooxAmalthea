import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth';
import * as uploadController from './upload.controller';

const router = Router();

// Configure multer to store files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// File upload endpoint (authenticated users only)
router.post(
  '/file',
  requireAuth,
  upload.single('file'),
  uploadController.uploadFileController
);

export default router;

