import ImageKit from "imagekit";
import dbConnect from "@app/_database/db";
(async function initializeDB() {
  await dbConnect();
})();

// Initialize ImageKit
export async function initializeImageKit() {
  const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY as string,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY as string,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT as string,
  });

  if (!process.env.IMAGEKIT_PRIVATE_KEY) {
    console.error("Missing ImageKit private key");
  }

  return imagekit;
}

// Upload to ImageKit
export async function uploadToImageKit(file: Buffer, folder: string, fileName: string): Promise<string> {
  const imagekit = await initializeImageKit();
  try {
    const response = await imagekit.upload({
      file,
      fileName: fileName,
      folder: `/${folder}`,
    });
    return response.url;
  } catch (err: any) {
    console.error(`Error uploading ${fileName}:`, err.message || err);
    throw new Error(`Failed to upload ${fileName}`);
  }
}

// Upload Single File
export const uploadSingleFile = async (file: File, folder: string): Promise<{ url?: string; message?: string; error?: string }> => {
  try {
    if (!file || file.size === 0) {
      return { error: `File ${file?.name || "unknown"} is empty or missing.` };
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileExtension = file.name.split('.').pop();
    const fileName = `${folder}-${Date.now()}.${fileExtension}`;

    const url = await uploadToImageKit(fileBuffer, folder, fileName);
    return { url, message: `${file.name} uploaded successfully` };
  } catch (error: any) {
    return { error: `Error uploading ${file.name}: ${error.message}` };
  }
};
