import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  url: string;
  publicId: string;
  secureUrl: string;
}

/**
 * Upload a file to Cloudinary
 * @param fileBuffer - File buffer from multer
 * @param folder - Folder path in Cloudinary (e.g., 'leave-attachments')
 * @param resourceType - Type of resource ('image', 'raw', 'auto')
 * @returns Upload result with URL and public ID
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string = 'leave-attachments',
  resourceType: 'image' | 'raw' | 'auto' = 'auto'
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          logger.error({ error }, 'Cloudinary upload failed');
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error('Upload failed: No result from Cloudinary'));
          return;
        }

        resolve({
          url: result.url,
          publicId: result.public_id,
          secureUrl: result.secure_url,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * Delete a file from Cloudinary
 * @param publicId - Public ID of the file to delete
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
    logger.info({ publicId }, 'File deleted from Cloudinary');
  } catch (error) {
    logger.error({ error, publicId }, 'Failed to delete file from Cloudinary');
    throw error;
  }
}

export { cloudinary };

