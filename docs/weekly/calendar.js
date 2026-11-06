"use strict";
function releaseWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const part = type => Number(parts.find(p => p.type === type).value);
  const today = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(today.getUTCDate(), lastDay));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
function releaseDate(day, year = false) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}), timeZone: "UTC"
  }).format(new Date(`${day}T00:00:00Z`));
}
function renderReleaseCalendar(host, data, now = new Date()) {
  const validDay = day => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
  if (!data || !validDay(data.verified) || !validDay(data.through) || !Array.isArray(data.events) ||
      data.events.some(event => !event || !validDay(event.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.time) ||
        typeof event.title !== "string" ||
        !/^https:\/\/(?:www\.(?:bls|bea|census|federalreserve)\.gov|oui\.doleta\.gov|www\.nar\.realtor|www\.sca\.isr\.umich\.edu|www\.conference-board\.org)\//.test(event.source))) {
    throw new Error("The release calendar contains invalid schedule data.");
  }
  const { start, end } = releaseWindow(now);
  host.replaceChildren(element("h3", "Upcoming Data Releases"),
    element("p", `${releaseDate(start)} - ${releaseDate(end)} | US Eastern Time`, "calendar-range"));
  if (data.through < start) {
    host.append(element("p", "The release schedule needs updating. Check the official calendars below.", "warning"));
  } else {
    const events = data.events.filter(event => event.date >= start && event.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const labels = ["This week", "Next week", "In two weeks", "In three weeks", "In four weeks", "In five weeks"];
    for (let week = 0, cursor = new Date(`${start}T00:00:00Z`);
         cursor.toISOString().slice(0, 10) <= end; week++, cursor.setUTCDate(cursor.getUTCDate() + 7)) {
      const first = cursor.toISOString().slice(0, 10);
      const next = new Date(cursor); next.setUTCDate(next.getUTCDate() + 7);
      const last = next.toISOString().slice(0, 10);
      const details = element("details", "", "release-week");
      details.open = week === 0;
      details.append(element("summary", labels[week]));
      let day = "";
      const selected = events.filter(event => event.date >= first && event.date < last);
      for (const event of selected) {
        if (event.date !== day) {
          details.append(element("p", releaseDate(event.date), "release-day"));
          day = event.date;
        }
        const row = element("div", "", "release-event");
        const source = element("a", event.title);
        source.href = event.source; source.target = "_blank"; source.rel = "noopener noreferrer";
        const [hour, minute] = event.time.split(":").map(Number);
        row.append(element("span", `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "a.m." : "p.m."}`), source);
        details.append(row);
      }
      if (!selected.length) details.append(element("p",
        first > data.through ? "Schedule not yet verified for this week." : "No selected releases in the verified schedule."));
      host.append(details);
    }
  }
  host.append(element("p", `Selected national releases. Verified ${releaseDate(data.verified, true)}. Dates may change; this is not a live feed.`, "calendar-note"));
  const sources = element("p", "", "calendar-sources");
  for (const [label, url] of [["BLS", "https://www.bls.gov/schedule/"],
    ["BEA", "https://www.bea.gov/news/schedule"],
    ["Census", "https://www.census.gov/economic-indicators/calendar-listview-2026.html"]]) {
    const link = element("a", label); link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
    sources.append(link);
  }
  host.append(sources);
}
async function loadReleaseCalendar() {
  const host = byId("release-calendar");
  try {
    const response = await fetch("calendar.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Release calendar unavailable (HTTP ${response.status}).`);
    renderReleaseCalendar(host, await response.json());
  } catch (error) {
    host.replaceChildren(element("h3", "Upcoming Data Releases"), element("p", error.message, "warning"));
  }
  document.getElementById("open-calendar").addEventListener("click", () => {
    document.getElementById("calendar-dialog").showModal();
  });
  document.getElementById("close-calendar").addEventListener("click", () => {
    document.getElementById("calendar-dialog").close();
  });
  document.getElementById("calendar-dialog").addEventListener("close", () => {
    document.getElementById("open-calendar").focus({ preventScroll: true });
  });
}
