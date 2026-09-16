"use client";

import { useCallback, useRef } from "react";

function parseLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a valid publication date");
  return match.slice(1).map(Number) as [number, number, number, number, number];
}

export function localDateTimeAndOffsetToIso(value: string, offsetMinutes: number) {
  const [year, month, day, hour, minute] = parseLocalDateTime(value);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) + offsetMinutes * 60_000)
    .toISOString();
}

function localDateTimeToIso(value: string) {
  const [year, month, day, hour, minute] = parseLocalDateTime(value);
  const localDate = new Date(year, month - 1, day, hour, minute);
  return localDateTimeAndOffsetToIso(value, localDate.getTimezoneOffset());
}

function formatLocalDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PublishedAtInput({ defaultNow = true }: { defaultNow?: boolean }) {
  const instantInput = useRef<HTMLInputElement>(null);
  const initializeLocalInput = useCallback((input: HTMLInputElement | null) => {
    if (!input || !defaultNow || input.value) return;
    input.value = formatLocalDateTime(new Date());
    if (instantInput.current) instantInput.current.value = localDateTimeToIso(input.value);
  }, [defaultNow]);

  return (
    <>
      <input ref={instantInput} type="hidden" name="published_at" defaultValue="" />
      <label htmlFor="published-at-local">
        Published at
        <input
          id="published-at-local"
          ref={initializeLocalInput}
          type="datetime-local"
          name="published_at_local"
          required
          defaultValue=""
          onChange={(event) => {
            if (instantInput.current) {
              instantInput.current.value = event.currentTarget.value
                ? localDateTimeToIso(event.currentTarget.value)
                : "";
            }
          }}
        />
      </label>
    </>
  );
}
