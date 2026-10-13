const cloudinary = require('../config/cloudinary');

const upload = (file, folder) =>
  new Promise((resolve, reject) =>
    cloudinary.uploader
      .upload_stream(
        { folder: `reuseloop/${folder}`, resource_type: 'image', transformation: [{ width: 1200, crop: 'limit' }] },
        (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          if (!result?.secure_url || !result.public_id) {
            reject(new Error('Cloudinary did not return the uploaded image details'));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      )
      .end(file.buffer)
  );

const removeAll = (ids) => Promise.all(ids.map((id) => cloudinary.uploader.destroy(id)));

exports.uploadAll = async (files = [], folder) => {
  const results = await Promise.allSettled(files.map((file) => upload(file, folder)));
  const uploaded = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  const uploadError = results.find((result) => result.status === 'rejected');
  if (uploadError) {
    try {
      await removeAll(uploaded.map((image) => image.publicId));
    } catch (cleanupError) {
      throw new AggregateError([uploadError.reason, cleanupError], 'Image upload failed and uploaded images could not all be removed');
    }
    throw uploadError.reason;
  }
  return uploaded;
};

exports.removeAll = removeAll;
