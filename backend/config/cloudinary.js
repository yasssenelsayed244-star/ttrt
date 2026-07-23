const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const config = require('./env');
const logger = require('../utils/logger');

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

const uploadBuffer = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: options.folder || 'quickbite',
        transformation: options.transformation || [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
        public_id: options.publicId,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

const deleteImage = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.warn(`Cloudinary delete failed for ${publicId}: ${err.message}`);
  }
};

const getPublicId = (url) => {
  if (!url) return null;
  const parts = url.split('/');
  const filename = parts[parts.length - 1].split('.')[0];
  const folder = parts[parts.length - 2];
  return `${folder}/${filename}`;
};

const UPLOAD_PRESETS = {
  avatar:          { folder: 'quickbite/avatars',            transformation: [{ width: 300,  height: 300, crop: 'fill', gravity: 'face' }, { quality: 'auto' }] },
  restaurantLogo:  { folder: 'quickbite/restaurants/logos',  transformation: [{ width: 400,  height: 400, crop: 'fill' }, { quality: 'auto' }] },
  restaurantCover: { folder: 'quickbite/restaurants/covers', transformation: [{ width: 1200, height: 400, crop: 'fill' }, { quality: 'auto' }] },
  menuItem:        { folder: 'quickbite/menu',               transformation: [{ width: 600,  height: 400, crop: 'fill' }, { quality: 'auto' }] },
};

module.exports = { uploadBuffer, deleteImage, getPublicId, UPLOAD_PRESETS };
