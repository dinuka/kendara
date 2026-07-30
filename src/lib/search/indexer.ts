import { CalculatedDetails } from "@/models/CalculatedDetails";
import { Horoscope } from "@/models/Horoscope";
import { SearchEmbedding } from "@/models/SearchEmbedding";

import logger from "@/lib/logger";

import { generateEmbedding } from "./embedding";
import { ensureCollection, upsertPoint } from "./qdrant";
import { getTextForBothLanguages } from "./textContent";

export const indexHoroscope = async (horoscopeId: string): Promise<boolean> => {
    logger.info("indexing horoscope: %s", horoscopeId);

    try {
        const horoscope = await Horoscope.findOne({ id: horoscopeId }).lean();
        if (!horoscope) {
            logger.warn("horoscope not found for indexing: %s", horoscopeId);
            return false;
        }

        const calculated = await CalculatedDetails.findOne({
            "horoscope.id": horoscopeId,
        }).lean();
        if (!calculated) {
            logger.warn("calculated details not found for horoscope: %s", horoscopeId);
            return false;
        }

        const texts = getTextForBothLanguages(calculated);

        const qdrantReady = await ensureCollection();

        for (const [lang, text] of Object.entries(texts) as ["si" | "en", string][]) {
            const existing = await SearchEmbedding.findOne({
                "horoscope.id": horoscopeId,
                language: lang,
            }).lean();

            const embedding = await generateEmbedding(text);
            if (!embedding) {
                logger.warn("embedding generation failed for %s %s, saving text only", horoscopeId, lang);
                if (existing) {
                    await SearchEmbedding.updateOne(
                        { _id: existing._id },
                        {
                            $set: {
                                textContent: text,
                                isActive: horoscope.isPublic,
                            },
                        },
                    );
                } else {
                    await SearchEmbedding.create({
                        horoscope: { id: horoscopeId },
                        embedding: [],
                        textContent: text,
                        language: lang,
                        chunkIndex: 0,
                        embeddingModel: "all-MiniLM-L6-v2",
                        isActive: horoscope.isPublic,
                    });
                }
                continue;
            }

            if (existing) {
                await SearchEmbedding.updateOne(
                    { _id: existing._id },
                    {
                        $set: {
                            embedding,
                            textContent: text,
                            isActive: horoscope.isPublic,
                        },
                    },
                );
            } else {
                await SearchEmbedding.create({
                    horoscope: { id: horoscopeId },
                    embedding,
                    textContent: text,
                    language: lang,
                    chunkIndex: 0,
                    embeddingModel: "all-MiniLM-L6-v2",
                    isActive: horoscope.isPublic,
                });
            }

            if (qdrantReady) {
                await upsertPoint(horoscopeId, horoscope.owner.id, horoscope.isPublic, lang, embedding);
            }
        }

        logger.info("horoscope indexed successfully: %s", horoscopeId);
        return true;
    } catch (err) {
        logger.error("failed to index horoscope %s: %s", horoscopeId, err);
        return false;
    }
};

export const reindexHoroscope = async (horoscopeId: string): Promise<boolean> => {
    logger.info("reindexing horoscope: %s", horoscopeId);
    await SearchEmbedding.deleteMany({ "horoscope.id": horoscopeId });
    return indexHoroscope(horoscopeId);
};

export const updateHoroscopeVisibility = async (horoscopeId: string, isPublic: boolean): Promise<boolean> => {
    logger.info("updating visibility for horoscope: %s isPublic=%s", horoscopeId, isPublic);

    try {
        await SearchEmbedding.updateMany({ "horoscope.id": horoscopeId }, { $set: { isActive: isPublic } });

        const embeddings = await SearchEmbedding.find({
            "horoscope.id": horoscopeId,
        }).lean();

        const qdrantReady = await ensureCollection();

        for (const emb of embeddings) {
            if (!qdrantReady) continue;

            const pointId = `${horoscopeId}_${emb.language}`;

            if (emb.embedding.length > 0) {
                await upsertPoint(horoscopeId, "", isPublic, emb.language as "si" | "en", emb.embedding);
            }
        }

        return true;
    } catch (err) {
        logger.error("failed to update visibility for horoscope %s: %s", horoscopeId, err);
        return false;
    }
};
