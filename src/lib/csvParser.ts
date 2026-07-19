const CSV_PATTERN = /^\-?\d+(\.\d+)?,\-?\d+(\.\d+)?$/;

export function parseCsvCoordinate(input: string): { latitude: number; longitude: number } | Error {
    const trimmed = input.trim();

    if (!CSV_PATTERN.test(trimmed)) {
        return new Error("Invalid CSV format. Expected 'latitude,longitude' (e.g., 6.9271,79.8612)");
    }

    const parts = trimmed.split(",");
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);

    if (lat < -90 || lat > 90) {
        return new Error("Latitude must be between -90 and 90");
    }
    if (lon < -180 || lon > 180) {
        return new Error("Longitude must be between -180 and 180");
    }

    return { latitude: lat, longitude: lon };
}
