let chartView = null;

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
  const digits = Math.min(12, Math.max(2, customDigits, Math.ceil(-Math.log10(high - low)) + 2));
  return { rows, low, high, digits };
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
  const available = exportPoints(item).filter(point => point.value !== null && Number.isFinite(Number(point.value)));
  for (const id of ["chart-from", "chart-to"]) {
    $(id).min = available.length ? periodBounds(available[0], item.frequency_code)[0] : "";
    $(id).max = available.length ? periodBounds(available[available.length - 1], item.frequency_code)[1] : "";
  }
  resetChartAxes();
  $("trend-dialog").showModal();
}

function resetChartAxes() {
  const rows = activeChartItem.history || [];
  $("chart-from").value = rows.length ? periodBounds(rows[0], activeChartItem.frequency_code)[0] : "";
  $("chart-to").value = rows.length ? periodBounds(rows[rows.length - 1], activeChartItem.frequency_code)[1] : "";
  $("chart-min").value = "";
  $("chart-max").value = "";
  applyChartAxes();
}

function applyChartAxes(event) {
  if (event) event.preventDefault();
  try {
    chartView = chartRange(activeChartItem, {
      from: $("chart-from").value, to: $("chart-to").value,
      low: $("chart-min").value, high: $("chart-max").value,
    });
    const rows = chartView.rows;
    $("trend-subtitle").textContent = `${activeChartItem.frequency} · ${activeChartItem.chart_label || activeChartItem.title} (${activeChartItem.chart_unit || activeChartItem.unit}) · ${fmtPeriod(rows[0].period)}–${fmtPeriod(rows[rows.length - 1].period)}`;
    drawTrend(activeChartItem);
    enableChartExports(true);
    chartMessage("Leave Y limits blank for automatic scaling. Monthly and quarterly observations overlap the selected dates.");
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
  const { rows, low, high, digits } = chartView;
  const width = 900, height = 390, margin = { top: 20, right: 22, bottom: 54, left: 92 };
  const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
  const x = index => margin.left + index * plotW / Math.max(rows.length - 1, 1);
  const y = value => margin.top + (high - value) * plotH / (high - low);
  const valueStyle = item.chart_value_style || (Math.abs(high - low) > 100 ? "decimal0" : "decimal1");
  for (let tick = 0; tick <= 4; tick++) {
    const value = high - (high - low) * tick / 4, yy = y(value);
    svg.append(svgNode("line", { x1: margin.left, x2: width - margin.right, y1: yy, y2: yy, class: "grid-line" }));
    const label = new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: valueStyle === "decimal2" ? 2 : 0 }).format(value);
    svg.append(svgNode("text", { x: margin.left - 10, y: yy + 4, "text-anchor": "end" }, label));
  }
  const tickCount = Math.min(6, rows.length);
  for (let tick = 0; tick < tickCount; tick++) {
    const index = Math.round(tick * (rows.length - 1) / Math.max(tickCount - 1, 1));
    svg.append(svgNode("text", { x: x(index), y: height - 20, "text-anchor": tick === 0 ? "start" : tick === tickCount - 1 ? "end" : "middle" }, fmtPeriod(rows[index].period)));
  }
  const defs = svgNode("defs"), clip = svgNode("clipPath", { id: "chart-plot-clip" });
  clip.append(svgNode("rect", { x: margin.left, y: margin.top, width: plotW, height: plotH }));
  defs.append(clip); svg.append(defs);
  const plot = svgNode("g", { "clip-path": "url(#chart-plot-clip)" });
  let path = "", drawing = false;
  rows.forEach((point, index) => {
    const value = Number(point.value);
    if (point.value === null || !Number.isFinite(value)) { drawing = false; return; }
    path += `${drawing ? " L" : " M"} ${x(index)} ${y(value)}`; drawing = true;
  });
  plot.append(svgNode("path", { d: path.trim(), class: "series-line" }));
  const lastIndex = rows.length - 1, lastValue = Number(rows[lastIndex].value);
  if (rows[lastIndex].value !== null && Number.isFinite(lastValue)) {
    plot.append(svgNode("circle", { cx: x(lastIndex), cy: y(lastValue), r: 5, class: "latest-point" }));
  }
  rows.forEach((point, index) => {
    if (point.value === null || !Number.isFinite(Number(point.value))) return;
    const circle = svgNode("circle", { cx: x(index), cy: y(Number(point.value)), r: 8, class: "hover-target" });
    circle.append(svgNode("title", {}, `${fmtPeriod(point.period)}: ${fmt(point.value, valueStyle)} ${item.chart_unit || item.unit}`));
    plot.append(circle);
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
  const item = activeChartItem;
  const rows = [["Indicator", "Ticker", "Measure", "Period", "Value", "Unit"]];
  for (const point of chartView.rows) {
    if (point.value === null || !Number.isFinite(Number(point.value))) continue;
    const value = item.chart_value_style === "decimal2" ? Number(point.value).toFixed(2) : point.value;
    rows.push([item.title, item.ticker, item.chart_label || item.title, point.period, value, item.chart_unit || item.unit]);
  }
  const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = rows.map(row => row.map(quote).join(",")).join("\r\n");
  downloadChartBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), "csv");
}
