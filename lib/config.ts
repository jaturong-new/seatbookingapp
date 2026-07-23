// Master switch to temporarily pause the self-service seat booking feature (book/release/clear)
// without touching viewing (floor map, my-seat, schedule). Set BOOKING_ENABLED=false to pause.
export const BOOKING_ENABLED = process.env.BOOKING_ENABLED !== "false";
