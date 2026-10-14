
/* QueueLess — API Service Layer
   Local demo for the existing QueueLess HTML.
   Can be connected to AWS Lambda later.
*/

const API_BASE_URL = "https://mc4ymfb3k7kz3jmd76ubbpkwym0curyn.lambda-url.ap-south-1.on.aws";
const STORE_KEY = "queueless-demo-v1";
const ME_KEY = "queueless-demo-me";

const t = (minutes) =>
  new Date(Date.now() - minutes * 60000).toISOString();

function seed() {
  const mk = (n, name, ago, status) => ({
    id: "QL-0" + n,
    num: n,
    name,
    joinedAt: t(ago),
    status,
    mine: false,
    ahead: 0
  });

  return {
    settings: { avgMinutes: 5 },
    nextNum: 27,

    tokens: [
      mk(20, "Aarav Mehta (demo)", 50, "served"),
      mk(21, "Sofia Rossi (demo)", 42, "served"),
      mk(22, "Liam Chen (demo)", 35, "serving"),
      mk(23, "Nadia Khan (demo)", 28, "waiting"),
      mk(24, "Omar Haddad (demo)", 20, "waiting"),
      mk(25, "Emma Wilson (demo)", 12, "waiting"),
      mk(26, "Kenji Sato (demo)", 5, "waiting")
    ],

    activity: [
      { text: "QL-021 served", status: "served", at: t(8) },
      { text: "QL-022 called", status: "serving", at: t(7) },
      { text: "QL-026 joined", status: "waiting", at: t(5) }
    ]
  };
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || seed();
  } catch {
    return seed();
  }
}

let db = load();

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
}

function log(text, status) {
  db.activity.unshift({
    text,
    status,
    at: new Date().toISOString()
  });

  db.activity = db.activity.slice(0, 30);
}

const find = (id) => db.tokens.find((x) => x.id === id);
const fmt = (n) => "QL-" + String(n).padStart(3, "0");

const api = {
  async getQueue() {
    return JSON.parse(JSON.stringify(db));
  },

  async joinQueue(name) {
    name = (name || "").trim();

    if (name.length < 2) {
      throw new Error("Enter a name with at least 2 characters.");
    }

    if (
      db.tokens.some(
        (x) => x.mine && ["waiting", "serving"].includes(x.status)
      )
    ) {
      throw new Error("You already have an active token.");
    }

    const tok = {
      id: fmt(db.nextNum),
      num: db.nextNum++,
      name,
      joinedAt: new Date().toISOString(),
      status: "waiting",
      mine: true,
      ahead: db.tokens.filter((x) => x.status === "waiting").length
    };

    db.tokens.push(tok);
    log(tok.id + " joined", "waiting");
    save();

    return tok;
  },

  async cancelToken(id) {
    const x = find(id);

    if (!x || x.status !== "waiting") {
      throw new Error("Only waiting tokens can be cancelled.");
    }

    x.status = "cancelled";
    log(id + " cancelled", "cancelled");
    save();

    return x;
  },

  async callNextToken() {
    if (db.tokens.some((x) => x.status === "serving")) {
      throw new Error(
        "Mark the current token as served or skip it first."
      );
    }

    const n = db.tokens
      .filter((x) => x.status === "waiting")
      .sort((a, b) => a.num - b.num)[0];

    if (!n) {
      throw new Error("No one is waiting.");
    }

    n.status = "serving";
    log(n.id + " called", "serving");
    save();

    return n;
  },

  async markTokenServed(id) {
    const x = find(id);

    if (!x || x.status !== "serving") {
      throw new Error("That token is not being served.");
    }

    x.status = "served";
    log(id + " served", "served");
    save();

    return x;
  },

  async skipToken(id) {
    const x = find(id);

    if (!x || !["waiting", "serving"].includes(x.status)) {
      throw new Error("That token cannot be skipped.");
    }

    x.status = "skipped";
    log(id + " skipped", "skipped");
    save();

    return x;
  },

  async updateSettings(avg) {
    avg = +avg;

    if (!(avg >= 1 && avg <= 120)) {
      throw new Error("Enter 1–120 minutes.");
    }

    db.settings.avgMinutes = avg;
    save();
  },

  async resetDemo() {
    db = seed();
    save();
  }
};

// Expose the service for use by the frontend
window.api = api;
window.QueueLessConfig = { API_BASE_URL, STORE_KEY, ME_KEY };

// Notify other tabs when this tab changes the queue
window.addEventListener("storage", (event) => {
  if (event.key === STORE_KEY) {
    db = load();
    window.dispatchEvent(new CustomEvent("queueless:updated"));
  }
});
