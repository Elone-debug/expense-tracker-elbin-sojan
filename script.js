const CATS = {
    income: ["Salary", "Freelance", "Investment", "Gift", "Other Income"],
    expense: ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Others"]
};

const COLORS = {
    Food: "#ffffff",
    Transport: "#8ec5ff",
    Shopping: "#ffd84d",
    Bills: "#ff7eb6",
    Entertainment: "#6ee7d0",
    Others: "#8be36a"
};

const $ = id => document.getElementById(id);

const money = n =>
    "₹" + Number(n).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

const today = () => new Date().toISOString().slice(0, 10);

const esc = s =>
    String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

const sum = list => list.reduce((a, t) => a + t.amount, 0);


// ---------------- STORAGE ----------------

function load(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
    } catch (e) {
        return fallback;
    }
}

function save(key, val) {
    try {
        localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
}

let data = load("et_tx_v2", []);
let budget = load("et_budget_v2", 0);

let type = "income";
let attempted = false;
let lastId = null;


// ---------------- TOAST ----------------

function toast(msg, kind = "success") {
    const el = document.createElement("div");

    el.className = "alert alert-" + kind + " shadow py-2 mb-2";
    el.textContent = msg;

    $("toasts").appendChild(el);

    setTimeout(() => el.remove(), 2600);
}


// ---------------- MODAL ----------------

const openModal = html => {
    $("mbox").innerHTML = html;

    bootstrap.Modal
        .getOrCreateInstance($("modal"))
        .show();
};

const closeModal = () => {
    bootstrap.Modal
        .getOrCreateInstance($("modal"))
        .hide();
};

const catOptions = (t, sel) =>
    '<option value="">Select category</option>' +
    CATS[t]
        .map(c => `<option${c === sel ? " selected" : ""}>${c}</option>`)
        .join("");


// ---------------- VALIDATION ----------------

function clearErrors() {
    document
        .querySelectorAll(".is-invalid")
        .forEach(e => e.classList.remove("is-invalid"));

    document
        .querySelectorAll(".invalid-feedback")
        .forEach(e => e.textContent = "");
}

function fail(field, errId, msg) {
    $(field).classList.add("is-invalid");
    $(errId).textContent = msg;
    return false;
}

function validate(p = "") {
    clearErrors();

    let ok = true;

    const f = n => $(p + n);
    const e = n => p + n;

    const amt = f("amount").value.trim();

    if (amt === "") {
        ok = fail(
            e("amount"),
            e("eAmount"),
            "Please enter an amount."
        );
    } else if (isNaN(Number(amt))) {
        ok = fail(
            e("amount"),
            e("eAmount"),
            "Amount must be a valid number."
        );
    } else if (Number(amt) <= 0) {
        ok = fail(
            e("amount"),
            e("eAmount"),
            "Amount must be greater than 0."
        );
    } else if (!/^\d+(\.\d{1,2})?$/.test(amt)) {
        ok = fail(
            e("amount"),
            e("eAmount"),
            "Use at most 2 decimal places (e.g. 250.50)."
        );
    } else if (Number(amt) > 100000000) {
        ok = fail(
            e("amount"),
            e("eAmount"),
            "Amount is too large (max ₹10,00,00,000)."
        );
    }

    if (!f("category").value) {
        ok = fail(
            e("category"),
            e("eCategory"),
            "Please choose a category."
        );
    }

    const d = f("date").value;

    if (!d) {
        ok = fail(
            e("date"),
            e("eDate"),
            "Please pick a date."
        );
    } else if (d > today()) {
        ok = fail(
            e("date"),
            e("eDate"),
            "Date cannot be in the future."
        );
    } else if (d < "2000-01-01") {
        ok = fail(
            e("date"),
            e("eDate"),
            "Date is too old (before year 2000)."
        );
    }

    const desc = f("desc").value.trim();

    if (desc.length < 2) {
        ok = fail(
            e("desc"),
            e("eDesc"),
            "Description must be at least 2 characters."
        );
    } else if (desc.length > 40) {
        ok = fail(
            e("desc"),
            e("eDesc"),
            "Description can be at most 40 characters."
        );
    }

    return ok;
}


// ---------------- ADD TRANSACTION ----------------

function setType(t) {
    type = t;

    $("bInc").classList.toggle("on", t === "income");
    $("bExp").classList.toggle("on", t === "expense");

    $("save").classList.toggle("exp", t === "expense");

    $("category").innerHTML = catOptions(t);

    $("desc").placeholder =
        t === "income"
            ? "e.g. Monthly salary"
            : "e.g. Lunch at cafe";

    $("save").textContent =
        t === "income"
            ? "Add Income"
            : "Add Expense";

    clearErrors();
}

const openPicker = id => {
    const el = $(id);

    el.focus();

    try {
        el.showPicker();
    } catch (e) {}
};

$("calBtn").onclick = () => openPicker("date");

$("date").onclick = () => openPicker("date");

$("bInc").onclick = () => setType("income");

$("bExp").onclick = () => setType("expense");

["amount", "category", "date", "desc"].forEach(id => {
    $(id).addEventListener("input", () => {
        if (attempted) {
            validate();
        }
    });
});

$("save").onclick = () => {
    attempted = true;

    if (!validate()) {
        return;
    }

    const item = {
        id: Date.now(),
        type: type,
        amount: Number($("amount").value),
        category: $("category").value,
        date: $("date").value,
        desc: $("desc").value.trim()
    };

    data.unshift(item);

    lastId = item.id;

    save("et_tx_v2", data);

    attempted = false;

    $("amount").value = "";
    $("desc").value = "";
    $("date").value = today();

    setType(type);

    render();

    toast(
        (item.type === "income" ? "Income" : "Expense") +
        " of " +
        money(item.amount) +
        " added ✓"
    );
};


// ---------------- EDIT TRANSACTION ----------------

function edit(id) {
    const t = data.find(x => x.id === id);

    if (!t) {
        return;
    }

    let mType = t.type;

    openModal(`
        <h2>Edit Transaction</h2>

        <div class="toggle mb-2">
            <button type="button" id="mInc" class="btn">
                Income
            </button>

            <button type="button" id="mExp" class="btn exp">
                Expense
            </button>
        </div>

        <div class="mb-2">
            <label class="form-label small text-secondary mb-1">
                Amount (₹)
            </label>

            <input
                id="m_amount"
                type="number"
                step="0.01"
                class="form-control"
                value="${t.amount}"
            >

            <div class="invalid-feedback" id="m_eAmount"></div>
        </div>

        <div class="mb-2">
            <label class="form-label small text-secondary mb-1">
                Category
            </label>

            <select id="m_category" class="form-select"></select>

            <div class="invalid-feedback" id="m_eCategory"></div>
        </div>

        <div class="mb-2">
            <label class="form-label small text-secondary mb-1">
                Date
            </label>

            <div class="input-group has-validation">
                <input
                    id="m_date"
                    type="date"
                    max="${today()}"
                    class="form-control"
                    value="${t.date}"
                >

                <button
                    type="button"
                    class="btn btn-light border"
                    id="mCal"
                    title="Open calendar"
                >
                    📅
                </button>

                <div class="invalid-feedback" id="m_eDate"></div>
            </div>
        </div>

        <div class="mb-3">
            <label class="form-label small text-secondary mb-1">
                Description
            </label>

            <input
                id="m_desc"
                maxlength="40"
                class="form-control"
                value="${esc(t.desc)}"
            >

            <div class="invalid-feedback" id="m_eDesc"></div>
        </div>

        <div class="d-flex gap-2">
            <button
                class="btn btn-outline-secondary flex-fill"
                id="mCancel"
            >
                Cancel
            </button>

            <button
                class="btn btn-main flex-fill"
                id="mSave"
            >
                Save Changes
            </button>
        </div>
    `);

    const setM = (ty, keep) => {
        mType = ty;

        $("mInc").classList.toggle("on", ty === "income");
        $("mExp").classList.toggle("on", ty === "expense");

        $("mSave").classList.toggle("exp", ty === "expense");

        $("m_category").innerHTML = catOptions(ty, keep);
    };

    setM(t.type, t.category);

    $("mCal").onclick = () => openPicker("m_date");

    $("m_date").onclick = () => openPicker("m_date");

    $("mInc").onclick = () => setM("income");

    $("mExp").onclick = () => setM("expense");

    $("mCancel").onclick = closeModal;

    $("mSave").onclick = () => {
        if (!validate("m_")) {
            return;
        }

        data = data.map(x =>
            x.id === id
                ? {
                    ...x,
                    type: mType,
                    amount: Number($("m_amount").value),
                    category: $("m_category").value,
                    date: $("m_date").value,
                    desc: $("m_desc").value.trim()
                }
                : x
        );

        save("et_tx_v2", data);

        lastId = id;

        closeModal();

        render();

        toast("Transaction updated ✓");
    };
}


// ---------------- DELETE TRANSACTION ----------------

function del(id) {
    const t = data.find(x => x.id === id);

    if (!t) {
        return;
    }

    openModal(`
        <h2>Delete transaction?</h2>

        <p>
            ${esc(t.desc)}
            (${money(t.amount)})
            will be removed.
        </p>

        <div class="d-flex gap-2">
            <button
                class="btn btn-outline-secondary flex-fill"
                id="dNo"
            >
                Cancel
            </button>

            <button
                class="btn btn-danger flex-fill"
                id="dYes"
            >
                Delete
            </button>
        </div>
    `);

    $("dNo").onclick = closeModal;

    $("dYes").onclick = () => {
        data = data.filter(x => x.id !== id);

        save("et_tx_v2", data);

        closeModal();

        render();

        toast("Transaction deleted", "secondary");
    };
}

$("rows").onclick = e => {
    const b = e.target.closest("button[data-act]");

    if (!b) {
        return;
    }

    const id = Number(b.dataset.id);

    if (b.dataset.act === "edit") {
        edit(id);
    } else {
        del(id);
    }
};


// ---------------- MAIN RENDER ----------------

function render() {
    const incL = data.filter(t => t.type === "income");
    const expL = data.filter(t => t.type === "expense");

    const inc = sum(incL);
    const exp = sum(expL);

    $("tIncome").textContent = money(inc);
    $("tExpense").textContent = money(exp);
    $("tBalance").textContent = money(inc - exp);

    $("tBalance").style.color =
        inc - exp < 0 ? "var(--red)" : "";

    $("sIncome").textContent =
        incL.length
            ? incL.length + " income " +
              (incL.length > 1 ? "entries" : "entry")
            : "No income added yet";

    $("sExpense").textContent =
        expL.length
            ? expL.length + " expense " +
              (expL.length > 1 ? "entries" : "entry")
            : "No expenses added yet";

    $("sBalance").textContent =
        !data.length
            ? "Add a transaction to begin"
            : inc - exp < 0
                ? "You are overspending"
                : "Income minus expenses";

    renderOverview();
    renderTrend();
    renderTable();
}


// ---------------- EXPENSE OVERVIEW ----------------

function renderOverview() {
    const month = today().slice(0, 7);

    const all = $("period").value === "all";

    const list = data.filter(t =>
        t.type === "expense" &&
        (all || t.date.startsWith(month))
    );

    const total = sum(list);
    const has = list.length > 0;

    $("ovEmpty").classList.toggle("d-none", has);
    $("ovData").classList.toggle("d-none", !has);

    $("ovMsg").innerHTML =
        data.some(t => t.type === "expense")
            ? "No expenses this month.<br>Choose “All Time” or add a new expense."
            : "No expense data yet.<br>Add an expense to see your category chart.";

    if (!has) {
        return;
    }

    const by = {};

    list.forEach(t => {
        by[t.category] = (by[t.category] || 0) + t.amount;
    });

    const cats = Object.keys(by).sort(
        (a, b) => by[b] - by[a]
    );

    let start = 0;

    const stops = [];

    cats.forEach(c => {
        const p = by[c] / total * 100;

        stops.push(
            `${COLORS[c] || "#ccc"} ${start}% ${start + p}%`
        );

        start += p;
    });

    $("donut").style.background =
        `conic-gradient(${stops.join(",")})`;

    $("legend").innerHTML = cats
        .map(c => `
            <div>
                <span>
                    <span
                        class="dot"
                        style="background:${COLORS[c] || "#ccc"}"
                    ></span>
                    ${esc(c)}
                </span>

                <span>
                    ${Math.round(by[c] / total * 100)}%
                    · ${money(by[c])}
                </span>
            </div>
        `)
        .join("");

    $("pct").textContent =
        budget > 0
            ? Math.round(total / budget * 100) + "%"
            : "—";

    $("spent").textContent = money(total);

    $("budgetTxt").textContent =
        budget > 0
            ? "of " + money(budget) + " budget (tap to edit)"
            : "Tap to set a budget";
}

$("period").onchange = renderOverview;


// ---------------- BUDGET ----------------

$("budgetBtn").onclick = () => {
    openModal(`
        <h2>Set budget</h2>

        <input
            id="b_val"
            type="number"
            class="form-control"
            placeholder="e.g. 20000"
            value="${budget || ""}"
        >

        <div class="invalid-feedback" id="b_err"></div>

        <div class="d-flex gap-2 mt-3">
            <button
                class="btn btn-outline-secondary flex-fill"
                id="bNo"
            >
                Cancel
            </button>

            <button
                class="btn btn-main flex-fill"
                id="bYes"
            >
                Save
            </button>
        </div>
    `);

    $("bNo").onclick = closeModal;

    $("bYes").onclick = () => {
        const n = Number($("b_val").value);

        if (!(n > 0) || n > 100000000) {
            $("b_val").classList.add("is-invalid");
            $("b_err").textContent =
                "Enter an amount greater than 0.";
            return;
        }

        budget = n;

        save("et_budget_v2", n);

        closeModal();

        renderOverview();
    };
};


// ---------------- MONTHLY TREND ----------------

function renderTrend() {
    $("trEmpty").classList.toggle(
        "d-none",
        data.length > 0
    );

    $("trData").classList.toggle(
        "d-none",
        !data.length
    );

    if (!data.length) {
        return;
    }

    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
        const d = new Date(
            now.getFullYear(),
            now.getMonth() - i,
            1
        );

        const key =
            d.getFullYear() +
            "-" +
            String(d.getMonth() + 1).padStart(2, "0");

        const m = data.filter(t =>
            t.date.startsWith(key)
        );

        months.push({
            label: d.toLocaleString("en", {
                month: "short"
            }),
            inc: sum(
                m.filter(t => t.type === "income")
            ),
            exp: sum(
                m.filter(t => t.type === "expense")
            )
        });
    }

    const max = Math.max(
        1,
        ...months.map(m =>
            Math.max(m.inc, m.exp)
        )
    );

    $("bars").innerHTML = months
        .map(m => `
            <div class="grp">
                <div class="pair">
                    <i
                        style="height:${m.inc / max * 100}%;background:var(--green)"
                        title="Income ${money(m.inc)}"
                    ></i>

                    <i
                        style="height:${m.exp / max * 100}%;background:#ff7b95"
                        title="Expense ${money(m.exp)}"
                    ></i>
                </div>
            </div>
        `)
        .join("");

    $("mon").innerHTML = months
        .map(m => `<span>${m.label}</span>`)
        .join("");

    $("trInc").textContent =
        money(sum(months.map(m => ({
            amount: m.inc
        }))));

    $("trExp").textContent =
        money(sum(months.map(m => ({
            amount: m.exp
        }))));
}


// ---------------- TRANSACTION TABLE ----------------

function renderTable() {
    const q = $("search").value.trim().toLowerCase();
    const typeFilter = $("typeFilter").value;
    const categoryFilter = $("categoryFilter").value;

    const list = data
        .filter(t => {

            const matchesSearch =
                !q ||
                (t.desc + t.category + t.type)
                    .toLowerCase()
                    .includes(q);

            const matchesType =
                typeFilter === "all" ||
                t.type === typeFilter;

            const matchesCategory =
                categoryFilter === "all" ||
                t.category === categoryFilter;

            return (
                matchesSearch &&
                matchesType &&
                matchesCategory
            );
        })
        .sort(
            (a, b) =>
                b.date.localeCompare(a.date) ||
                b.id - a.id
        );

    if (!list.length) {
        $("rows").innerHTML = `
            <tr>
                <td colspan="6" class="empty-box">
                    <span class="big"> <i class="bi bi-list-columns-reverse"></i></span>
                    ${
                        data.length
                            ? "No transactions match your filters."
                            : "No transactions yet.<br>Use the form above to add your first income or expense."
                    }
                </td>
            </tr>
        `;

        return;
    }

    $("rows").innerHTML = list
        .map(t => `
            <tr class="${t.id === lastId ? "flash" : ""}">

                <td>${t.date}</td>

                <td>${esc(t.desc)}</td>

                <td>${esc(t.category)}</td>

                <td>
                    <span class="badge tag ${t.type}">
                        ${t.type === "income" ? "Income" : "Expense"}
                    </span>
                </td>

                <td class="${t.type === "income" ? "plus" : "minus"}">
                    ${t.type === "income" ? "+" : "-"}
                    ${money(t.amount)}
                </td>

                <td class="act">

                    <button
                        data-act="edit"
                        data-id="${t.id}"
                        title="Edit"
                    >
                        <i class="bi bi-pencil-square text-primary"></i>
                    </button>

                    <button
                        data-act="del"
                        data-id="${t.id}"
                        title="Delete"
                    >
                        <i class="bi bi-trash text-danger"></i>
                    </button>

                </td>

            </tr>
        `)
        .join("");
}


// Filter events

$("typeFilter").onchange = renderTable;

$("categoryFilter").onchange = renderTable;

$("search").oninput = renderTable;

// ---------------- INITIALIZE ----------------

$("date").max = today();
$("date").value = today();

setType("income");
render();