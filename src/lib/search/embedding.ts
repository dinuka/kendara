import logger from "@/lib/logger";

let pipelineFn: ((task: string, model: string) => Promise<unknown>) | null = null;
let embedFn: ((texts: string[]) => Promise<number[][]>) | null = null;
let pipelineLoaded = false;

const MODEL = "Xenova/all-MiniLM-L6-v2";

type TransformersPipeline = (texts: string[]) => Promise<{ data: number[][] | Float32Array[] }>;

const loadPipeline = async (): Promise<boolean> => {
    if (pipelineLoaded && embedFn) return true;

    try {
        const { pipeline } = await import("@xenova/transformers");
        const pipe = (await pipeline("feature-extraction", MODEL)) as TransformersPipeline;

        embedFn = async (texts: string[]): Promise<number[][]> => {
            const result = await pipe(texts);
            const data = result.data;

            if (Array.isArray(data)) {
                return data.map((row) => {
                    if (Array.isArray(row)) return row;
                    if (row && typeof row === "object" && "length" in row) {
                        return Array.from(row as unknown as Float32Array);
                    }
                    return [row] as unknown as number[];
                }) as unknown as number[][];
            }

            if (data && typeof data === "object" && "length" in data) {
                const flat = Array.from(data as unknown as Float32Array);
                const dim = 384;
                const rows: number[][] = [];
                for (let i = 0; i < flat.length; i += dim) {
                    rows.push(flat.slice(i, i + dim));
                }
                return rows;
            }

            return [];
        };

        pipelineLoaded = true;
        logger.info("Transformers.js pipeline loaded: %s", MODEL);
        return true;
    } catch (err) {
        logger.error("Failed to load Transformers.js pipeline: %s", err);
        pipelineFn = null;
        embedFn = null;
        pipelineLoaded = false;
        return false;
    }
};

export const generateEmbedding = async (text: string): Promise<number[] | null> => {
    const loaded = await loadPipeline();
    if (!loaded || !embedFn) {
        logger.warn("Embedding pipeline not available");
        return null;
    }

    try {
        const results = await embedFn([text]);
        if (results.length > 0) {
            return results[0];
        }
        return null;
    } catch (err) {
        logger.error("Embedding generation failed: %s", err);
        return null;
    }
};

export const generateEmbeddings = async (texts: string[]): Promise<(number[] | null)[]> => {
    const loaded = await loadPipeline();
    if (!loaded || !embedFn) {
        logger.warn("Embedding pipeline not available");
        return texts.map(() => null);
    }

    try {
        const results = await embedFn(texts);
        return texts.map((_, i) => results[i] || null);
    } catch (err) {
        logger.error("Batch embedding generation failed: %s", err);
        return texts.map(() => null);
    }
};

export const isEmbeddingAvailable = async (): Promise<boolean> => {
    return await loadPipeline();
};
