import { Request, Response, NextFunction } from 'express';
import { uploadToCloudinary } from '../../libs/cloudinary';
import { AppError } from '../../middleware/errors';
import { logger } from '../../config/logger';

export async function uploadFileController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError('VALIDATION_ERROR', 'No file provided', 400);
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      throw new AppError('VALIDATION_ERROR', 'File size exceeds 10MB limit', 400);
    }

    // Validate file type (allow common document and image types)
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'text/plain',
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'File type not allowed. Allowed types: images, PDF, Word, Excel, text files',
        400
      );
    }

    // Determine resource type based on mime type
    let resourceType: 'image' | 'raw' | 'auto' = 'auto';
    if (req.file.mimetype.startsWith('image/')) {
      resourceType = 'image';
    } else {
      resourceType = 'raw';
    }

    // Upload to Cloudinary
    const folder = req.body.folder || 'leave-attachments';
    const result = await uploadToCloudinary(req.file.buffer, folder, resourceType);

    logger.info({ publicId: result.publicId, folder }, 'File uploaded to Cloudinary');

    res.json({
      data: {
        url: result.secureUrl,
        publicId: result.publicId,
      },
    });
  } catch (error) {
    next(error);
  }
}

