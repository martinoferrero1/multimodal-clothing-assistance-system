import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eventDateInput,
  parseEventDate,
  validEventDates,
} from "../src/core/dates";

test("local event dates round trip without shifting wall-clock time", () => {
  const input = "10/11/2026 18:30";
  assert.equal(eventDateInput(parseEventDate(input)), input);
  assert.equal(parseEventDate(""), null);
});
test("invalid calendar dates and reversed event intervals are rejected", () => {
  assert.throws(() => parseEventDate("31/02/2026 18:30"));
  assert.throws(() => parseEventDate("10/11/2026 25:30"));
  assert.equal(validEventDates("10/11/2026 18:30", "10/11/2026 17:30"), false);
  assert.equal(validEventDates("10/11/2026 18:30", "11/11/2026 17:30"), true);
  assert.equal(validEventDates("", "11/11/2026 17:30"), false);
});
