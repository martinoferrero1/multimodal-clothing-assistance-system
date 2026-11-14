// Event forms use the device's local time, matching the web datetime-local input.
export function eventDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseEventDate(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(
    value.trim(),
  );
  if (!match) throw new Error("Invalid event date");
  const [, day, month, year, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  )
    throw new Error("Invalid event date");
  return date.toISOString();
}

export function validEventDates(start?: string | null, end?: string | null) {
  try {
    const from = parseEventDate(start);
    const to = parseEventDate(end);
    return !to || (!!from && to > from);
  } catch {
    return false;
  }
}
