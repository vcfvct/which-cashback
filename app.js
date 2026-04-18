const appRoot = document.querySelector("#app");
const listTemplate = document.querySelector("#list-template");
const detailTemplate = document.querySelector("#detail-template");

let store = null;

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

async function loadCards() {
  const response = await fetch("./cards.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to load cards.json (${response.status})`);
  }

  const data = await response.json();

  if (!Array.isArray(data.cards) || !Array.isArray(data.rotating_categories)) {
    throw new Error("cards.json is missing required arrays.");
  }

  return data;
}

function parseRoute() {
  const hash = window.location.hash || "#/";
  const match = hash.match(/^#\/card\/([^/]+)$/);
  return match ? { view: "detail", cardId: decodeURIComponent(match[1]) } : { view: "list" };
}

function formatDateRange(entry) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(new Date(`${entry.start_date}T00:00:00`))} - ${formatter.format(
    new Date(`${entry.end_date}T00:00:00`)
  )}`;
}

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRotatingState(cardId, rotatingCategories) {
  const todayKey = getTodayKey();
  const entries = rotatingCategories
    .filter((entry) => entry.card_id === cardId)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const current = entries.find((entry) => {
    return entry.start_date <= todayKey && todayKey <= entry.end_date;
  }) || null;

  const upcoming = entries.filter((entry) => entry.start_date > todayKey);

  return { current, upcoming };
}

function createTagList(items, emptyMessage) {
  if (!items.length) {
    const paragraph = document.createElement("p");
    paragraph.className = "placeholder-copy";
    paragraph.textContent = emptyMessage;
    return paragraph;
  }

  const list = document.createElement("ul");
  list.className = "tag-list";

  items.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.className = "tag";
    listItem.textContent = item;
    list.append(listItem);
  });

  return list;
}

function formatRotatingCategories(categories) {
  return categories;
}

function getHomeSummary(card) {
  if (card.has_rotating) {
    const { current } = getRotatingState(card.id, store.rotating_categories);

    return {
      title: current ? `Current 5% Categories: Q${current.quarter} ${current.year}` : "Current 5% Categories",
      items: current ? formatRotatingCategories(current.categories) : [],
      emptyMessage: "No active rotating categories.",
    };
  }

  if (card.permanent_categories.length) {
    return {
      title: "Top Categories",
      items: card.permanent_categories,
      emptyMessage: "No permanent cashback categories listed.",
    };
  }

  return {
    title: "Base Rate",
    items: card.base_rates,
    emptyMessage: "No base rates listed.",
  };
}

function getDetailSummary(card) {
  if (card.has_rotating) {
    const rotatingState = getRotatingState(card.id, store.rotating_categories);

    if (rotatingState.current) {
      return `5% rotating cashback card with live Q${rotatingState.current.quarter} ${rotatingState.current.year} categories and ${pluralize(rotatingState.upcoming.length, "upcoming quarter")}.`;
    }

    return `5% rotating cashback card with no active quarter right now and ${pluralize(rotatingState.upcoming.length, "upcoming quarter")}.`;
  }

  if (card.permanent_categories.length) {
    return `Fixed rewards card featuring ${pluralize(card.permanent_categories.length, "bonus category")} plus a standard base earn rate.`;
  }

  return "Straightforward flat-rate style card with no listed bonus categories.";
}

function getOverviewContent(card) {
  const rotatingState = card.has_rotating ? getRotatingState(card.id, store.rotating_categories) : null;
  const rewardModel = card.has_rotating
    ? rotatingState.current
      ? "5% rotating rewards, active now"
      : "5% rotating rewards"
    : card.permanent_categories.length
      ? "Fixed bonus categories"
      : "Flat everyday rewards";
  const baseHighlight = card.base_rates[0] || "No base rate listed";
  const topCategory = card.has_rotating
    ? rotatingState?.current?.categories[0]
      ? rotatingState.current.categories[0]
      : "Awaiting next quarter"
    : card.permanent_categories[0] || "General purchases";

  return { rewardModel, baseHighlight, topCategory };
}

function renderList() {
  const fragment = listTemplate.content.cloneNode(true);
  const cardList = fragment.querySelector("[data-card-list]");
  const listSummary = fragment.querySelector("[data-list-summary]");

  const rotatingCards = store.cards.filter((card) => card.has_rotating).length;
  listSummary.textContent = `${pluralize(store.cards.length, "card")} total, ${pluralize(rotatingCards, "rotating card")}.`;

  store.cards.forEach((card) => {
    const link = document.createElement("a");
    link.className = `card-link ${card.has_rotating ? "card-link-rotating" : "card-link-fixed"}`;
    link.href = `#/card/${encodeURIComponent(card.id)}`;

    const rotatingState = getRotatingState(card.id, store.rotating_categories);
    const activeLabel = card.has_rotating
      ? rotatingState.current
        ? `Active Q${rotatingState.current.quarter} ${rotatingState.current.year}`
        : "No active rotating offer"
      : "No rotating categories";
    const summary = getHomeSummary(card);

    const issuer = document.createElement("p");
    issuer.className = "section-kicker";
    issuer.textContent = card.issuer;

    const name = document.createElement("h3");
    name.textContent = card.name;

    const statusRow = document.createElement("div");
    statusRow.className = "chip-row";

    const cardType = document.createElement("span");
    cardType.className = `chip card-type-chip ${card.has_rotating ? "card-type-chip-rotating" : "card-type-chip-fixed"}`;
    cardType.textContent = card.has_rotating ? "Rotating" : "Fixed";

    const currentStatus = document.createElement("span");
    currentStatus.className = `chip card-status-chip ${card.has_rotating ? "card-status-chip-rotating" : "card-status-chip-fixed"}`;
    currentStatus.textContent = activeLabel;

    statusRow.append(cardType, currentStatus);

    const summaryTitle = document.createElement("p");
    summaryTitle.className = "card-summary-title";
    summaryTitle.textContent = summary.title;

    const summaryContent = createTagList(summary.items, summary.emptyMessage);

    link.append(issuer, name, statusRow, summaryTitle, summaryContent);

    cardList.append(link);
  });

  appRoot.replaceChildren(fragment);
}

function renderCurrentQuarter(entry) {
  const wrapper = document.createElement("section");
  wrapper.className = "quarter-card";
  wrapper.innerHTML = `
    <h4>Current 5% Quarter: Q${entry.quarter} ${entry.year}</h4>
    <p class="quarter-range">${formatDateRange(entry)}</p>
  `;
  wrapper.append(createTagList(formatRotatingCategories(entry.categories), "No categories listed."));
  return wrapper;
}

function renderUpcoming(entries) {
  const wrapper = document.createElement("section");
  wrapper.className = "upcoming-list";

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "placeholder-copy";
    empty.textContent = "No upcoming rotating categories scheduled.";
    wrapper.append(empty);
    return wrapper;
  }

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "upcoming-card";
    card.innerHTML = `
      <h4>Upcoming 5% Quarter: Q${entry.quarter} ${entry.year}</h4>
      <p class="quarter-range">${formatDateRange(entry)}</p>
    `;
    card.append(createTagList(formatRotatingCategories(entry.categories), "No categories listed."));
    wrapper.append(card);
  });

  return wrapper;
}

function renderRotatingContent(card) {
  const fragment = document.createDocumentFragment();

  if (!card.has_rotating) {
    const copy = document.createElement("p");
    copy.className = "placeholder-copy";
    copy.textContent = "This card does not use rotating categories.";
    fragment.append(copy);
    return { fragment, status: "Fixed rewards", active: false };
  }

  const { current, upcoming } = getRotatingState(card.id, store.rotating_categories);

  if (current) {
    fragment.append(renderCurrentQuarter(current));
  } else {
    const empty = document.createElement("p");
    empty.className = "placeholder-copy";
    empty.textContent = "No active rotating categories.";
    fragment.append(empty);
  }

  const upcomingHeading = document.createElement("h4");
  upcomingHeading.textContent = "Upcoming Categories";
  upcomingHeading.style.margin = current ? "24px 0 0" : "20px 0 0";
  fragment.append(upcomingHeading, renderUpcoming(upcoming));

  return {
    fragment,
    status: current ? `Active Q${current.quarter}` : "No active quarter",
    active: Boolean(current),
  };
}

function renderDetail(cardId) {
  const card = store.cards.find((entry) => entry.id === cardId);

  if (!card) {
    renderError(`Card '${cardId}' was not found.`);
    return;
  }

  const fragment = detailTemplate.content.cloneNode(true);
  fragment.querySelector("[data-issuer]").textContent = card.issuer;
  fragment.querySelector("[data-card-name]").textContent = card.name;
  fragment.querySelector("[data-card-summary]").textContent = getDetailSummary(card);

  const baseRates = fragment.querySelector("[data-base-rates]");
  const permanentCategories = fragment.querySelector("[data-permanent-categories]");
  const rotatingStatus = fragment.querySelector("[data-rotating-status]");
  const rotatingContent = fragment.querySelector("[data-rotating-content]");
  const rewardModel = fragment.querySelector("[data-reward-model]");
  const baseHighlight = fragment.querySelector("[data-base-highlight]");
  const topCategory = fragment.querySelector("[data-top-category]");

  const overview = getOverviewContent(card);
  rewardModel.textContent = overview.rewardModel;
  baseHighlight.textContent = overview.baseHighlight;
  topCategory.textContent = overview.topCategory;

  baseRates.replaceWith(createTagList(card.base_rates, "No base rates listed."));
  permanentCategories.replaceWith(
    createTagList(card.permanent_categories, "No permanent cashback categories listed.")
  );

  const rotatingState = renderRotatingContent(card);
  rotatingStatus.textContent = rotatingState.status;
  rotatingStatus.classList.toggle("active", rotatingState.active);
  rotatingContent.append(rotatingState.fragment);

  appRoot.replaceChildren(fragment);
}

function renderError(message) {
  const panel = document.createElement("section");
  panel.className = "panel error-panel";
  panel.innerHTML = `<p>${message}</p>`;
  appRoot.replaceChildren(panel);
}

function renderApp() {
  if (!store) {
    return;
  }

  const route = parseRoute();

  if (route.view === "detail") {
    renderDetail(route.cardId);
    return;
  }

  renderList();
}

async function init() {
  try {
    store = await loadCards();
    renderApp();
    window.addEventListener("hashchange", renderApp);
  } catch (error) {
    renderError(error instanceof Error ? error.message : "Unable to load card data.");
  }
}

init();
