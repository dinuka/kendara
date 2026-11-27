export interface OrbSettings {
    [key: string]: number;
}

export interface PlanetAspectEntry {
    houses: number[];
    degrees: number[];
}

export type PlanetAspectsSettings = Record<string, PlanetAspectEntry>;

export interface RashiAspectOverride {
    enabled?: boolean;
    targets?: Record<string, boolean>;
}

export interface RashiAspectsSettings {
    enabled: boolean;
    overrides?: Record<string, RashiAspectOverride>;
}

export interface RecalcStatus {
    status?: "idle" | "running" | "completed" | "failed";
    settingsVersion?: number;
    startedAt?: string;
    finishedAt?: string;
    total?: number;
    processed?: number;
    succeeded?: number;
    failed?: number;
    failedHoroscopeIds?: string[];
    error?: string;
}

export interface AuditChange {
    planetaryOrbs?: { from: unknown; to: unknown };
    planetAspects?: { from: unknown; to: unknown };
    rashiAspects?: { from: unknown; to: unknown };
}

export interface AuditEntry {
    id: string;
    version: number;
    changedBy: { id: string; name?: string };
    changedAt: string;
    changes: AuditChange;
}

export interface RecalcRunEntry {
    id: string;
    settingsVersion: number;
    triggeredBy: { id: string; name?: string };
    startedAt: string;
    finishedAt?: string;
    total: number;
    succeeded: number;
    failed: number;
    failedHoroscopeIds?: string[];
}

export interface AdminSettingsDoc {
    planetaryOrbs?: OrbSettings;
    planetAspects?: PlanetAspectsSettings;
    rashiAspects?: RashiAspectsSettings;
    version?: number;
    updatedBy?: { id: string; name?: string };
    updatedAt?: string;
    lastRecalculatedAt?: string;
    recalcStatus?: RecalcStatus;
    auditLog?: AuditEntry[];
    recalcHistory?: RecalcRunEntry[];
}

export interface SettingsValues {
    planetaryOrbs: OrbSettings;
    planetAspects: PlanetAspectsSettings;
    rashiAspects: RashiAspectsSettings;
}
