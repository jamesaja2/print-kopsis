export function isMissingTableError(error: unknown) {
    if (!error || typeof error !== "object") return false;
    const maybe = error as { code?: string; message?: string };
    if (maybe.code === "P2021") return true;
    return typeof maybe.message === "string" && maybe.message.includes("does not exist in the current database");
}
