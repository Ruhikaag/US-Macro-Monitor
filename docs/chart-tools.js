let chartView = null;

function tileTitle(title) {
  const text = title.toLowerCase();
  return (text.charAt(0).toUpperCase() + text.slice(1)).replace(/\bgdp\b/gi, "GDP");
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
  $("chart-tab").addEventListener("click", () => selectChartTab(false));
  $("custom-tab").addEventListener("click", () => selectChartTab(true));
  for (const id of ["chart-axis", "combo-axis"]) $(id).addEventListener("change", () => applyChartAxes());
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
    chart_value_style: measure.value_style, export_history: measure.history };
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

function changeComboIndicator() {
  const item = snapshot?.indicators?.[$("combo-indicator").value];
  $("combo-options").hidden = !item;
  clearChartAxisBounds($("combo-axis").value);
  if (item) fillChartMeasures(item, "combo-measure");
  applyChartAxes();
}

function clearChartAxisBounds(side) {
  const prefix = side === "left" ? "chart-" : "chart-right-";
  $(prefix + "min").value = ""; $(prefix + "max").value = "";
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
  if (options.low !== "") low = Number(options.low);
  if (options.high !== "") high = Number(options.high);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low >= high || !Number.isFinite(high - low)) {
    throw new Error("Y-axis minimum must be a finite number below the maximum.");
  }
  const interval = options.interval === undefined || options.interval === "" ? null : Number(options.interval);
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
  const combo = $("combo-indicator"); combo.replaceChildren();
  const none = document.createElement("option"); none.value = ""; none.textContent = "None - single chart"; combo.append(none);
  for (const candidate of Object.values(snapshot?.indicators || {})) {
    if (candidate.id === item.id || !exportPoints(candidate).some(point => point.value !== null && Number.isFinite(Number(point.value)))) continue;
    const option = document.createElement("option"); option.value = candidate.id;
    option.textContent = `${candidate.title} (${candidate.frequency})`; combo.append(option);
  }
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
  $("combo-indicator").value = "";
  $("combo-options").hidden = true;
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
  applyChartAxes();
}

function applyChartAxes(event) {
  if (event) event.preventDefault();
  try {
    const item = chartMeasureItem(activeChartItem);
    const dates = { from: $("chart-from").value, to: $("chart-to").value };
    chartView = chartRange(item, { ...dates, low: "", high: "" });
    chartView.item = item;
    chartView.side = $("chart-axis").value;
    if (!["left", "right"].includes(chartView.side)) throw new Error("Choose Left or Right for the original indicator axis.");
    if ($("combo-indicator").value) {
      const other = snapshot?.indicators?.[$("combo-indicator").value];
      if (!other || other.id === item.id) throw new Error("Choose a different available indicator.");
      const secondItem = chartMeasureItem(other, "combo-measure");
      const second = chartRange(secondItem, { ...dates, low: "", high: "" });
      second.item = secondItem;
      second.side = $("combo-axis").value;
      if (!["left", "right"].includes(second.side)) throw new Error("Choose Left or Right for the added indicator axis.");
      chartView.second = second;
    }
    const views = [chartView, ...(chartView.second ? [chartView.second] : [])];
    const axes = {};
    for (const side of ["left", "right"]) {
      const members = views.filter(view => view.side === side);
      if (!members.length) continue;
      const prefix = side === "left" ? "chart-" : "chart-right-";
      const values = members.flatMap(view => view.rows.filter(point => point.value !== null && Number.isFinite(Number(point.value))).map(point => Number(point.value)));
      const axis = chartRange(members[0].item, { ...dates, values,
        low: $(prefix + "min").value, high: $(prefix + "max").value,
        decimals: $(prefix + "decimals").value, interval: $(prefix + "interval").value });
      axes[side] = { ...axis, item: members[0].item, color: members.length > 1 ? "#b1c0b8" : members[0] === chartView ? "#43c5ca" : "#86bc25" };
      for (const view of members) Object.assign(view, { low: axis.low, high: axis.high, digits: axis.digits, decimals: axis.decimals, interval: axis.interval });
    }
    chartView.axes = axes;
    const rows = chartView.rows;
    $("trend-title").textContent = chartView.second ? "Combo chart" : activeChartItem.title;
    $("trend-subtitle").textContent = `${item.frequency} · ${item.chart_label || item.title} (${item.chart_unit || item.unit}) · ${fmtPeriod(rows[0].period)}–${fmtPeriod(rows[rows.length - 1].period)}`;
    if (chartView.second) $("trend-subtitle").textContent = `${$("chart-from").value} to ${$("chart-to").value} · ${chartView.side === chartView.second.side ? `Shared ${chartView.side} Y-axis scale` : "Independent left/right scales"}`;
    drawTrend(item);
    enableChartExports(true);
    const description = activeChartItem.chart_measures?.[$("chart-measure").value]?.description || "";
    const secondDescription = chartView.second ? ` ${snapshot.indicators[$("combo-indicator").value].chart_measures?.[$("combo-measure").value]?.description || ""} Combo points are aligned by period-end date, without resampling. Indicators on the same side share one scale.` : "";
    chartMessage(`${description}${secondDescription} Leave Y limits blank for automatic scaling. Monthly and quarterly observations overlap the selected dates.`);
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

function drawTrend(item) {
  const svg = $("trend-chart");
  svg.replaceChildren();
  svg.hidden = false;
  $("chart-empty").hidden = true;
  const { rows, low, high } = chartView;
  const second = chartView.second;
  const width = 900, height = 390, margin = { top: second ? 64 : 20, right: chartView.axes.right ? 92 : 22, bottom: 54, left: 92 };
  const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
  const date = (point, seriesItem) => Date.parse(`${periodBounds(point, seriesItem.frequency_code)[1]}T00:00:00Z`);
  const dates = second ? [...rows.map(point => date(point, item)), ...second.rows.map(point => date(point, second.item))] : [];
  const firstDate = dates.length ? Math.min(...dates) : 0, lastDate = dates.length ? Math.max(...dates) : 0;
  const x = (index, seriesRows = rows, seriesItem = item) => second
    ? margin.left + (date(seriesRows[index], seriesItem) - firstDate) * plotW / Math.max(lastDate - firstDate, 1)
    : margin.left + index * plotW / Math.max(rows.length - 1, 1);
  const valueStyle = item.chart_value_style || (Math.abs(high - low) > 100 ? "decimal0" : "decimal1");
  if (second) {
    for (const [index, view] of [chartView, second].entries()) {
      const color = index ? "#86bc25" : "#43c5ca";
      svg.append(svgNode("line", { x1: 22, x2: 45, y1: 17 + index * 23, y2: 17 + index * 23, stroke: color, "stroke-width": 3 }));
      const label = `${view.side === "right" ? "Right" : "Left"}: ${view.item.title} | ${view.item.chart_label || view.item.title} (${view.item.chart_unit || view.item.unit}) | ${view.item.frequency}`;
      const attrs = { x: 54, y: 21 + index * 23, style: `fill:${color}` };
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
  const tickCount = second ? (lastDate === firstDate ? 1 : 6) : Math.min(6, rows.length);
  for (let tick = 0; tick < tickCount; tick++) {
    const index = Math.round(tick * (rows.length - 1) / Math.max(tickCount - 1, 1));
    const position = second ? margin.left + tick * plotW / Math.max(tickCount - 1, 1) : x(index);
    const label = second ? new Date(firstDate + (lastDate - firstDate) * tick / Math.max(tickCount - 1, 1)).toISOString().slice(0, 10) : rows[index].period;
    svg.append(svgNode("text", { x: position, y: height - 20, "text-anchor": tick === 0 ? "start" : tick === tickCount - 1 ? "end" : "middle", "data-axis": "x", style: "fill:#ffffff" }, fmtPeriod(label)));
  }
  const defs = svgNode("defs"), clip = svgNode("clipPath", { id: "chart-plot-clip" });
  const endpointPadding = 9;
  clip.append(svgNode("rect", { x: margin.left - endpointPadding, y: margin.top, width: plotW + 2 * endpointPadding, height: plotH }));
  defs.append(clip); svg.append(defs);
  const plot = svgNode("g", { "clip-path": "url(#chart-plot-clip)" });
  for (const [seriesIndex, view] of [chartView, ...(second ? [second] : [])].entries()) {
    const seriesRows = view.rows, seriesItem = view.item;
    const seriesY = value => margin.top + (view.high - value) * plotH / (view.high - view.low);
    const seriesX = index => x(index, seriesRows, seriesItem);
    const seriesStyle = seriesItem.chart_value_style || (Math.abs(view.high - view.low) > 100 ? "decimal0" : "decimal1");
    let path = "", drawing = false;
    seriesRows.forEach((point, index) => {
      const value = Number(point.value);
      if (point.value === null || !Number.isFinite(value)) { drawing = false; return; }
      path += `${drawing ? " L" : " M"} ${seriesX(index)} ${seriesY(value)}`; drawing = true;
    });
    plot.append(svgNode("path", { d: path.trim(), class: "series-line", ...(seriesIndex ? { style: "stroke:#86bc25" } : {}) }));
    const lastIndex = seriesRows.findLastIndex(point => point.value !== null && Number.isFinite(Number(point.value)));
    if (lastIndex >= 0) {
      plot.append(svgNode("circle", { cx: seriesX(lastIndex), cy: seriesY(Number(seriesRows[lastIndex].value)), r: 5, class: "latest-point", ...(seriesIndex ? { style: "fill:#86bc25" } : {}) }));
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
  const rows = [["Indicator", "Ticker", "Measure", "Period", "Value", "Unit"]];
  for (const view of [chartView, ...(chartView.second ? [chartView.second] : [])]) {
    const item = view.item;
    for (const point of view.rows) {
      if (point.value === null || !Number.isFinite(Number(point.value))) continue;
      const value = item.chart_value_style === "decimal2" ? Number(point.value).toFixed(2) : point.value;
      rows.push([item.title, item.ticker, item.chart_label || item.title, point.period, value, item.chart_unit || item.unit]);
    }
  }
  const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = rows.map(row => row.map(quote).join(",")).join("\r\n");
  downloadChartBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), "csv");
}
