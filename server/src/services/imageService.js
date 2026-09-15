const ImageKit = require('imagekit');

const isRealImageKit =
  process.env.IMAGEKIT_PUBLIC_KEY &&
  process.env.IMAGEKIT_PRIVATE_KEY &&
  process.env.IMAGEKIT_URL_ENDPOINT &&
  !process.env.IMAGEKIT_PUBLIC_KEY.includes('xxxxxxxx') &&
  !process.env.IMAGEKIT_PRIVATE_KEY.includes('xxxxxxxx');

let imagekit = null;
if (isRealImageKit) {
  imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
  console.log('[ImageService] ImageKit CDN initialized with live credentials.');
} else {
  console.log('[ImageService] ImageKit running in development mock adapter mode.');
}

/**
 * Upload a single image buffer to ImageKit (or mock storage in development)
 *
 * @param {Buffer} fileBuffer - In-memory image file buffer
 * @param {string} fileName - Original file name
 * @param {string} folder - Destination folder on ImageKit
 * @returns {Promise<{ url: string, fileId: string }>}
 */
const uploadImage = async (fileBuffer, fileName, folder = '/shopsphere/products') => {
  const sanitizedFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  if (isRealImageKit && imagekit) {
    const result = await imagekit.upload({
      file: fileBuffer,
      fileName: sanitizedFileName,
      folder,
      useUniqueFileName: true,
    });

    return {
      url: result.url,
      fileId: result.fileId,
    };
  }

  // Development / Test Fallback Adapter
  const mockFileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const mockUrl = `https://ik.imagekit.io/shopsphere_dev${folder}/${sanitizedFileName}`;

  return {
    url: mockUrl,
    fileId: mockFileId,
  };
};

/**
 * Delete an image asset from ImageKit by fileId
 *
 * @param {string} fileId - ImageKit fileId
 */
const deleteImage = async (fileId) => {
  if (!fileId) return;

  if (isRealImageKit && imagekit) {
    try {
      await imagekit.deleteFile(fileId);
      console.log(`[ImageService] Deleted ImageKit asset: ${fileId}`);
    } catch (err) {
      console.error(`[ImageService] Failed to delete ImageKit asset ${fileId}:`, err.message);
    }
  } else {
    console.log(`[ImageService] [Mock] Deleted image asset with ID: ${fileId}`);
  }
};

module.exports = {
  uploadImage,
  deleteImage,
};
