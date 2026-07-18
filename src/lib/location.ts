import { v4 as uuidv4 } from "uuid";

import { ILocation, Location } from "@/models/Location";

import { connectDB } from "@/lib/db";
import logger from "@/lib/logger";

interface ListResult {
    locations: ILocation[];
    total: number;
    page: number;
    totalPages: number;
}

interface CreateData {
    name: string;
    latitude: number;
    longitude: number;
    isPublic?: boolean;
}

interface UpdateData {
    name?: string;
    latitude?: number;
    longitude?: number;
    isPublic?: boolean;
}

export async function listLocations(
    userId: string,
    role?: string,
    page: number = 1,
    limit: number = 20,
    search?: string,
): Promise<ListResult> {
    await connectDB();

    const filter: Record<string, unknown> =
        role === "super-admin"
            ? {}
            : {
                  $or: [{ isPublic: true }, { "createdBy.id": userId }],
              };

    if (search && search.trim()) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.name = { $regex: escaped, $options: "i" };
    }

    const total = await Location.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const skip = (safePage - 1) * limit;

    const locations = await Location.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean();

    logger.debug("locations listed: page %d, %d results for user %s", safePage, locations.length, userId);

    return { locations: locations as unknown as ILocation[], total, page: safePage, totalPages };
}

export async function getLocation(id: string, userId: string, role?: string): Promise<ILocation | null> {
    await connectDB();

    const location = await Location.findOne({ id }).lean();
    if (!location) return null;

    if (!location.isPublic && location.createdBy.id !== userId && role !== "super-admin") {
        return null;
    }

    return location as unknown as ILocation;
}

export async function createLocation(data: CreateData, userId: string): Promise<ILocation> {
    await connectDB();

    const location = await Location.create({
        id: uuidv4(),
        name: data.name.trim(),
        latitude: data.latitude,
        longitude: data.longitude,
        isPublic: data.isPublic ?? false,
        createdBy: { id: userId },
    });

    logger.info("location created: %s by user %s", location.id, userId);

    return location;
}

export async function updateLocation(
    id: string,
    data: UpdateData,
    userId: string,
    role?: string,
): Promise<ILocation | null> {
    await connectDB();

    const location = await Location.findOne({ id });
    if (!location) return null;

    if (location.createdBy.id !== userId && role !== "super-admin") {
        return null;
    }

    if (data.name !== undefined) location.name = data.name.trim();
    if (data.latitude !== undefined) location.latitude = data.latitude;
    if (data.longitude !== undefined) location.longitude = data.longitude;
    if (data.isPublic !== undefined) location.isPublic = data.isPublic;

    await location.save();

    logger.info("location updated: %s by user %s", id, userId);

    return location;
}

export async function deleteLocation(
    id: string,
    userId: string,
    role?: string,
): Promise<{ success: boolean; error?: string }> {
    await connectDB();

    const location = await Location.findOne({ id });
    if (!location) return { success: false, error: "Location not found" };

    if (role === "super-admin") {
        if (!location.isPublic) {
            logger.warn("admin location delete denied for private location: %s by user %s", id, userId);
            return {
                success: false,
                error: "Cannot delete a private location owned by another user",
            };
        }
    } else if (location.createdBy.id !== userId) {
        logger.warn("location delete denied: %s by user %s", id, userId);
        return { success: false, error: "Only the creator can delete this location" };
    }

    await Location.deleteOne({ id });

    logger.info("location deleted: %s by user %s", id, userId);

    return { success: true };
}

export function validateCoordinate(lat: number, lon: number): { valid: boolean; error?: string } {
    if (lat < -90 || lat > 90) {
        return { valid: false, error: "Latitude must be between -90 and 90" };
    }
    if (lon < -180 || lon > 180) {
        return { valid: false, error: "Longitude must be between -180 and 180" };
    }
    return { valid: true };
}
