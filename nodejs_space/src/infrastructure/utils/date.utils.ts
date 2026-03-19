/**
 * Formats a date for the TickTick API.
 * Always sets time to 23:59:00 in Kyiv timezone (UTC+2).
 */
export function formatTickTickDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T23:59:00+0200`;
}
