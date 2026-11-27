import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** Copies every object from a source S3-compatible store (e.g. local RustFS) into the target
 *  configured by the usual S3_* env vars (e.g. AWS S3). Keys are kept as-is, so `Chart.imageKey`
 *  values in MongoDB stay valid. Objects already present in the target are skipped, so it is safe
 *  to re-run. Source is configured with SOURCE_S3_ENDPOINT / SOURCE_S3_REGION / SOURCE_S3_BUCKET /
 *  SOURCE_S3_ACCESS_KEY / SOURCE_S3_SECRET_KEY. */

const client = (prefix: string): S3Client => {
    const endpoint = process.env[`${prefix}S3_ENDPOINT`] || undefined;
    const accessKeyId = process.env[`${prefix}S3_ACCESS_KEY`];
    const secretAccessKey = process.env[`${prefix}S3_SECRET_KEY`];
    return new S3Client({
        endpoint,
        region: process.env[`${prefix}S3_REGION`] || "us-east-1",
        forcePathStyle: !!endpoint,
        credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
};

async function migrate() {
    const source = client("SOURCE_");
    const target = client("");
    const sourceBucket = process.env.SOURCE_S3_BUCKET || "kendara";
    const targetBucket = process.env.S3_BUCKET || "kendara";

    let copied = 0;
    let skipped = 0;
    let token: string | undefined;

    do {
        const page = await source.send(
            new ListObjectsV2Command({ Bucket: sourceBucket, ContinuationToken: token }),
        );
        for (const { Key } of page.Contents ?? []) {
            if (!Key) continue;
            try {
                await target.send(new HeadObjectCommand({ Bucket: targetBucket, Key }));
                skipped++;
                continue;
            } catch {
                // not in target yet
            }
            const obj = await source.send(new GetObjectCommand({ Bucket: sourceBucket, Key }));
            await target.send(
                new PutObjectCommand({
                    Bucket: targetBucket,
                    Key,
                    Body: Buffer.from(await obj.Body!.transformToByteArray()),
                    ContentType: obj.ContentType,
                    CacheControl: obj.CacheControl ?? "public, max-age=31536000, immutable",
                }),
            );
            copied++;
            console.log("copied %s", Key);
        }
        token = page.NextContinuationToken;
    } while (token);

    console.log("done: %d copied, %d already present", copied, skipped);
}

migrate().catch((err) => {
    console.error(err);
    process.exit(1);
});
