import { randomUUID } from 'node:crypto';
import { Storage } from '@google-cloud/storage';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function createFirebaseImageUploader(bucketName: string) {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  return async ({
    buffer,
    contentType,
  }: {
    buffer: Buffer;
    contentType: string;
  }): Promise<string> => {
    const objectName = `offer-images/${randomUUID()}.${EXTENSIONS[contentType]}`;
    const downloadToken = randomUUID();
    await bucket.file(objectName).save(buffer, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });

    const url = new URL(
      `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectName)}`,
    );
    url.searchParams.set('alt', 'media');
    url.searchParams.set('token', downloadToken);
    return url.toString();
  };
}