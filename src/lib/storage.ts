import {
    CreateBucketCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";

import logger from "@/lib/logger";

/** S3-compatible object storage (RustFS locally, any S3 API in production). */
const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || "us-east-1",
    // RustFS/MinIO serve buckets as http://host/bucket/key, not bucket.host
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials:
        process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
            ? { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY }
            : undefined,
});

const BUCKET = process.env.S3_BUCKET || "kendara";

let bucketReady: Promise<void> | null = null;

/** Creates the bucket on first use if it doesn't exist yet. */
const ensureBucket = (): Promise<void> => {
    bucketReady ??= (async () => {
        try {
            await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
        } catch {
            logger.info("creating storage bucket %s", BUCKET);
            await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
        }
    })().catch((err) => {
        bucketReady = null;
        throw err;
    });
    return bucketReady;
};

export const putObject = async (key: string, body: Buffer | string, contentType: string): Promise<void> => {
    await ensureBucket();
    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: body,
            ContentType: contentType,
            // keys are never reused (they carry a timestamp), so objects are safe to cache forever
            CacheControl: "public, max-age=31536000, immutable",
        }),
    );
};

/** Returns the object bytes, or null when the key doesn't exist. */
export const getObject = async (key: string): Promise<Buffer | null> => {
    try {
        const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
        if (!res.Body) return null;
        return Buffer.from(await res.Body.transformToByteArray());
    } catch (err) {
        if ((err as { name?: string }).name === "NoSuchKey") return null;
        throw err;
    }
};

export const deleteObjects = async (keys: string[]): Promise<void> => {
    if (keys.length === 0) return;
    for (let i = 0; i < keys.length; i += 1000) {
        await s3.send(
            new DeleteObjectsCommand({
                Bucket: BUCKET,
                Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
            }),
        );
    }
};
