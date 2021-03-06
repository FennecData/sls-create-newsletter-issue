import { mapLimit } from 'async';
import { createHash } from 'crypto';
import { parse } from 'url';

const uploadImage = (client, imageUrl, publicId, hostname, stopRetry) =>
  new Promise((resolve, reject) => {
    const upload = client.uploader.upload(imageUrl, (result) => {
      if (result.error) {
        if (stopRetry || (result.error.code !== 'ENOENT' && result.error.http_code !== 404)) {
          return reject(result.error);
        }

        const fallbackImageUrl = `https://placeholdit.imgix.net/~text?txtsize=60&bg=ffd300&txtclr=0000000%26text%3Dblog&txt=${encodeURIComponent(hostname)}&w=500&h=240`;
        return resolve(uploadImage(client, fallbackImageUrl, publicId, hostname, true));
      }
      return resolve(result);
    }, { public_id: publicId, overwrite: false });
    // ignore errors (managed internally)
    upload.catch(() => {});
  })
;

const uploadImageToCloudinary = (client, folder) => (urlInfo, cb) => {
  const publicId = `${folder}/${createHash('md5').update(urlInfo.image).digest('hex')}`;
  const { hostname } = parse(urlInfo.url);
  uploadImage(client, urlInfo.image, publicId, hostname)
  .then((info) => {
    const transformations = {
      crop: 'fit',
      width: 500,
      height: 240,
      gravity: 'center',
      quality: 80,
      format: 'jpg',
    };
    const image = client.url(info.public_id, transformations);

    return cb(null, { ...urlInfo, image, originalImage: urlInfo.image });
  })
  .catch(err => cb(err));
};

export const uploadImagesToCloudinary = (client, folder) => urlsInfo =>
  new Promise((resolve, reject) => {
    const limit = 7;
    const upload = uploadImageToCloudinary(client, folder);
    mapLimit(urlsInfo, limit, upload, (err, urlsInfoWithUploadLinks) => {
      if (err) {
        return reject(err);
      }

      return resolve(urlsInfoWithUploadLinks);
    });
  },
);

export default { uploadImagesToCloudinary };
