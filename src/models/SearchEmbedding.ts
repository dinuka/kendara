import mongoose, { Document, Model, Schema } from "mongoose";

export interface ISearchEmbedding extends Document {
    id: string;
    horoscope: { id: string };
    embedding: number[];
    textContent: string;
    language: "si" | "en";
    chunkIndex: number;
    embeddingModel: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const SearchEmbeddingSchema = new Schema<ISearchEmbedding>(
    {
        horoscope: {
            id: { type: String, required: true },
        },
        embedding: { type: [Number], required: true },
        textContent: { type: String, required: true },
        language: { type: String, enum: ["si", "en"], required: true },
        chunkIndex: { type: Number, default: 0 },
        embeddingModel: { type: String, default: "all-MiniLM-L6-v2" },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
);

SearchEmbeddingSchema.index({ "horoscope.id": 1, language: 1 });
SearchEmbeddingSchema.index({ isActive: 1 });

export const SearchEmbedding: Model<ISearchEmbedding> =
    mongoose.models.SearchEmbedding || mongoose.model<ISearchEmbedding>("SearchEmbedding", SearchEmbeddingSchema);
