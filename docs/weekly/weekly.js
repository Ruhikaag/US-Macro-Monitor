"use strict";
const localReview = location.hostname === "127.0.0.1" || location.hostname === "localhost";
let reviewToken = "";
let publishedIssues = [];
const byId = id => document.getElementById(id);
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function asset(issue, file) {
  return localReview ? `/api/weekly/files/${issue.id}/${file}` : `files/${issue.id}/${file}`;
}
function download(label, url, filename) {
  const link = element("a", label);
  link.href = url;
  link.download = filename;
  return link;
}
function issueDate(issue) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${issue.date}T00:00:00Z`));
}
function openChart(issue, chart, trigger) {
  const image = byId("chart-large");
  byId("chart-large-title").textContent = chart.title.replace(/^Figure\s+\d+[.:]\s*/i, "");
  image.alt = chart.title;
  image.src = `${asset(issue, chart.preview || chart.download || chart.file)}?v=20261104-sharp`;
  byId("chart-preview-status").hidden = true;
  const link = byId("chart-large-download");
  link.href = asset(issue, chart.download || chart.file);
  link.download = `${issue.date}-${chart.download || chart.file}`;
  const dialog = byId("chart-dialog");
  dialog.onclose = () => { if (trigger.isConnected) trigger.focus({ preventScroll: true }); };
  dialog.showModal();
}
byId("close-chart").addEventListener("click", () => byId("chart-dialog").close());
byId("chart-large").addEventListener("error", () => {
  byId("chart-preview-status").textContent = "Could not load the enlarged chart. Try the PNG download.";
  byId("chart-preview-status").hidden = false;
});
function chartCard(issue, chart, selectable = false) {
  const card = element("figure", "", "chart");
  const image = element("img");
  image.src = `${asset(issue, chart.file)}?v=20261104-clean`;
  image.alt = chart.title;
  image.loading = "lazy";
  const expand = element("button", "", "chart-expand");
  expand.type = "button";
  expand.setAttribute("aria-label", `Enlarge chart: ${chart.title}`);
  expand.setAttribute("aria-haspopup", "dialog");
  expand.title = "View chart";
  expand.append(image, element("span", "View chart", "chart-view-label"));
  expand.addEventListener("click", () => openChart(issue, chart, expand));
  card.append(expand, element("figcaption", chart.title.replace(/^Figure\s+\d+[.:]\s*/i, "")),
    download("Download PNG", asset(issue, chart.download || chart.file), `${issue.date}-${chart.download || chart.file}`));
  if (selectable) {
    const label = element("label", " Include this chart");
    const check = element("input");
    check.type = "checkbox"; check.value = chart.file; check.checked = true;
    label.prepend(check); card.append(label);
  }
  return card;
}
function showIssue(issue) {
  byId("latest").hidden = false;
  byId("issue-heading").textContent = issue.id === publishedIssues[0]?.id ? "Latest issue" : "Selected archive issue";
  const details = byId("latest-details");
  const date = issueDate(issue);
  details.replaceChildren(element("h3", date),
    download("Download PDF", asset(issue, "update.pdf"), `${issue.date}-US-Economic-Update.pdf`));
  byId("pdf").replaceChildren(...(issue.pages || []).map((file, index) => {
    const image = element("img");
    image.src = `${asset(issue, file)}?v=original-white-20261104`;
    image.alt = `US Economic Update, ${date}, page ${index + 1}`;
    image.loading = index ? "lazy" : "eager";
    image.addEventListener("error", () => {
      byId("status").textContent = "Could not load a preview page. The original PDF is available via Download PDF.";
      byId("status").classList.add("error");
    });
    const wrapper = element("div", "", "pdf-page");
    wrapper.append(image);
    for (const link of issue.page_links?.[index] || []) {
      if (!/^(https?:\/\/|mailto:)/i.test(link.href) || !Array.isArray(link.rect) ||
          link.rect.length !== 4 || !link.rect.every(Number.isFinite)) continue;
      const anchor = element("a", "", "pdf-link");
      anchor.href = link.href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.setAttribute("aria-label", `Open PDF link: ${link.href}`);
      anchor.title = link.href;
      ["left", "top", "width", "height"].forEach((property, i) => {
        anchor.style[property] = `${link.rect[i]}%`;
      });
      wrapper.append(anchor);
    }
    return wrapper;
  }));
  byId("pdf").scrollTop = 0;
  if (!issue.pages?.length) byId("pdf").append(element("p", "Preview is not available. Download the original PDF above."));
  byId("charts").replaceChildren(...issue.charts.map(chart => chartCard(issue, chart)));
  if (!issue.charts.length) byId("charts").append(element("p", "No separate chart downloads for this issue."));
}
function renderArchive() {
  const filter = byId("indicator").value;
  const issues = publishedIssues.slice(1).filter(issue => !filter || issue.indicators.includes(filter));
  byId("archive-list").replaceChildren(...issues.map(issue => {
    const card = element("article", "", "issue");
    const date = issueDate(issue);
    const view = element("button", `US Economic Update — ${date}`, "issue-title");
    view.addEventListener("click", () => { showIssue(issue); byId("latest").scrollIntoView(); });
    const actions = element("div", "", "actions");
    actions.append(download("Download PDF", asset(issue, "update.pdf"), `${issue.date}-update.pdf`));
    card.append(view, element("p", issue.indicators.join(" · "), "tags"), actions);
    return card;
  }));
  if (!issues.length) byId("archive-list").append(element("p", "No previous approved issues match."));
}
function draftCard(issue) {
  const card = element("details", "", "draft");
  card.append(element("summary", `${issue.date || "Date unknown"} — ${issue.filename}`),
    element("p", issue.warning, "warning"));
  if (issue.status === "error") return card;
  const original = element("a", "Open original PDF for review");
  original.href = asset(issue, "update.pdf"); original.target = "_blank"; original.rel = "noopener";
  card.append(original);
  const dateLabel = element("label", "Publication date");
  const day = element("input"); day.type = "date"; day.required = true; day.value = issue.date;
  dateLabel.append(day);
  const tagLabel = element("label", "Indicators covered (edit suggested tags; separate with commas)");
  const tags = element("input"); tags.type = "text"; tags.value = issue.indicators.join(", ");
  tagLabel.append(tags);
  const charts = element("div", "", "chart-strip");
  charts.append(...issue.charts.map(chart => chartCard(issue, chart, true)));
  const button = element("button", "Approve and publish PDF, tags, and selected charts");
  const message = element("p");
  message.setAttribute("role", "status");
  button.addEventListener("click", async () => {
    if (!day.reportValidity()) return;
    if (!confirm("Publish this PDF and selected charts to the public website?")) return;
    button.disabled = true; message.textContent = "Publishing approved issue...";
    try {
      const response = await fetch(`/api/weekly/approve/${issue.id}`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Weekly-Token": reviewToken },
        body: JSON.stringify({ date: day.value, indicators: tags.value.split(",").map(x => x.trim()).filter(Boolean),
          charts: [...charts.querySelectorAll("input:checked")].map(x => x.value) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Publication failed (${response.status})`);
      message.textContent = "Published to GitHub. The public website may take a few minutes to update.";
      button.textContent = "Published"; issue.status = "published";
    } catch (error) {
      message.textContent = error.message; button.disabled = false;
    }
  });
  card.append(dateLabel, tagLabel, charts, button, message);
  return card;
}
async function loadWeekly() {
  try {
    const response = await fetch(localReview ? "/api/weekly" : `issues.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load weekly updates (${response.status}).`);
    const result = await response.json();
    publishedIssues = result.issues.filter(issue => !localReview || issue.status === "published")
      .sort((a, b) => b.date.localeCompare(a.date));
    if (publishedIssues.length) showIssue(publishedIssues[0]);
    byId("status").textContent = result.error || (publishedIssues.length
      ? "" : "No approved weekly updates have been published yet.");
    byId("status").classList.toggle("error", Boolean(result.error));
    const options = [...new Set(publishedIssues.flatMap(issue => issue.indicators))].sort();
    const all = element("option", "All indicators"); all.value = "";
    byId("indicator").replaceChildren(all);
    byId("indicator").append(...options.map(tag => {
      const option = element("option", tag); option.value = tag; return option;
    }));
    byId("indicator").addEventListener("change", renderArchive);
    renderArchive();
    if (localReview) {
      reviewToken = result.token; byId("review").hidden = false;
      const drafts = result.issues.filter(issue => issue.status !== "published");
      byId("drafts").replaceChildren(...drafts.map(draftCard));
      if (!drafts.length) byId("drafts").append(element("p", "No drafts yet. Intake checks the folder every minute; refresh this page to see newly prepared issues."));
    }
  } catch (error) {
    byId("status").textContent = error.message;
    byId("status").classList.add("error");
  }
}
loadWeekly();
