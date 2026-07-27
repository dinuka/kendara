import mongoose, { Document, Model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export type AuditAction =
    | "privacy_change"
    | "admin_view_private"
    | "admin_view_list_private"
    | "share_link_created"
    | "share_link_revoked"
    | "horoscope_deleted";

export interface IAuditLog extends Document {
    id: string;
    action: AuditAction;
    actor: { id: string };
    target: { id: string; type: "horoscope" | "user" };
    details: Record<string, unknown> | Array<Record<string, unknown>> | null;
    timestamp: Date;
    ip: string | null;
    userAgent: string | null;
}

const AuditLogSchema = new Schema<IAuditLog>({
    id: {
        type: String,
        required: true,
        unique: true,
        default: (): string => uuidv4(),
    },
    action: {
        type: String,
        enum: [
            "privacy_change",
            "admin_view_private",
            "admin_view_list_private",
            "share_link_created",
            "share_link_revoked",
            "horoscope_deleted",
        ],
        required: true,
    },
    actor: {
        id: { type: String, required: true },
    },
    target: {
        id: { type: String, required: true },
        type: {
            type: String,
            enum: ["horoscope", "user"],
            required: true,
        },
    },
    details: { type: Schema.Types.Mixed, default: null },
    timestamp: { type: Date, default: Date.now },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
});

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ "actor.id": 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ "target.id": 1, "target.type": 1 });

export const AuditLog: Model<IAuditLog> =
    mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
