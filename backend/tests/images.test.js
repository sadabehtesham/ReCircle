const cloudinary = require('../src/config/cloudinary');
const images = require('../src/services/images');

afterEach(() => {
  jest.restoreAllMocks();
});

test('uploads images to the requested folder with the size limit transformation', async () => {
  const uploadStream = jest.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options, callback) => ({
    end(buffer) {
      expect(buffer.toString()).toBe('image data');
      callback(null, { secure_url: 'https://images.example/item.png', public_id: 'reuseloop/items/item' });
      return this;
    },
  }));

  await expect(images.uploadAll([{ buffer: Buffer.from('image data') }], 'items')).resolves.toEqual([
    { url: 'https://images.example/item.png', publicId: 'reuseloop/items/item' },
  ]);
  expect(uploadStream).toHaveBeenCalledWith(
    {
      folder: 'reuseloop/items',
      resource_type: 'image',
      transformation: [{ width: 1200, crop: 'limit' }],
    },
    expect.any(Function)
  );
});

test('cleans up successful uploads when another image upload fails', async () => {
  const destroy = jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
  jest.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options, callback) => ({
    end(buffer) {
      if (buffer.toString() === 'bad') {
        callback(new Error('Upload rejected'));
      } else {
        callback(null, { secure_url: 'https://images.example/item.png', public_id: 'uploaded-item' });
      }
      return this;
    },
  }));

  await expect(
    images.uploadAll([{ buffer: Buffer.from('good') }, { buffer: Buffer.from('bad') }], 'items')
  ).rejects.toThrow('Upload rejected');
  expect(destroy).toHaveBeenCalledWith('uploaded-item');
});

test('removes every image by its Cloudinary public ID', async () => {
  const destroy = jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });

  await images.removeAll(['first-id', 'second-id']);

  expect(destroy).toHaveBeenCalledTimes(2);
  expect(destroy).toHaveBeenNthCalledWith(1, 'first-id');
  expect(destroy).toHaveBeenNthCalledWith(2, 'second-id');
});
