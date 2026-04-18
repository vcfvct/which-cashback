const appRoot = document.querySelector("#app");
const listTemplate = document.querySelector("#list-template");
const detailTemplate = document.querySelector("#detail-template");

let store = null;

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

function getHomeSummary(card) {
  if (card.has_rotating) {
    const { current } = getRotatingState(card.id, store.rotating_categories);

    return {
      title: current ? `Current Categories: Q${current.quarter} ${current.year}` : "Current Categories",
      items: current?.categories || [],
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

function renderList() {
  const fragment = listTemplate.content.cloneNode(true);
  const cardList = fragment.querySelector("[data-card-list]");

  store.cards.forEach((card) => {
    const link = document.createElement("a");
    link.className = "card-link";
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
    cardType.className = "chip";
    cardType.textContent = card.has_rotating ? "Rotating" : "Fixed";

    const currentStatus = document.createElement("span");
    currentStatus.className = "chip";
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
    <h4>Current Quarter: Q${entry.quarter} ${entry.year}</h4>
    <p class="quarter-range">${formatDateRange(entry)}</p>
  `;
  wrapper.append(createTagList(entry.categories, "No categories listed."));
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
      <h4>Upcoming: Q${entry.quarter} ${entry.year}</h4>
      <p class="quarter-range">${formatDateRange(entry)}</p>
    `;
    card.append(createTagList(entry.categories, "No categories listed."));
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

  const baseRates = fragment.querySelector("[data-base-rates]");
  const permanentCategories = fragment.querySelector("[data-permanent-categories]");
  const rotatingStatus = fragment.querySelector("[data-rotating-status]");
  const rotatingContent = fragment.querySelector("[data-rotating-content]");

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
