let chartView = null;

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
  $("chart-right-min").value = ""; $("chart-right-max").value = "";
  $("chart-right-decimals").value = "";
  if (item) fillChartMeasures(item, "combo-measure");
  applyChartAxes();
}

function chartRange(item, options) {
  if (!options.from || !options.to || options.from > options.to) {
    throw new Error("Choose a valid date range with From on or before To.");
  }
  const rows = exportPoints(item).filter(point => {
    const [start, end] = periodBounds(point, item.frequency_code);
    return end >= options.from && start <= options.to;
  });
  const values = rows.filter(point => point.value !== null && Number.isFinite(Number(point.value))).map(point => Number(point.value));
  if (!values.length) throw new Error("No observations are available in this date range.");
  let low = Math.min(...values), high = Math.max(...values);
  const pad = (high - low || Math.max(Math.abs(high), 1)) * .09;
  low -= pad; high += pad;
  if (options.low !== "") low = Number(options.low);
  if (options.high !== "") high = Number(options.high);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low >= high || !Number.isFinite(high - low)) {
    throw new Error("Y-axis minimum must be a finite number below the maximum.");
  }
  const customDigits = [options.low, options.high].reduce((digits, value) => Math.max(digits, (String(value).split(".")[1] || "").length), 0);
  const digits = Math.min(3, Math.max(2, customDigits, Math.ceil(-Math.log10(high - low)) + 2));
  const decimals = options.decimals === undefined || options.decimals === "" ? null : Number(options.decimals);
  if (decimals !== null && (!Number.isInteger(decimals) || decimals < 0 || decimals > 3)) {
    throw new Error("Decimal places must be a whole number from 0 to 3, or blank for Auto.");
  }
  return { rows, low, high, digits, decimals };
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
  applyChartAxes();
}

function applyChartAxes(event) {
  if (event) event.preventDefault();
  try {
    const item = chartMeasureItem(activeChartItem);
    chartView = chartRange(item, {
      from: $("chart-from").value, to: $("chart-to").value,
      low: $("chart-min").value, high: $("chart-max").value,
      decimals: $("chart-decimals").value,
    });
    chartView.item = item;
    if ($("combo-indicator").value) {
      const other = snapshot?.indicators?.[$("combo-indicator").value];
      if (!other || other.id === item.id) throw new Error("Choose a different available indicator.");
      const secondItem = chartMeasureItem(other, "combo-measure");
      const second = chartRange(secondItem, {
        from: $("chart-from").value, to: $("chart-to").value,
        low: $("chart-right-min").value, high: $("chart-right-max").value,
        decimals: $("chart-right-decimals").value,
      });
      second.item = secondItem;
      chartView.second = second;
    }
    const rows = chartView.rows;
    $("trend-title").textContent = chartView.second ? "Combo chart" : activeChartItem.title;
    $("trend-subtitle").textContent = `${item.frequency} · ${item.chart_label || item.title} (${item.chart_unit || item.unit}) · ${fmtPeriod(rows[0].period)}–${fmtPeriod(rows[rows.length - 1].period)}`;
    if (chartView.second) $("trend-subtitle").textContent = `${$("chart-from").value} to ${$("chart-to").value} · Two indicators with independent left/right scales`;
    drawTrend(item);
    enableChartExports(true);
    const description = activeChartItem.chart_measures?.[$("chart-measure").value]?.description || "";
    const secondDescription = chartView.second ? ` ${snapshot.indicators[$("combo-indicator").value].chart_measures?.[$("combo-measure").value]?.description || ""} Combo points are aligned by period-end date, without resampling. Left and right scales differ.` : "";
    chartMessage(`${description}${secondDescription} Leave Y limits blank for automatic scaling. Monthly and quarterly observations overlap the selected dates.`);
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
  const width = 900, height = 390, margin = { top: second ? 64 : 20, right: second ? 92 : 22, bottom: 54, left: 92 };
  const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
  const date = (point, seriesItem) => Date.parse(`${periodBounds(point, seriesItem.frequency_code)[1]}T00:00:00Z`);
  const dates = second ? [...rows.map(point => date(point, item)), ...second.rows.map(point => date(point, second.item))] : [];
  const firstDate = dates.length ? Math.min(...dates) : 0, lastDate = dates.length ? Math.max(...dates) : 0;
  const x = (index, seriesRows = rows, seriesItem = item) => second
    ? margin.left + (date(seriesRows[index], seriesItem) - firstDate) * plotW / Math.max(lastDate - firstDate, 1)
    : margin.left + index * plotW / Math.max(rows.length - 1, 1);
  const y = value => margin.top + (high - value) * plotH / (high - low);
  const valueStyle = item.chart_value_style || (Math.abs(high - low) > 100 ? "decimal0" : "decimal1");
  if (second) {
    for (const [index, view] of [chartView, second].entries()) {
      const color = index ? "#86bc25" : "#43c5ca";
      svg.append(svgNode("line", { x1: 22, x2: 45, y1: 17 + index * 23, y2: 17 + index * 23, stroke: color, "stroke-width": 3 }));
      const label = `${index ? "Right" : "Left"}: ${view.item.title} | ${view.item.chart_label} (${view.item.chart_unit || view.item.unit}) | ${view.item.frequency}`;
      const attrs = { x: 54, y: 21 + index * 23, style: `fill:${color}` };
      if (label.length > 110) { attrs.textLength = 820; attrs.lengthAdjust = "spacingAndGlyphs"; }
      svg.append(svgNode("text", attrs, label));
    }
  }
  for (let tick = 0; tick <= 4; tick++) {
    const value = high - (high - low) * tick / 4, yy = y(value);
    svg.append(svgNode("line", { x1: margin.left, x2: width - margin.right, y1: yy, y2: yy, class: "grid-line" }));
    const label = axisTickLabel(value, chartView, valueStyle);
    svg.append(axisTickNode(label, { x: margin.left - 10, y: yy + 4, "text-anchor": "end" }));
    if (second) {
      const rightValue = second.high - (second.high - second.low) * tick / 4;
      const rightLabel = axisTickLabel(rightValue, second, second.item.chart_value_style);
      svg.append(axisTickNode(rightLabel, { x: width - margin.right + 12, y: yy + 4, style: "fill:#86bc25" }));
    }
  }
  const tickCount = second ? (lastDate === firstDate ? 1 : 6) : Math.min(6, rows.length);
  for (let tick = 0; tick < tickCount; tick++) {
    const index = Math.round(tick * (rows.length - 1) / Math.max(tickCount - 1, 1));
    const position = second ? margin.left + tick * plotW / Math.max(tickCount - 1, 1) : x(index);
    const label = second ? new Date(firstDate + (lastDate - firstDate) * tick / Math.max(tickCount - 1, 1)).toISOString().slice(0, 10) : rows[index].period;
    svg.append(svgNode("text", { x: position, y: height - 20, "text-anchor": tick === 0 ? "start" : tick === tickCount - 1 ? "end" : "middle" }, fmtPeriod(label)));
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
  const style = svgNode("style", {}, "#trend-chart text{fill:#b1c0b8;font:11px 'Segoe UI',Arial,sans-serif}#trend-chart .grid-line{stroke:#34443d;stroke-width:1}#trend-chart .series-line{fill:none;stroke:#43c5ca;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}#trend-chart .latest-point{fill:#b9fa38;stroke:#19221f;stroke-width:2}#trend-chart .image-title{fill:#edf4f0;font:bold 20px 'Segoe UI',Arial,sans-serif}");
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
