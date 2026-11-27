import { QdrantClient } from "@qdrant/js-client-rest";

import logger from "@/lib/logger";

const COLLECTION_NAME = "horoscopes";
const VECTOR_SIZE = 384;
const DISTANCE = "Cosine";

interface QdrantPointPayload {
    horoscopeId: string;
    ownerId: string;
    isPublic: boolean;
    language: "si" | "en";
    [key: string]: unknown;
}

let client: QdrantClient | null = null;
let collectionInitialized = false;

export const getQdrantUrl = (): string | null => {
    const url = process.env.QDRANT_URL;
    if (!url) {
        logger.warn("QDRANT_URL not set, Qdrant features disabled");
        return null;
    }
    return url;
};

export const getQdrantClient = (): QdrantClient | null => {
    const url = getQdrantUrl();
    if (!url) return null;

    if (!client) {
        client = new QdrantClient({ url });
        logger.info("Qdrant client initialized: %s", url);
    }
    return client;
};

export const ensureCollection = async (): Promise<boolean> => {
    if (collectionInitialized) return true;

    const c = getQdrantClient();
    if (!c) return false;

    try {
        const collections = await c.getCollections();
        const exists = collections.collections.some((col) => col.name === COLLECTION_NAME);

        if (!exists) {
            await c.createCollection(COLLECTION_NAME, {
                vectors: {
                    size: VECTOR_SIZE,
                    distance: DISTANCE,
                },
                hnsw_config: {
                    ef_construct: 100,
                    m: 16,
                },
            });
            logger.info("Qdrant collection created: %s", COLLECTION_NAME);
        }

        try {
            await c.createPayloadIndex(COLLECTION_NAME, {
                field_name: "horoscopeId",
                field_schema: "keyword",
            });
            await c.createPayloadIndex(COLLECTION_NAME, {
                field_name: "ownerId",
                field_schema: "keyword",
            });
            await c.createPayloadIndex(COLLECTION_NAME, {
                field_name: "isPublic",
                field_schema: "bool",
            });
            await c.createPayloadIndex(COLLECTION_NAME, {
                field_name: "language",
                field_schema: "keyword",
            });
            logger.info("Qdrant payload indexes created/verified");
        } catch {
            logger.debug("Qdrant payload indexes may already exist");
        }

        collectionInitialized = true;
        return true;
    } catch (err) {
        logger.error("Failed to initialize Qdrant collection: %s", err);
        return false;
    }
};

export const upsertPoint = async (
    horoscopeId: string,
    ownerId: string,
    isPublic: boolean,
    language: "si" | "en",
    embedding: number[],
): Promise<boolean> => {
    const c = getQdrantClient();
    if (!c) return false;

    try {
        const pointId = `${horoscopeId}_${language}`;
        const payload: QdrantPointPayload = {
            horoscopeId,
            ownerId,
            isPublic,
            language,
        };

        await c.upsert(COLLECTION_NAME, {
            points: [
                {
                    id: pointId,
                    vector: embedding,
                    payload,
                },
            ],
            wait: true,
        });

        logger.debug("Qdrant point upserted: horoscopeId=%s language=%s", horoscopeId, language);
        return true;
    } catch (err) {
        logger.error("Failed to upsert Qdrant point for horoscope %s: %s", horoscopeId, err);
        return false;
    }
};

export const deletePoints = async (horoscopeId: string): Promise<boolean> => {
    const c = getQdrantClient();
    if (!c) return false;

    try {
        const filter = {
            must: [{ key: "horoscopeId", match: { value: horoscopeId } }],
        };

        await c.delete(COLLECTION_NAME, {
            filter,
            wait: true,
        });

        logger.debug("Qdrant points deleted for horoscopeId=%s", horoscopeId);
        return true;
    } catch (err) {
        logger.error("Failed to delete Qdrant points for horoscope %s: %s", horoscopeId, err);
        return false;
    }
};

interface QdrantSearchResult {
    horoscopeId: string;
    language: "si" | "en";
    score: number;
}

export const searchPoints = async (
    queryEmbedding: number[],
    userId: string,
    limit: number = 100,
): Promise<QdrantSearchResult[]> => {
    const c = getQdrantClient();
    if (!c) return [];

    try {
        const filter = {
            should: [
                { key: "ownerId", match: { value: userId } },
                { key: "isPublic", match: { value: true } },
            ],
        };

        const result = await c.search(COLLECTION_NAME, {
            vector: queryEmbedding,
            filter,
            limit,
            with_payload: true,
        });

        return result.map((r) => ({
            horoscopeId: (r.payload as QdrantPointPayload).horoscopeId,
            language: (r.payload as QdrantPointPayload).language,
            score: r.score || 0,
        }));
    } catch (err) {
        logger.error("Qdrant search failed: %s", err);
        return [];
    }
};

export const isQdrantAvailable = async (): Promise<boolean> => {
    const c = getQdrantClient();
    if (!c) return false;

    try {
        await c.getCollections();
        return true;
    } catch {
        return false;
    }
};
