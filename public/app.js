"use strict";

const HISTORY_KEY = "advancedSerpHistoryV2";
const SETTINGS_KEY = "advancedSerpSettingsV2";
const API_KEY_STORAGE = "serperApiKey";
const MAX_HISTORY = 12;

const state = {
  hasServerKey: false,
  report: null,
  rows: [],
  filteredRows: [],
  history: [],
  previousReport: null
};

const countries = {
  ae: "United Arab Emirates",
  au: "Australia",
  br: "Brazil",
  ca: "Canada",
  de: "Germany",
  es: "Spain",
  fr: "France",
  gb: "United Kingdom",
  in: "India",
  it: "Italy",
  jp: "Japan",
  mx: "Mexico",
  nl: "Netherlands",
  pk: "Pakistan",
  sa: "Saudi Arabia",
  sg: "Singapore",
  us: "United States"
};

const featureMap = {
  aiOverview: "AI overview",
  answerBox: "Answer box",
  images: "Images",
  knowledgeGraph: "Knowledge graph",
  peopleAlsoAsk: "People also ask",
  places: "Local pack",
  relatedSearches: "Related searches",
  shopping: "Shopping",
  topStories: "Top stories",
  videos: "Videos"
};

const elements = {
  form: document.querySelector("#searchForm"),
  keyword: document.querySelector("#keyword"),
  country: document.querySelector("#country"),
  language: document.querySelector("#language"),
  device: document.querySelector("#device"),
  location: document.querySelector("#location"),
  resultCount: document.querySelector("#resultCount"),
  dateFilter: document.querySelector("#dateFilter"),
  autocorrect: document.querySelector("#autocorrect"),
  apiKey: document.querySelector("#apiKey"),
  rememberKey: document.querySelector("#rememberKey"),
  apiSettings: document.querySelector("#apiSettings"),
  keyStatus: document.querySelector("#keyStatus"),
  lookupButton: document.querySelector("#lookupButton"),
  resultTitle: document.querySelector("#resultTitle"),
  metaLine: document.querySelector("#metaLine"),
  coverageCount: document.querySelector("#coverageCount"),
  coverageNote: document.querySelector("#coverageNote"),
  domainCount: document.querySelector("#domainCount"),
  featureCount: document.querySelector("#featureCount"),
  adCount: document.querySelector("#adCount"),
  creditCount: document.querySelector("#creditCount"),
  filterInput: document.querySelector("#filterInput"),
  domainInput: document.querySelector("#domainInput"),
  typeFilter: document.querySelector("#typeFilter"),
  sortOrder: document.querySelector("#sortOrder"),
  clearFilters: document.querySelector("#clearFilters"),
  rankInput: document.querySelector("#rankInput"),
  rankBox: document.querySelector("#rankBox"),
  domainList: document.querySelector("#domainList"),
  topDomainLabel: document.querySelector("#topDomainLabel"),
  historyList: document.querySelector("#historyList"),
  clearHistory: document.querySelector("#clearHistory"),
  featureList: document.querySelector("#featureList"),
  visibleCount: document.querySelector("#visibleCount"),
  comparisonNote: document.querySelector("#comparisonNote"),
  resultsList: document.querySelector("#resultsList"),
  openGoogle: document.querySelector("#openGoogle"),
  shareLink: document.querySelector("#shareLink"),
  exportCsv: document.querySelector("#exportCsv"),
  exportJson: document.querySelector("#exportJson"),
  toast: document.querySelector("#toast")
};

init();

async function init() {
  restoreLocalState();
  bindEvents();
  hydrateFromUrl();
  renderHistory();
  await checkHealth();
}

function bindEvents() {
  elements.form.addEventListener("submit", function (event) {
    event.preventDefault();
    runSearch();
  });

  [elements.filterInput, elements.domainInput].forEach(function (input) {
    input.addEventListener("input", applyFilters);
  });
  [elements.typeFilter, elements.sortOrder].forEach(function (select) {
    select.addEventListener("change", applyFilters);
  });

  elements.rankInput.addEventListener("input", updateRankTracker);
  elements.apiKey.addEventListener("input", updateKeyStatus);
  elements.apiKey.addEventListener("change", saveApiKeyPreference);
  elements.rememberKey.addEventListener("change", saveApiKeyPreference);
  elements.clearFilters.addEventListener("click", resetFilters);
  elements.clearHistory.addEventListener("click", clearHistory);
  elements.openGoogle.addEventListener("click", openGooglePage);
  elements.shareLink.addEventListener("click", shareSearch);
  elements.exportCsv.addEventListener("click", exportCsv);
  elements.exportJson.addEventListener("click", exportJson);

  elements.historyList.addEventListener("click", function (event) {
    const button = event.target.closest("[data-history-id]");
    if (button) {
      loadHistory(button.dataset.historyId);
    }
  });

  elements.resultsList.addEventListener("click", function (event) {
    const button = event.target.closest("[data-copy-url]");
    if (button) {
      copyText(button.dataset.copyUrl, "Result URL copied.");
    }
  });
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
    const health = await response.json();
    state.hasServerKey = Boolean(health.hasServerKey);
  } catch {
    state.hasServerKey = false;
  }
  updateKeyStatus();
  if (state.hasServerKey) {
    elements.apiSettings.open = false;
  }
}

function updateKeyStatus() {
  const hasLocalKey = Boolean(elements.apiKey.value.trim());
  if (state.hasServerKey) {
    setStatus("Server key ready", true);
  } else if (hasLocalKey) {
    setStatus("Browser key ready", true);
  } else {
    setStatus("API key needed", false);
  }
}

function setStatus(label, ready) {
  elements.keyStatus.textContent = label;
  elements.keyStatus.className = ready ? "status-pill ready" : "status-pill";
}

async function runSearch() {
  const payload = buildPayload();
  if (!payload.q) {
    showToast("Enter a keyword first.");
    elements.keyword.focus();
    return;
  }
  if (!state.hasServerKey && !elements.apiKey.value.trim()) {
    elements.apiSettings.open = true;
    elements.apiKey.focus();
    showToast("Add a Serper API key to run this search.");
    return;
  }

  saveSettings(payload);
  saveApiKeyPreference();
  state.previousReport = findPreviousReport(signatureFor(payload));
  setLoading(true);
  renderLoading(payload.num);

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Serper-Key": elements.apiKey.value.trim()
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(errorMessage(data));
    }

    const rows = normalizeRows(data.data);
    const report = {
      id: makeId(),
      savedAt: Date.now(),
      fetchedAt: data.fetchedAt,
      requestId: data.requestId,
      request: data.request,
      coverage: data.coverage || { requested: payload.num, returned: rows.filter(isOrganic).length },
      features: extractFeatures(data.data),
      rows: rows
    };

    state.report = report;
    state.rows = addMovement(rows, state.previousReport);
    state.report.rows = state.rows;
    storeReport(state.report);
    updateUrl(payload);
    renderReport();
    showToast("Loaded " + report.coverage.returned + " organic results.");
  } catch (error) {
    renderError(error.message);
    showToast(error.message);
  } finally {
    setLoading(false);
  }
}

function buildPayload() {
  return {
    q: elements.keyword.value.trim(),
    gl: elements.country.value,
    hl: elements.language.value,
    device: elements.device.value,
    location: elements.location.value.trim() || "Anywhere",
    num: Number(elements.resultCount.value),
    tbs: elements.dateFilter.value,
    autocorrect: elements.autocorrect.checked
  };
}

function normalizeRows(data) {
  const rows = [];

  (data.ads || []).forEach(function (item, index) {
    rows.push(normalizeItem(item, index + 1, true));
  });

  (data.organic || []).forEach(function (item, index) {
    const position = positiveInteger(item.position) || index + 1;
    rows.push(normalizeItem(item, position, false));
  });

  return rows.sort(function (a, b) {
    if (a.isAd !== b.isAd) {
      return a.isAd ? -1 : 1;
    }
    return a.position - b.position;
  });
}

function normalizeItem(item, position, isAd) {
  const link = safeUrl(item.link || item.url || "");
  return {
    id: makeId(),
    position: position,
    page: positiveInteger(item.page) || (isAd ? 1 : Math.ceil(position / 10)),
    sourcePosition: item.sourcePosition ?? null,
    type: isAd ? "Ad" : "Organic",
    isAd: isAd,
    title: item.title || item.name || "Untitled result",
    link: link,
    canonical: canonicalUrl(link),
    domain: getDomain(link),
    snippet: item.snippet || item.description || "",
    sitelinks: Array.isArray(item.sitelinks) ? item.sitelinks.length : 0,
    delta: null,
    isNew: false
  };
}

function addMovement(rows, previousReport) {
  if (!previousReport) {
    return rows;
  }

  const previousPositions = new Map();
  previousReport.rows.filter(isOrganic).forEach(function (row) {
    previousPositions.set(row.canonical || canonicalUrl(row.link), row.position);
  });

  return rows.map(function (row) {
    if (row.isAd) {
      return row;
    }
    const previous = previousPositions.get(row.canonical);
    return {
      ...row,
      delta: previous === undefined ? null : previous - row.position,
      isNew: previous === undefined
    };
  });
}

function renderReport() {
  updateSummary();
  renderFeatures();
  renderDomainAnalysis();
  applyFilters();
  updateRankTracker();
  renderHistory();
}

function updateSummary() {
  const report = state.report;
  const request = report.request;
  const organicRows = state.rows.filter(isOrganic);
  const domains = countDomains(organicRows);
  const returned = report.coverage.returned ?? organicRows.length;
  const requested = report.coverage.requested ?? request.num;
  const complete = returned >= requested;

  elements.resultTitle.textContent = 'Results for "' + request.q + '"';
  elements.metaLine.replaceChildren();
  [
    titleCase(request.device || "desktop"),
    (countries[request.gl] || request.gl.toUpperCase()) + " (" + request.hl + ")",
    request.location || "Anywhere",
    "Updated " + formatDate(report.fetchedAt)
  ].forEach(function (label) {
    const span = document.createElement("span");
    span.textContent = label;
    elements.metaLine.appendChild(span);
  });

  elements.coverageCount.textContent = returned + " / " + requested;
  elements.coverageCount.className = complete ? "positive" : "warning";
  elements.coverageNote.textContent = complete ? "Requested coverage loaded" : "Provider returned fewer unique URLs";
  elements.domainCount.textContent = String(domains.size);
  elements.featureCount.textContent = String(report.features.length);
  elements.adCount.textContent = String(state.rows.filter(function (row) { return row.isAd; }).length);
  elements.creditCount.textContent = String(request.creditsUsed || (request.fetchedPages || []).length || 1);

  if (state.previousReport) {
    elements.comparisonNote.textContent = "Compared with " + formatDate(state.previousReport.fetchedAt || state.previousReport.savedAt) + ".";
  } else {
    elements.comparisonNote.textContent = "No earlier matching report for movement comparison.";
  }
}

function extractFeatures(data) {
  return Object.entries(featureMap).reduce(function (features, entry) {
    const key = entry[0];
    const name = entry[1];
    const value = data[key];
    if (Array.isArray(value) && value.length) {
      features.push({ name: name, count: value.length });
    } else if (value && !Array.isArray(value)) {
      features.push({ name: name, count: 1 });
    }
    return features;
  }, []);
}

function renderFeatures() {
  elements.featureList.replaceChildren();
  if (!state.report.features.length) {
    const empty = document.createElement("span");
    empty.className = "feature-empty";
    empty.textContent = "No page-one SERP features detected";
    elements.featureList.appendChild(empty);
    return;
  }

  state.report.features.forEach(function (feature) {
    const chip = document.createElement("span");
    chip.className = "feature-chip";
    chip.textContent = feature.name + " " + feature.count;
    elements.featureList.appendChild(chip);
  });
}

function renderDomainAnalysis() {
  const domains = Array.from(countDomains(state.rows.filter(isOrganic)).values())
    .sort(function (a, b) {
      return b.count - a.count || a.best - b.best;
    })
    .slice(0, 6);

  elements.domainList.replaceChildren();
  elements.topDomainLabel.textContent = countDomains(state.rows.filter(isOrganic)).size + " domains";

  if (!domains.length) {
    elements.domainList.innerHTML = '<p class="muted-copy">No organic domains in this report.</p>';
    return;
  }

  const maxCount = domains[0].count;
  domains.forEach(function (item) {
    const wrapper = document.createElement("div");
    wrapper.className = "domain-item";
    wrapper.innerHTML =
      "<strong>" + escapeHtml(item.domain) + "</strong>" +
      "<span>" + item.count + " results, best #" + item.best + "</span>" +
      '<div class="domain-bar"><i style="width:' + Math.max(8, Math.round(item.count / maxCount * 100)) + '%"></i></div>';
    elements.domainList.appendChild(wrapper);
  });
}

function countDomains(rows) {
  const map = new Map();
  rows.forEach(function (row) {
    if (!row.domain) {
      return;
    }
    const existing = map.get(row.domain) || { domain: row.domain, count: 0, best: row.position };
    existing.count += 1;
    existing.best = Math.min(existing.best, row.position);
    map.set(row.domain, existing);
  });
  return map;
}

function applyFilters() {
  const text = elements.filterInput.value.trim().toLowerCase();
  const domain = normalizeTarget(elements.domainInput.value);
  const type = elements.typeFilter.value;
  const sort = elements.sortOrder.value;

  state.filteredRows = state.rows.filter(function (row) {
    const searchable = (row.title + " " + row.link + " " + row.snippet).toLowerCase();
    const textMatch = !text || searchable.includes(text);
    const domainMatch = !domain || normalizeTarget(row.domain).includes(domain);
    const typeMatch = type === "all" || (type === "ad" ? row.isAd : !row.isAd);
    return textMatch && domainMatch && typeMatch;
  });

  state.filteredRows.sort(function (a, b) {
    if (sort === "domain") {
      return a.domain.localeCompare(b.domain) || a.position - b.position;
    }
    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }
    if (a.isAd !== b.isAd) {
      return a.isAd ? -1 : 1;
    }
    return a.position - b.position;
  });

  renderRows(state.filteredRows);
  elements.visibleCount.textContent = state.filteredRows.length + (state.filteredRows.length === 1 ? " result" : " results");
}

function renderRows(rows) {
  if (!rows.length) {
    elements.resultsList.innerHTML =
      '<div class="empty-state"><strong>No matching results</strong><span>Reset the filters or run another lookup.</span></div>';
    return;
  }

  elements.resultsList.innerHTML = rows.map(function (row, index) {
    const position = row.isAd ? "Ad " + row.position : String(row.position);
    const pageLabel = row.isAd ? "Sponsored" : "Page " + row.page;
    const movement = movementMarkup(row);
    const link = escapeAttribute(row.link || "#");
    const title = escapeHtml(row.title);
    const snippet = row.snippet ? '<p class="snippet">' + escapeHtml(row.snippet) + "</p>" : "";
    const sitelinks = row.sitelinks ? '<span class="badge">' + row.sitelinks + " sitelinks</span>" : "";

    return (
      '<article class="result-row" aria-label="Result ' + (index + 1) + '">' +
        '<div class="position-cell">' + position + "<small>" + pageLabel + "</small></div>" +
        '<div class="result-body">' +
          '<a class="result-title" href="' + link + '" target="_blank" rel="noopener noreferrer">' + title + "</a>" +
          '<span class="result-url">' + escapeHtml(row.link) + "</span>" +
          snippet +
          '<div class="result-meta">' +
            '<span class="badge ' + (row.isAd ? "ad" : "") + '">' + row.type + "</span>" +
            (row.domain ? '<span class="badge">' + escapeHtml(row.domain) + "</span>" : "") +
            '<span class="badge page">' + pageLabel + "</span>" +
            sitelinks +
            (row.link ? '<button class="copy-button" type="button" data-copy-url="' + link + '">Copy URL</button>' : "") +
          "</div>" +
        "</div>" +
        '<div class="movement-cell">' + movement + "</div>" +
      "</article>"
    );
  }).join("");
}

function movementMarkup(row) {
  if (row.isAd) {
    return '<span>Not tracked</span>';
  }
  if (!state.previousReport) {
    return '<span>Baseline</span>';
  }
  if (row.isNew) {
    return '<span class="new">New</span>';
  }
  if (row.delta > 0) {
    return '<span class="up">Up ' + row.delta + "</span>";
  }
  if (row.delta < 0) {
    return '<span class="down">Down ' + Math.abs(row.delta) + "</span>";
  }
  return "<span>No change</span>";
}

function updateRankTracker() {
  const rawTarget = elements.rankInput.value.trim();
  const target = normalizeTarget(rawTarget);
  elements.rankBox.className = "rank-box";

  if (!target) {
    elements.rankBox.innerHTML = "<strong>No target selected</strong><span>Enter a URL or domain to find its best position.</span>";
    return;
  }

  const targetHasPath = target.includes("/");
  const matches = state.rows.filter(isOrganic).filter(function (row) {
    const normalizedLink = normalizeTarget(row.link);
    return targetHasPath ? normalizedLink.includes(target) : normalizeTarget(row.domain) === target;
  }).sort(function (a, b) {
    return a.position - b.position;
  });

  if (!matches.length) {
    elements.rankBox.classList.add("missing");
    elements.rankBox.innerHTML =
      "<strong>Not found in loaded results</strong><span>" + escapeHtml(rawTarget) + " has no organic ranking in this report.</span>";
    return;
  }

  const best = matches[0];
  const movement = best.delta > 0 ? ", up " + best.delta : best.delta < 0 ? ", down " + Math.abs(best.delta) : best.delta === 0 ? ", unchanged" : "";
  elements.rankBox.classList.add("found");
  elements.rankBox.innerHTML =
    "<strong>Position #" + best.position + movement + "</strong>" +
    "<span>" + escapeHtml(best.domain) + " appears " + matches.length + (matches.length === 1 ? " time" : " times") + " in the organic results.</span>";
}

function resetFilters() {
  elements.filterInput.value = "";
  elements.domainInput.value = "";
  elements.typeFilter.value = "all";
  elements.sortOrder.value = "position";
  applyFilters();
}

function renderLoading(count) {
  const skeletonCount = Math.min(5, Math.max(3, Math.ceil(count / 20)));
  elements.visibleCount.textContent = "Loading results";
  elements.comparisonNote.textContent = count > 10 ? "Fetching " + Math.ceil(count / 10) + " Google result pages." : "Fetching live Google results.";
  elements.resultsList.innerHTML = Array.from({ length: skeletonCount }, function () {
    return (
      '<div class="skeleton-row" aria-hidden="true">' +
        '<div><div class="skeleton" style="width:34px"></div></div>' +
        '<div class="skeleton-stack"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>' +
      "</div>"
    );
  }).join("");
}

function renderError(message) {
  elements.resultsList.innerHTML =
    '<div class="error-state"><strong>Lookup failed</strong><span>' + escapeHtml(message) + "</span></div>";
  elements.visibleCount.textContent = "0 results";
  elements.comparisonNote.textContent = "Check the API key and search settings, then try again.";
}

function setLoading(loading) {
  elements.lookupButton.disabled = loading;
  elements.lookupButton.classList.toggle("loading", loading);
  elements.lookupButton.querySelector(".button-label").textContent = loading ? "Checking" : "Run check";
}

function storeReport(report) {
  const snapshot = {
    id: report.id,
    savedAt: report.savedAt,
    fetchedAt: report.fetchedAt,
    requestId: report.requestId,
    request: report.request,
    coverage: report.coverage,
    features: report.features,
    rows: report.rows
  };
  state.history = [snapshot].concat(state.history.filter(function (item) {
    return item.id !== snapshot.id;
  })).slice(0, MAX_HISTORY);
  writeStorage(HISTORY_KEY, state.history);
}

function findPreviousReport(signature, excludeId) {
  return state.history.find(function (item) {
    return item.id !== excludeId && signatureFor(item.request) === signature;
  }) || null;
}

function loadHistory(id) {
  const report = state.history.find(function (item) {
    return item.id === id;
  });
  if (!report) {
    return;
  }

  setFormFromRequest(report.request);
  state.previousReport = findPreviousReport(signatureFor(report.request), report.id);
  state.report = report;
  state.rows = addMovement(report.rows.map(function (row) {
    return { ...row, delta: null, isNew: false };
  }), state.previousReport);
  updateUrl(report.request);
  renderReport();
  showToast("Loaded saved report from " + formatDate(report.fetchedAt || report.savedAt) + ".");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderHistory() {
  elements.historyList.replaceChildren();
  if (!state.history.length) {
    elements.historyList.innerHTML = '<p class="muted-copy">Recent reports stay in this browser.</p>';
    return;
  }

  state.history.slice(0, 7).forEach(function (item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.dataset.historyId = item.id;
    button.innerHTML =
      "<strong>" + escapeHtml(item.request.q) + "</strong>" +
      "<span>" + escapeHtml((countries[item.request.gl] || item.request.gl.toUpperCase()) + " / " + item.request.device + " / " + formatDate(item.fetchedAt || item.savedAt)) + "</span>";
    elements.historyList.appendChild(button);
  });
}

function clearHistory() {
  state.history = [];
  state.previousReport = null;
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  if (state.report) {
    state.rows = state.rows.map(function (row) {
      return { ...row, delta: null, isNew: false };
    });
    state.report.rows = state.rows;
    renderReport();
  }
  showToast("Search history cleared.");
}

function signatureFor(request) {
  return [
    request.q || "",
    request.gl || "",
    request.hl || "",
    request.device || "",
    (request.location || "Anywhere").toLowerCase(),
    request.num || "",
    request.tbs || ""
  ].join("|").toLowerCase();
}

function openGooglePage() {
  const payload = buildPayload();
  if (!payload.q) {
    showToast("Enter a keyword first.");
    return;
  }
  const params = new URLSearchParams({
    q: payload.q,
    gl: payload.gl,
    hl: payload.hl,
    num: String(payload.num)
  });
  if (payload.location.toLowerCase() !== "anywhere") {
    params.set("near", payload.location);
  }
  window.open("https://www.google.com/search?" + params.toString(), "_blank", "noopener,noreferrer");
}

function exportCsv() {
  if (!state.filteredRows.length) {
    showToast("No results to export.");
    return;
  }
  const headers = ["position", "page", "movement", "type", "title", "url", "domain", "snippet"];
  const lines = [headers.join(",")];
  state.filteredRows.forEach(function (row) {
    const values = [
      row.isAd ? "Ad " + row.position : row.position,
      row.page,
      row.isNew ? "new" : row.delta ?? "",
      row.type,
      row.title,
      row.link,
      row.domain,
      row.snippet
    ];
    lines.push(values.map(csvCell).join(","));
  });
  downloadFile(fileBase() + ".csv", lines.join("\r\n"), "text/csv;charset=utf-8");
  showToast("CSV export created.");
}

function exportJson() {
  if (!state.report) {
    showToast("No report to export.");
    return;
  }
  const output = {
    exportedAt: new Date().toISOString(),
    request: state.report.request,
    coverage: state.report.coverage,
    features: state.report.features,
    results: state.filteredRows
  };
  downloadFile(fileBase() + ".json", JSON.stringify(output, null, 2), "application/json;charset=utf-8");
  showToast("JSON export created.");
}

function fileBase() {
  const keyword = (state.report?.request.q || elements.keyword.value || "serp-report")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return keyword + "-serp-" + new Date().toISOString().slice(0, 10);
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type: type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () {
    URL.revokeObjectURL(href);
  }, 0);
}

function shareSearch() {
  const payload = buildPayload();
  if (!payload.q) {
    showToast("Enter a keyword first.");
    return;
  }
  updateUrl(payload);
  copyText(window.location.href, "Search link copied.");
}

async function copyText(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(successMessage);
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    showToast(successMessage);
  }
}

function updateUrl(payload) {
  const params = new URLSearchParams({
    q: payload.q,
    gl: payload.gl,
    hl: payload.hl,
    device: payload.device,
    location: payload.location,
    num: String(payload.num),
    autocorrect: payload.autocorrect ? "1" : "0"
  });
  if (payload.tbs) {
    params.set("tbs", payload.tbs);
  }
  window.history.replaceState({}, "", window.location.pathname + "?" + params.toString());
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("q")) {
    return;
  }

  setIfValid(elements.keyword, params.get("q"));
  setIfValid(elements.country, params.get("gl"));
  setIfValid(elements.language, params.get("hl"));
  setIfValid(elements.device, params.get("device"));
  setIfValid(elements.location, params.get("location"));
  setIfValid(elements.resultCount, params.get("num"));
  setIfValid(elements.dateFilter, params.get("tbs"));
  elements.autocorrect.checked = params.get("autocorrect") !== "0";
  elements.resultTitle.textContent = 'Ready to check "' + elements.keyword.value + '"';
}

function restoreLocalState() {
  state.history = readStorage(HISTORY_KEY, []);
  const settings = readStorage(SETTINGS_KEY, null);
  if (settings) {
    setFormFromRequest(settings);
  }

  const savedKey = localStorage.getItem(API_KEY_STORAGE) || "";
  elements.apiKey.value = savedKey;
  elements.rememberKey.checked = Boolean(savedKey);
}

function setFormFromRequest(request) {
  setIfValid(elements.keyword, request.q);
  setIfValid(elements.country, request.gl);
  setIfValid(elements.language, request.hl);
  setIfValid(elements.device, request.device);
  setIfValid(elements.location, request.location);
  setIfValid(elements.resultCount, String(request.num || ""));
  setIfValid(elements.dateFilter, request.tbs || "");
  elements.autocorrect.checked = request.autocorrect !== false;
}

function saveSettings(payload) {
  writeStorage(SETTINGS_KEY, payload);
}

function saveApiKeyPreference() {
  const key = elements.apiKey.value.trim();
  if (elements.rememberKey.checked && key) {
    localStorage.setItem(API_KEY_STORAGE, key);
  } else {
    localStorage.removeItem(API_KEY_STORAGE);
  }
  updateKeyStatus();
}

function readStorage(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showToast("Browser storage is full; this report was not saved.");
  }
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    Array.from(url.searchParams.keys()).forEach(function (key) {
      if (/^(utm_|gclid|fbclid)/i.test(key)) {
        url.searchParams.delete(key);
      }
    });
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return url.toString();
  } catch {
    return String(value || "").toLowerCase();
  }
}

function normalizeTarget(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");
}

function getDomain(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isOrganic(row) {
  return !row.isAd;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function titleCase(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function setIfValid(element, value) {
  if (value === null || value === undefined) {
    return;
  }
  const text = String(value);
  if (element.tagName === "SELECT") {
    const exists = Array.from(element.options).some(function (option) {
      return option.value === text;
    });
    if (!exists) {
      return;
    }
  }
  element.value = text;
}

function errorMessage(data) {
  if (typeof data.detail === "string") {
    return data.detail;
  }
  if (data.detail && typeof data.detail.message === "string") {
    return data.detail.message;
  }
  return data.error || "Search failed";
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(function () {
    elements.toast.classList.remove("show");
  }, 2800);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value || "");
}

function csvCell(value) {
  return '"' + String(value ?? "").replaceAll('"', '""') + '"';
}
