import ImageKit, { toFile } from "@imagekit/nodejs";

// Server-only — the private key must never reach the browser. Call this
// from Server Actions, passing along a File pulled out of a FormData
// upload (e.g. from an <input type="file">). Requires IMAGEKIT_PRIVATE_KEY
// (from the ImageKit dashboard's Developer > API Keys page) as a server
// env var.

let client: ImageKit | null = null;

function getClient(): ImageKit {
  if (!client) {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("ImageKit isn't configured — set IMAGEKIT_PRIVATE_KEY.");
    }
    client = new ImageKit({ privateKey });
  }
  return client;
}

/** Uploads a single file under `folder` and returns its public CDN URL. */
export async function uploadImageToImageKit(file: File, folder: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const response = await getClient().files.upload({
    file: await toFile(buffer, file.name || `image-${Date.now()}`),
    fileName: file.name || `image-${Date.now()}`,
    folder,
  });
  if (!response.url) throw new Error("ImageKit upload succeeded but returned no URL.");
  return response.url;
}
