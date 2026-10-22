// Purchases can be re-downloaded for life. To stop a link being shared around, each purchased item is
// throttled to this many downloads per hour (app/api/downloads/[token]/route.js) instead of a lifetime cap.
export const DOWNLOADS_PER_HOUR = 10;
