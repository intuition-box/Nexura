import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AWS_REGION, AWS_SECRET_ACCESS_KEY, AWS_ACCESS_KEY_ID, AWS_S3_BUCKET } from "./env.utils";
import logger from "@/config/logger";
import { v7 as uuid } from "uuid";
import sharp from "sharp";

let s3: S3Client | null = null;

export function getS3Client() {
	if (!s3) {
		s3 = new S3Client({
			credentials: {
				accessKeyId: AWS_ACCESS_KEY_ID,
				secretAccessKey: AWS_SECRET_ACCESS_KEY,
			},
			region: AWS_REGION,
			// Uploads give up instead of hanging, and brief failures are retried (3 tries in all)
			maxAttempts: 3,
			requestHandler: { connectionTimeout: 5_000, requestTimeout: 30_000 },
		});
	}

	return s3;
}

export const uploadImg = async ({
  file,
  filename,
  folder,
  maxSize = 5 * (1024 ** 2) // 5 MB
}: UploadImgParams) => {
  // If AWS is not configured, return a deterministic placeholder
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET || !AWS_REGION) {
    logger.warn("[uploadImg] AWS credentials not configured — using placeholder image");
    return `https://placehold.co/256x256/7c3aed/ffffff?text=${encodeURIComponent(folder)}`;
  }
  try {
    // Stored as JPEG: transparent areas (logos) become white, not black
    const image = sharp(file).flatten({ background: "#ffffff" });

    let quality = 80;

    let buffer = await image.jpeg({ quality }).toBuffer();

    while (maxSize && buffer.length > maxSize && quality > 10) {
      quality -= 10;
      buffer = await image.jpeg({ quality }).toBuffer();
    }

		const key = `${folder}/${uuid()}-${filename}`;

		await getS3Client().send(
			new PutObjectCommand({
				ACL: "public-read",
				Body: buffer,
				Bucket: AWS_S3_BUCKET,
				ContentType: "image/jpeg",
				Key: key,
			})
		);

		return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
	} catch (error: any) {
		logger.error(error);
		throw new Error(error.message);
	}
};
