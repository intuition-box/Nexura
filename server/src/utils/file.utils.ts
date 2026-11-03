import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "./img.utils";
import { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, AWS_REGION } from "./env.utils";
import logger from "@/config/logger";
import { v7 as uuid } from "uuid";

interface UploadFileParams {
  file: Buffer;
  filename?: string;
  contentType?: string;
  folder: string;
}

export class FileTypeError extends Error {
  constructor() { super("upload a PDF, PNG, JPG or WEBP file"); }
}

const DOCUMENT_TYPES = [
  { mime: "application/pdf", ext: "pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  { mime: "image/png", ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  { mime: "image/webp", ext: "webp", magic: [0x52, 0x49, 0x46, 0x46], at8: [0x57, 0x45, 0x42, 0x50] },
];

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

export const detectDocumentType = (file: Buffer) =>
  DOCUMENT_TYPES.find(t => startsWith(file, t.magic) && (!t.at8 || startsWith(file, t.at8, 8))) ?? null;

export const uploadFile = async ({
  file,
  filename,
  contentType,
  folder,
}: UploadFileParams) => {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET || !AWS_REGION) {
    logger.warn("[uploadFile] AWS credentials not configured — using placeholder link");
    return `https://placehold.co/256x256/7c3aed/ffffff?text=${encodeURIComponent(folder)}`;
  }

  const type = detectDocumentType(file);
  if (!type) throw new FileTypeError();

  try {
    const safeName = (filename ?? "file").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.[^.]*$/, "") + "." + type.ext;
    const key = `${folder}/${uuid()}-${safeName}`;

    await getS3Client().send(
      new PutObjectCommand({
        ACL: "public-read",
        Body: file,
        Bucket: AWS_S3_BUCKET,
        ContentType: type.mime,
        ContentDisposition: `attachment; filename="${safeName}"`,
        Key: key,
      })
    );

    return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
  } catch (error: any) {
    logger.error(error);
    throw new Error(error.message);
  }
};
