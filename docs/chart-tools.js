let chartView = null;
const CHART_SERIES_COLORS = ["#00a3ad", "#86bc25", "#63666a", "#ffcd00"];
const ADDITIONAL_SERIES_SLOTS = [
  { key: "combo", indicator: "combo-indicator", options: "combo-options", measure: "combo-measure", axis: "combo-axis", type: "combo-type", color: "combo-color" },
  { key: "combo2", indicator: "combo2-indicator", options: "combo2-options", measure: "combo2-measure", axis: "combo2-axis", type: "combo2-type", color: "combo2-color", container: "combo2-slot", add: "add-combo2" },
  { key: "combo3", indicator: "combo3-indicator", options: "combo3-options", measure: "combo3-measure", axis: "combo3-axis", type: "combo3-type", color: "combo3-color", container: "combo3-slot", add: "add-combo3" },
];

function tileTitle(title) {
  const text = title.toLowerCase();
  return (text.charAt(0).toUpperCase() + text.slice(1)).replace(/\bgdp\b/gi, "GDP");
}

function searchIndicators(data, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length || !data?.indicators) return [];
  const themes = data.themes || [];
  const orderedIds = [...new Set([...themes.flatMap(theme => theme.indicator_ids), ...Object.keys(data.indicators)])];
  const seen = new Set(), results = [];
  for (const id of orderedIds) {
    const item = data.indicators[id];
    if (!item) continue;
    const memberships = themes.filter(theme => theme.indicator_ids.includes(id)).map(theme => theme.label);
    const text = [item.title, item.ticker, item.descriptor, ...memberships].join(" ").toLowerCase();
    if (!terms.every(term => text.includes(term))) continue;
    const key = `${item.ticker}|${item.frequency}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ item, themes: memberships });
  }
  return results;
}

function renderIndicatorSearch() {
  const query = $("indicator-query").value;
  const results = $("search-results"); results.replaceChildren();
  const matches = searchIndicators(snapshot, query);
  $("search-status").textContent = !query.trim() ? "Search by indicator name or theme."
    : !snapshot?.indicators || !Object.keys(snapshot.indicators).length ? "Indicator data is still loading. Please try again shortly."
      : matches.length ? `${matches.length} matching indicator${matches.length === 1 ? "" : "s"}.` : "No matching indicators.";
  for (const { item, themes } of matches) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "search-result";
    const name = document.createElement("span"); name.className = "search-result-title"; name.textContent = tileTitle(item.title);
    const context = document.createElement("span");
    context.textContent = [item.frequency, ...themes, item.error ? "Data unavailable" : item.period_label].filter(Boolean).join(" · ");
    button.append(name, context);
    button.addEventListener("click", () => { $("search-dialog").close(); openTrend(item); });
    results.append(button);
  }
}

function setupIndicatorSearch() {
  $("search").addEventListener("click", () => {
    $("indicator-query").value = "";
    renderIndicatorSearch();
    $("search-dialog").showModal();
    $("indicator-query").focus();
  });
  $("indicator-query").addEventListener("input", renderIndicatorSearch);
  $("close-search").addEventListener("click", () => $("search-dialog").close());
  $("search-dialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
}

function selectChartTab(custom) {
  $("chart-controls").hidden = !custom;
  $("chart-preview").hidden = custom;
  $("chart-tab").setAttribute("aria-selected", String(!custom));
  $("custom-tab").setAttribute("aria-selected", String(custom));
  $("chart-tab").tabIndex = custom ? -1 : 0;
  $("custom-tab").tabIndex = custom ? 0 : -1;
}

function setupChartCustomization() {
  const colorNames = ["Deloitte teal", "Deloitte green", "Deloitte grey", "Deloitte yellow"];
  const colorControl = (id, text) => {
    const label = document.createElement("label"); label.textContent = text;
    const select = document.createElement("select"); select.id = id;
    CHART_SERIES_COLORS.forEach((color, index) => {
      const option = document.createElement("option"); option.value = color; option.textContent = colorNames[index]; select.append(option);
    });
    label.append(select); return label;
  };
  $("chart-type").closest(".chart-option-row").append(colorControl("chart-color", "Original chart color "));
  $("combo-options").append(colorControl("combo-color", "Added chart color "));
  for (const slot of ADDITIONAL_SERIES_SLOTS.slice(1)) {
    const row = $("combo-indicator").closest(".chart-option-row").cloneNode(true);
    row.id = slot.container; row.hidden = true;
    for (const node of row.querySelectorAll("[id]")) node.id = node.id.replace(/^combo-/, `${slot.key}-`);
    row.querySelector("label").firstChild.textContent = slot.key === "combo2" ? "Add second indicator " : "Add third indicator ";
    row.querySelector("select").setAttribute("aria-label", slot.key === "combo2" ? "Add second indicator" : "Add third indicator");
    const button = document.createElement("button"); button.id = slot.add; button.type = "button"; button.className = "chart-export-button";
    button.textContent = slot.key === "combo2" ? "Add second indicator" : "Add third indicator"; button.hidden = slot.key === "combo3";
    $("combo-indicator").closest("fieldset").append(button, row);
  }
  $("chart-tab").addEventListener("click", () => selectChartTab(false));
  $("custom-tab").addEventListener("click", () => selectChartTab(true));
  for (const id of ["chart-axis", "chart-type", "chart-color", ...ADDITIONAL_SERIES_SLOTS.flatMap(slot => [slot.axis, slot.type, slot.color])]) {
    $(id).addEventListener("change", () => applyChartAxes());
  }
  for (const slot of ADDITIONAL_SERIES_SLOTS) {
    $(slot.indicator).addEventListener("change", () => changeComboIndicator(slot.key));
    if (slot.key !== "combo") {
      $(slot.measure).addEventListener("change", () => {
        clearChartAxisBounds($(slot.axis).value);
        applyChartAxes();
      });
      $(slot.add).addEventListener("click", () => enableComboSlot(slot.key));
    }
  }
  const tabs = [$("chart-tab"), $("custom-tab")];
  tabs.forEach((tab, index) => tab.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
    selectChartTab(next === 1); tabs[next].focus();
  }));
}

function chartMeasureItem(item, selectorId = "chart-measure") {
  if (!item.chart_measures) return item;
  const measure = item.chart_measures[$(selectorId).value];
  if (!measure) throw new Error("Choose an available chart measure.");
  return { ...item, chart_label: measure.label, chart_unit: measure.unit,
    chart_value_style: measure.value_style, export_history: measure.history,
    chart_percent_change: ["period", "yoy", "annual"].includes($(selectorId).value) };
}

function fillChartMeasures(item, selectorId) {
  const selector = $(selectorId); selector.replaceChildren();
  for (const [key, measure] of Object.entries(item.chart_measures || { current: { label: item.chart_label || "Current measure" } })) {
    const option = document.createElement("option"); option.value = key; option.textContent = measure.label;
    selector.append(option);
  }
  selector.value = item.default_chart_measure || "current";
  selector.disabled = !item.chart_measures || selector.options.length < 2;
}

function enableComboSlot(key) {
  const slot = ADDITIONAL_SERIES_SLOTS.find(candidate => candidate.key === key);
  if (!slot?.container) return;
  $(slot.container).hidden = false;
  $(slot.add).hidden = true;
  const next = ADDITIONAL_SERIES_SLOTS[ADDITIONAL_SERIES_SLOTS.indexOf(slot) + 1];
  if (next?.add) $(next.add).hidden = false;
}

function resetComboSlots() {
  for (const slot of ADDITIONAL_SERIES_SLOTS.slice(1)) {
    $(slot.container).hidden = true;
    $(slot.add).hidden = slot.key !== "combo2";
  }
}

function refreshComboIndicatorOptions() {
  const selected = new Set(ADDITIONAL_SERIES_SLOTS.map(slot => $(slot.indicator).value).filter(Boolean));
  for (const slot of ADDITIONAL_SERIES_SLOTS) {
    const selector = $(slot.indicator);
    const previous = selector.value;
    selector.replaceChildren();
    const none = document.createElement("option"); none.value = ""; none.textContent = "None"; selector.append(none);
    for (const candidate of Object.values(snapshot?.indicators || {})) {
      if (candidate.id === activeChartItem.id || (selected.has(candidate.id) && candidate.id !== previous) ||
          !exportPoints(candidate).some(point => point.value !== null && Number.isFinite(Number(point.value)))) continue;
      const option = document.createElement("option"); option.value = candidate.id;
      option.textContent = `${candidate.title} (${candidate.frequency})`; selector.append(option);
    }
    if ([...selector.options].some(option => option.value === previous)) selector.value = previous;
    else selector.value = "";
  }
}

function changeComboIndicator(key = "combo") {
  const slot = ADDITIONAL_SERIES_SLOTS.find(candidate => candidate.key === key);
  if (!slot) return;
  refreshComboIndicatorOptions();
  for (const candidate of ADDITIONAL_SERIES_SLOTS) {
    const item = snapshot?.indicators?.[$(candidate.indicator).value];
    $(candidate.options).hidden = !item;
    if (item && $(candidate.measure).dataset.indicatorId !== item.id) {
      fillChartMeasures(item, candidate.measure);
      $(candidate.measure).dataset.indicatorId = item.id;
    } else if (!item) $(candidate.measure).dataset.indicatorId = "";
  }
  clearChartAxisBounds($(slot.axis).value);
  updateChartTypes();
  applyChartAxes();
}

function updateChartTypes() {
  const combo = ADDITIONAL_SERIES_SLOTS.some(slot => !!$(slot.indicator).value);
  for (const id of ["chart-type", ...ADDITIONAL_SERIES_SLOTS.map(slot => slot.type)]) {
    const horizontal = [...$(id).options].find(option => option.value === "bar");
    if (horizontal) horizontal.disabled = id !== "chart-type" || combo;
  }
}

function clearChartAxisBounds(side) {
  const prefix = side === "left" ? "chart-" : "chart-right-";
  $(prefix + "min").value = ""; $(prefix + "max").value = "";
}

function updateAxisOptions() {
  $("chart-right-options").hidden = $("chart-axis").value !== "right" &&
    !ADDITIONAL_SERIES_SLOTS.some(slot => $(slot.indicator).value && $(slot.axis).value === "right");
  for (const input of $("chart-right-options").querySelectorAll("input")) input.disabled = $("chart-right-options").hidden;
}

function calendarTicks(first, last, months) {
  if (!Number.isSafeInteger(months) || months <= 0) throw new Error("X-axis interval must be a positive whole number of months, or blank for Auto.");
  const start = new Date(first);
  let year = start.getUTCFullYear(), month = start.getUTCMonth();
  if (Date.UTC(year, month, 1) < first) month++;
  const ticks = [];
  for (let index = 0; ; index++) {
    const date = Date.UTC(year, month + index * months, 1);
    if (!Number.isFinite(date) || date > last) break;
    if (ticks.length === 50) throw new Error("Choose a larger X-axis interval: at most 50 date labels are supported.");
    ticks.push(date);
  }
  return ticks.length ? ticks : [first];
}

function chartRange(item, options) {
  if (!options.from || !options.to || options.from > options.to) {
    throw new Error("Choose a valid date range with From on or before To.");
  }
  const rows = exportPoints(item).filter(point => {
    const [start, end] = periodBounds(point, item.frequency_code);
    return end >= options.from && start <= options.to;
  });
  const values = options.values || rows.filter(point => point.value !== null && Number.isFinite(Number(point.value))).map(point => Number(point.value));
  if (!values.length) throw new Error("No observations are available in this date range.");
  let low = Math.min(...values), high = Math.max(...values);
  const pad = (high - low || Math.max(Math.abs(high), 1)) * .09;
  low -= pad; high += pad;
  if (options.includeZero ?? item.chart_percent_change) {
    low = Math.min(low, 0); high = Math.max(high, 0);
  }
  if (options.low !== "") low = Number(options.low);
  if (options.high !== "") high = Number(options.high);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low >= high || !Number.isFinite(high - low)) {
    throw new Error("Y-axis minimum must be a finite number below the maximum.");
  }
  let interval = options.interval === undefined || options.interval === "" ? null : Number(options.interval);
  if (interval === null && options.low === "" && options.high === "") {
    const target = Math.max((high - low) / 4, .25);
    const magnitude = 10 ** Math.floor(Math.log10(target));
    interval = [1, 2, 2.5, 5, 10].find(step => step * magnitude >= target) * magnitude;
  }
  if (interval !== null) {
    if (!Number.isFinite(interval) || interval <= 0) throw new Error("Y-axis interval must be a positive finite number, or blank for Auto.");
    if (options.low === "") low = Math.floor(low / interval) * interval;
    if (options.high === "") high = Math.ceil(high / interval) * interval;
    if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isFinite(high - low) || (high - low) / interval > 49 || low + interval === low) {
      throw new Error("Choose a larger Y-axis interval: at most 50 tick labels are supported.");
    }
  }
  const customDigits = [options.low, options.high].reduce((digits, value) => Math.max(digits, (String(value).split(".")[1] || "").length), 0);
  const digits = Math.min(3, Math.max(2, customDigits, Math.ceil(-Math.log10(high - low)) + 2));
  const decimals = options.decimals === undefined || options.decimals === "" ? null : Number(options.decimals);
  if (decimals !== null && (!Number.isInteger(decimals) || decimals < 0 || decimals > 3)) {
    throw new Error("Decimal places must be a whole number from 0 to 3, or blank for Auto.");
  }
  return { rows, low, high, digits, decimals, interval };
}

function axisTicks(view) {
  if (view.interval === null) return Array.from({ length: 5 }, (_, index) => view.low + (view.high - view.low) * index / 4);
  const count = Math.floor((view.high - view.low) / view.interval + 1e-9) + 1;
  return Array.from({ length: count }, (_, index) => Number((view.low + index * view.interval).toPrecision(15)));
}

function axisTickLabel(value, view, valueStyle) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: view.decimals ?? view.digits,
    minimumFractionDigits: view.decimals ?? (valueStyle === "decimal2" ? 2 : 0),
  }).format(value);
}

function axisTickNode(label, attrs) {
  return svgNode("text", {
    ...attrs, ...(label.length > 11 ? { textLength: 72, lengthAdjust: "spacingAndGlyphs" } : {}),
  }, label);
}

function chartMessage(message, error = false) {
  const status = $("chart-status");
  status.textContent = message;
  status.classList.toggle("export-error", error);
}

function enableChartExports(enabled) {
  for (const id of ["copy-chart", "download-chart-csv"]) {
    $(id).disabled = !enabled;
  }
}

function openTrend(item) {
  activeChartItem = item;
  $("trend-title").textContent = item.title;
  fillChartMeasures(item, "chart-measure");
  for (const slot of ADDITIONAL_SERIES_SLOTS) $(slot.indicator).value = "";
  refreshComboIndicatorOptions();
  const available = exportPoints(item).filter(point => point.value !== null && Number.isFinite(Number(point.value)));
  for (const id of ["chart-from", "chart-to"]) {
    $(id).min = available.length ? periodBounds(available[0], item.frequency_code)[0] : "";
    $(id).max = available.length ? periodBounds(available[available.length - 1], item.frequency_code)[1] : "";
  }
  resetChartAxes();
  selectChartTab(false);
  $("trend-dialog").showModal();
}

function resetChartAxes() {
  for (const slot of ADDITIONAL_SERIES_SLOTS) {
    $(slot.indicator).value = "";
    $(slot.options).hidden = true;
    $(slot.measure).dataset.indicatorId = "";
    $(slot.color).value = CHART_SERIES_COLORS[ADDITIONAL_SERIES_SLOTS.indexOf(slot) + 1];
    $(slot.axis).value = "right";
    $(slot.type).value = "line";
  }
  $("chart-color").value = CHART_SERIES_COLORS[0];
  resetComboSlots();
  $("chart-right-min").value = ""; $("chart-right-max").value = "";
  $("chart-measure").value = activeChartItem.default_chart_measure || "current";
  const rows = activeChartItem.history || [];
  $("chart-from").value = rows.length ? periodBounds(rows[0], activeChartItem.frequency_code)[0] : "";
  $("chart-to").value = rows.length ? periodBounds(rows[rows.length - 1], activeChartItem.frequency_code)[1] : "";
  $("chart-min").value = "";
  $("chart-max").value = "";
  $("chart-decimals").value = "";
  $("chart-right-decimals").value = "";
  $("chart-interval").value = ""; $("chart-right-interval").value = "";
  $("chart-axis").value = "left"; $("combo-axis").value = "right";
  $("chart-type").value = "line"; $("combo-type").value = "line";
  $("chart-x-interval").value = "";
  applyChartAxes();
}

function applyChartAxes(event) {
  if (event) event.preventDefault();
  updateAxisOptions();
  updateChartTypes();
  try {
    const item = chartMeasureItem(activeChartItem);
    const dates = { from: $("chart-from").value, to: $("chart-to").value };
    chartView = chartRange(item, { ...dates, low: "", high: "" });
    chartView.item = item;
    chartView.side = $("chart-axis").value;
    chartView.type = $("chart-type").value;
    chartView.color = seriesColor("chart-color", 0);
    chartView.xInterval = $("chart-x-interval").value === "" ? null : Number($("chart-x-interval").value);
    if (!["left", "right"].includes(chartView.side)) throw new Error("Choose Left or Right for the original indicator axis.");
    const views = [chartView];
    const chosen = new Set([item.id]);
    for (const [index, slot] of ADDITIONAL_SERIES_SLOTS.entries()) {
      const id = $(slot.indicator).value;
      if (!id) continue;
      const other = snapshot?.indicators?.[id];
      if (!other || chosen.has(other.id)) throw new Error("Choose a different indicator for each series.");
      chosen.add(other.id);
      const seriesItem = chartMeasureItem(other, slot.measure);
      const view = chartRange(seriesItem, { ...dates, low: "", high: "" });
      view.item = seriesItem;
      view.side = $(slot.axis).value;
      view.type = $(slot.type).value;
      view.color = seriesColor(slot.color, index + 1);
      if (!["left", "right"].includes(view.side)) throw new Error("Choose Left or Right for each added indicator axis.");
      views.push(view);
    }
    chartView.series = views;
    chartView.second = views[1];
    chartView.third = views[2];
    chartView.fourth = views[3];
    if (views.some(view => !["line", "column", "area", "step", "scatter", "bar"].includes(view.type))) throw new Error("Choose an available chart type.");
    if (views.length > 1 && views.some(view => view.type === "bar")) throw new Error("Horizontal bars are available for a single indicator only. Remove the added indicators or choose another chart type.");
    const axes = {};
    for (const side of ["left", "right"]) {
      const members = views.filter(view => view.side === side);
      if (!members.length) continue;
      const prefix = side === "left" ? "chart-" : "chart-right-";
      const values = members.flatMap(view => view.rows.filter(point => point.value !== null && Number.isFinite(Number(point.value))).map(point => Number(point.value)));
      if (members.some(view => ["column", "area", "bar"].includes(view.type))) values.push(0);
      const axis = chartRange(members[0].item, { ...dates, values,
        includeZero: members.some(view => view.item.chart_percent_change),
        low: $(prefix + "min").value, high: $(prefix + "max").value,
        decimals: $(prefix + "decimals").value, interval: $(prefix + "interval").value });
      axes[side] = { ...axis, item: members[0].item };
      for (const view of members) Object.assign(view, { low: axis.low, high: axis.high, digits: axis.digits, decimals: axis.decimals, interval: axis.interval });
    }
    chartView.axes = axes;
    const rows = chartView.rows;
    $("trend-title").textContent = views.length > 1 ? "Combo chart" : activeChartItem.title;
    $("trend-subtitle").textContent = `${item.frequency} · ${item.chart_label || item.title} (${item.chart_unit || item.unit}) · ${fmtPeriod(rows[0].period)}–${fmtPeriod(rows[rows.length - 1].period)}`;
    if (views.length > 1) $("trend-subtitle").textContent = `${$("chart-from").value} to ${$("chart-to").value} · ${Object.keys(axes).length === 1 ? `Shared ${Object.keys(axes)[0]} Y-axis scale` : "Independent left/right scales"}`;
    drawTrend(item);
    enableChartExports(true);
    const description = activeChartItem.chart_measures?.[$("chart-measure").value]?.description || "";
    const comboDescription = views.length > 1 ? " Combo points are aligned by period-end date, without resampling. Indicators on the same side share one scale." : "";
    chartMessage(`${description}${comboDescription} Leave Y limits blank for automatic scaling. Monthly and quarterly observations overlap the selected dates.`);
    if (event) { selectChartTab(false); $("chart-tab").focus(); }
  } catch (error) {
    chartView = null;
    $("trend-chart").hidden = true;
    $("chart-empty").hidden = false;
    $("chart-empty").textContent = "Adjust the axes to display the chart.";
    enableChartExports(false);
    chartMessage(error.message, true);
  }
}

function seriesColor(selectorId, index) {
  const value = $(selectorId).value;
  return CHART_SERIES_COLORS.includes(value) ? value : CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
}

function currentChartSeries() {
  return chartView?.series || [chartView, ...(chartView?.second ? [chartView.second] : [])];
}

function drawTrend(item) {
  const svg = $("trend-chart");
  svg.replaceChildren();
  svg.hidden = false;
  $("chart-empty").hidden = true;
  if (chartView.type === "bar") { drawHorizontalBars(svg); return; }
  const { rows, low, high } = chartView;
  const seriesViews = currentChartSeries();
  const multiple = seriesViews.length > 1;
  const width = 900, height = 390, margin = { top: multiple ? 18 + seriesViews.length * 23 : 20, right: chartView.axes.right ? 92 : 22, bottom: 54, left: 92 };
  const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
  const date = (point, seriesItem) => Date.parse(`${periodBounds(point, seriesItem.frequency_code)[1]}T00:00:00Z`);
  const timeScale = multiple || chartView.xInterval !== null;
  const dates = seriesViews.flatMap(view => view.rows.map(point => date(point, view.item)));
  const firstDate = dates.length ? Math.min(...dates) : 0, lastDate = dates.length ? Math.max(...dates) : 0;
  const x = (index, seriesRows = rows, seriesItem = item) => timeScale
    ? margin.left + (date(seriesRows[index], seriesItem) - firstDate) * plotW / Math.max(lastDate - firstDate, 1)
    : margin.left + index * plotW / Math.max(rows.length - 1, 1);
  const valueStyle = item.chart_value_style || (Math.abs(high - low) > 100 ? "decimal0" : "decimal1");
  if (multiple) {
    for (const [index, view] of seriesViews.entries()) {
      const color = view.color;
      const itemAttrs = { "data-series": index };
      const sample = ["column", "area"].includes(view.type)
        ? svgNode("rect", { ...itemAttrs, class: "legend-swatch", x: 22, y: 10 + index * 23, width: 23, height: 12, fill: color })
        : svgNode("line", { ...itemAttrs, class: "legend-swatch", x1: 22, x2: 45, y1: 17 + index * 23, y2: 17 + index * 23, stroke: color, "stroke-width": 3 });
      svg.append(sample);
      const label = `${view.side === "right" ? "Right" : "Left"}: ${view.item.title} | ${view.item.chart_label || view.item.title} (${view.item.chart_unit || view.item.unit}) | ${view.item.frequency}`;
      const attrs = { ...itemAttrs, class: "legend-item", x: 54, y: 21 + index * 23, style: `fill:${color}` };
      if (label.length > 110) { attrs.textLength = 820; attrs.lengthAdjust = "spacingAndGlyphs"; }
      svg.append(svgNode("text", attrs, label));
    }
  }
  for (const [side, axis] of Object.entries(chartView.axes)) {
    for (const value of axisTicks(axis).reverse()) {
      const yy = margin.top + (axis.high - value) * plotH / (axis.high - axis.low);
      if (side === "left" || !chartView.axes.left) svg.append(svgNode("line", { x1: margin.left, x2: width - margin.right, y1: yy, y2: yy, class: "grid-line" }));
      const label = axisTickLabel(value, axis, axis.item.chart_value_style || valueStyle);
      svg.append(axisTickNode(label, { x: side === "left" ? margin.left - 10 : width - margin.right + 12, y: yy + 4,
        "text-anchor": side === "left" ? "end" : "start", "data-axis": side, style: "fill:#ffffff" }));
    }
  }
  const monthTicks = chartView.xInterval === null ? null : calendarTicks(firstDate, lastDate, chartView.xInterval);
  const tickCount = monthTicks ? monthTicks.length : multiple ? (lastDate === firstDate ? 1 : 6) : Math.min(6, rows.length);
  for (let tick = 0; tick < tickCount; tick++) {
    const index = Math.round(tick * (rows.length - 1) / Math.max(tickCount - 1, 1));
    const position = monthTicks ? margin.left + (monthTicks[tick] - firstDate) * plotW / Math.max(lastDate - firstDate, 1)
      : multiple ? margin.left + tick * plotW / Math.max(tickCount - 1, 1) : x(index);
    const label = monthTicks ? new Date(monthTicks[tick]).toISOString().slice(0, 7)
      : multiple ? new Date(firstDate + (lastDate - firstDate) * tick / Math.max(tickCount - 1, 1)).toISOString().slice(0, 10) : rows[index].period;
    svg.append(svgNode("text", { x: position, y: height - 20, "text-anchor": tick === 0 ? "start" : tick === tickCount - 1 ? "end" : "middle", "data-axis": "x", "data-period": label, style: "fill:#ffffff" }, fmtPeriod(label)));
  }
  const defs = svgNode("defs"), clip = svgNode("clipPath", { id: "chart-plot-clip" });
  const endpointPadding = 9;
  clip.append(svgNode("rect", { x: margin.left - endpointPadding, y: margin.top, width: plotW + 2 * endpointPadding, height: plotH }));
  defs.append(clip); svg.append(defs);
  const plot = svgNode("g", { "clip-path": "url(#chart-plot-clip)" });
  for (const view of [...seriesViews].sort((a, b) => Number(["column", "area"].includes(b.type)) - Number(["column", "area"].includes(a.type)))) {
    const seriesIndex = seriesViews.indexOf(view);
    const seriesRows = view.rows, seriesItem = view.item;
    const seriesY = value => margin.top + (view.high - value) * plotH / (view.high - view.low);
    const seriesX = index => x(index, seriesRows, seriesItem);
    const seriesStyle = seriesItem.chart_value_style || (Math.abs(view.high - view.low) > 100 ? "decimal0" : "decimal1");
    const positions = [...new Set(seriesRows.map((_, index) => seriesX(index)))].sort((a, b) => a - b);
    const gaps = positions.slice(1).map((value, index) => value - positions[index]);
    const groupWidth = Math.max(.5, Math.min(16, gaps.length ? Math.min(...gaps) * .7 : 16));
    const grouped = multiple && seriesViews.every(series => series.type === "column");
    const barWidth = grouped ? groupWidth / seriesViews.length : groupWidth;
    const offset = grouped ? (seriesIndex - (seriesViews.length - 1) / 2) * barWidth : 0;
    const baseline = seriesY(Math.min(view.high, Math.max(view.low, 0)));
    let path = "", drawing = false;
    const areaSegments = [];
    let segment = [];
    seriesRows.forEach((point, index) => {
      const value = Number(point.value);
      if (point.value === null || !Number.isFinite(value)) {
        drawing = false;
        if (segment.length) { areaSegments.push(segment); segment = []; }
        return;
      }
      if (view.type === "column") {
        const yy = seriesY(value);
        const bar = svgNode("rect", { x: seriesX(index) + offset - barWidth / 2, y: Math.min(yy, baseline),
          width: barWidth, height: Math.abs(yy - baseline), class: "series-column", "data-series": seriesIndex,
          "data-period": point.period, fill: view.color });
        bar.append(svgNode("title", {}, `${seriesItem.title} · ${fmtPeriod(point.period)}: ${fmt(point.value, seriesStyle)} ${seriesItem.chart_unit || seriesItem.unit}`));
        plot.append(bar);
      } else if (view.type === "scatter") {
        const dot = svgNode("circle", { cx: seriesX(index), cy: seriesY(value), r: 4, class: "series-scatter", fill: view.color, "data-series": seriesIndex });
        plot.append(dot);
      } else {
        const xx = seriesX(index), yy = seriesY(value);
        path += drawing && view.type === "step" ? ` H ${xx} V ${yy}` : `${drawing ? " L" : " M"} ${xx} ${yy}`;
        segment.push([xx, yy]); drawing = true;
      }
    });
    if (segment.length) areaSegments.push(segment);
    if (view.type === "area") {
      for (const points of areaSegments) {
        const d = `M ${points[0][0]} ${baseline} ` + points.map(([xx, yy]) => `L ${xx} ${yy}`).join(" ") + ` L ${points[points.length - 1][0]} ${baseline} Z`;
        plot.append(svgNode("path", { d, class: "series-area", fill: view.color, "fill-opacity": .28, "data-series": seriesIndex }));
      }
    }
    if (["line", "area", "step"].includes(view.type)) plot.append(svgNode("path", { d: path.trim(), class: "series-line", "data-type": view.type, "data-series": seriesIndex, style: `stroke:${view.color}` }));
    const lastIndex = seriesRows.findLastIndex(point => point.value !== null && Number.isFinite(Number(point.value)));
    if (lastIndex >= 0 && ["line", "area", "step"].includes(view.type)) {
      plot.append(svgNode("circle", { cx: seriesX(lastIndex), cy: seriesY(Number(seriesRows[lastIndex].value)), r: 5, class: "latest-point", "data-series": seriesIndex, style: `fill:${view.color}` }));
    }
    seriesRows.forEach((point, index) => {
      if (point.value === null || !Number.isFinite(Number(point.value))) return;
      const circle = svgNode("circle", { cx: seriesX(index), cy: seriesY(Number(point.value)), r: 8, class: "hover-target" });
      circle.append(svgNode("title", {}, `${seriesItem.title} · ${fmtPeriod(point.period)}: ${fmt(point.value, seriesStyle)} ${seriesItem.chart_unit || seriesItem.unit}`));
      plot.append(circle);
    });
  }
  svg.append(plot);
}

function drawHorizontalBars(svg) {
  const view = chartView, { rows, item, low, high } = view;
  const margin = { left: 100, right: 22, top: 25, bottom: 54 };
  const width = 900 - margin.left - margin.right, height = 390 - margin.top - margin.bottom;
  const dates = rows.map(point => Date.parse(`${periodBounds(point, item.frequency_code)[1]}T00:00:00Z`));
  const first = Math.min(...dates), last = Math.max(...dates);
  const x = value => margin.left + (value - low) * width / (high - low);
  const yDate = date => margin.top + (date - first) * height / Math.max(last - first, 1);
  const y = index => view.xInterval === null ? margin.top + index * height / Math.max(rows.length - 1, 1) : yDate(dates[index]);
  const ticks = view.xInterval === null ? null : calendarTicks(first, last, view.xInterval);
  const count = ticks ? ticks.length : Math.min(6, rows.length);
  for (let tick = 0; tick < count; tick++) {
    const index = Math.round(tick * (rows.length - 1) / Math.max(count - 1, 1));
    const label = ticks ? new Date(ticks[tick]).toISOString().slice(0, 7) : rows[index].period;
    svg.append(svgNode("text", { x: margin.left - 10, y: (ticks ? yDate(ticks[tick]) : y(index)) + 4,
      "text-anchor": "end", "data-axis": "date", "data-period": label, style: "fill:#ffffff" }, fmtPeriod(label)));
  }
  for (const value of axisTicks(view)) {
    const xx = x(value);
    svg.append(svgNode("line", { x1: xx, x2: xx, y1: margin.top, y2: margin.top + height, class: "grid-line" }));
    svg.append(axisTickNode(axisTickLabel(value, view, item.chart_value_style), { x: xx, y: 370,
      "text-anchor": value === low ? "start" : value === high ? "end" : "middle", "data-axis": "value", style: "fill:#ffffff" }));
  }
  const defs = svgNode("defs"), clip = svgNode("clipPath", { id: "chart-plot-clip" });
  clip.append(svgNode("rect", { x: margin.left, y: margin.top - 9, width, height: height + 18 }));
  defs.append(clip); svg.append(defs);
  const plot = svgNode("g", { "clip-path": "url(#chart-plot-clip)" });
  const positions = rows.map((_, index) => y(index));
  const gaps = positions.slice(1).map((value, index) => value - positions[index]).filter(value => value > 0);
  const barHeight = Math.max(.5, Math.min(16, gaps.length ? Math.min(...gaps) * .7 : 16));
  const baseline = x(Math.min(high, Math.max(low, 0)));
  rows.forEach((point, index) => {
    if (point.value === null || !Number.isFinite(Number(point.value))) return;
    const xx = x(Number(point.value));
    const bar = svgNode("rect", { x: Math.min(xx, baseline), y: y(index) - barHeight / 2,
      width: Math.abs(xx - baseline), height: barHeight, class: "series-bar", fill: view.color });
    bar.append(svgNode("title", {}, `${item.title} · ${fmtPeriod(point.period)}: ${fmt(point.value, item.chart_value_style || "decimal2")} ${item.chart_unit || item.unit}`));
    plot.append(bar);
  });
  svg.append(plot);
}

function chartSvgSource() {
  if (!chartView || $("trend-chart").hidden) throw new Error("Apply valid axes before copying the chart.");
  const svg = $("trend-chart").cloneNode(true);
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("viewBox", "0 0 900 460");
  svg.setAttribute("width", "900"); svg.setAttribute("height", "460");
  svg.setAttribute("aria-label", $("trend-title").textContent);
  svg.removeAttribute("aria-labelledby");
  const graph = svgNode("g", { transform: "translate(0 70)" });
  graph.append(...svg.childNodes);
  graph.querySelectorAll(".hover-target").forEach(node => node.remove());
  const style = svgNode("style", {}, "#trend-chart text{fill:#b1c0b8;font:300 11px 'Calibri Light',Calibri,'Segoe UI',Arial,sans-serif}#trend-chart .grid-line{stroke:#34443d;stroke-width:1}#trend-chart .series-line{fill:none;stroke:#43c5ca;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}#trend-chart .latest-point{fill:#b9fa38;stroke:#19221f;stroke-width:2}#trend-chart .image-title{fill:#edf4f0;font-size:20px}");
  svg.replaceChildren(style, svgNode("rect", { width: 900, height: 460, fill: "#19221f" }),
    svgNode("text", { x: 22, y: 28, class: "image-title" }, $("trend-title").textContent),
    svgNode("text", { x: 22, y: 50 }, $("trend-subtitle").textContent), graph);
  return new XMLSerializer().serializeToString(svg);
}

function downloadChartBlob(blob, extension) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `us-macro-${activeChartItem.id}.${extension}`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function chartPng(source) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not render the chart image.")); };
    image.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement("canvas"); canvas.width = 1800; canvas.height = 920;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image export is not supported by this browser.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not create the PNG image.")), "image/png");
      } catch (error) { reject(error); }
    };
    image.src = url;
  });
}

async function copyChart() {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      throw new Error("Copy image is unavailable. Use a browser that supports copying images, such as Chrome or Edge.");
    }
    const png = chartPng(chartSvgSource());
    const image = new ClipboardItem({ "image/png": png });
    await Promise.all([navigator.clipboard.write([image]), png]);
    chartMessage("Chart copied as an image. Paste it into your document or presentation.");
  } catch (error) {
    chartMessage(`Could not copy the chart: ${error.message} Check your browser's clipboard permission and try again.`, true);
    console.error("Chart copy failed", error);
  }
}

function downloadChartCsv() {
  if (!chartView) { chartMessage("Apply valid axes before exporting data.", true); return; }
  const rows = [["Indicator", "Measure", "Period", "Value", "Unit"]];
  for (const view of currentChartSeries()) {
    const item = view.item;
    for (const point of view.rows) {
      if (point.value === null || !Number.isFinite(Number(point.value))) continue;
      const value = item.chart_value_style === "decimal2" ? Number(point.value).toFixed(2) : point.value;
      rows.push([item.title, item.chart_label || item.title, point.period, value, item.chart_unit || item.unit]);
    }
  }
  const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = rows.map(row => row.map(quote).join(",")).join("\r\n");
  downloadChartBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), "csv");
}
