const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-Wpsuef1T_Furukaxfg6eQZRk4jeGMk4TCoYCgrJ7ONWo7Xa5IZ3zLO64jIE3pzt4rn-hySxqsvkY/pub?output=csv&single=true";

let documents = [];

// GLOBAL FILTER STATE
let activeTag = null;
let activeCategory = null;
let searchQuery = "";
let expandedCategories = new Set();

// ================= LOAD =================
async function loadDocs() {
    try {
        const res = await fetch(SHEET_URL + "&t=" + Date.now());
        const text = await res.text();

        const rows = text
            .split("\n")
            .slice(1)
            .filter(r => r.trim());

        documents = rows.map(r => {
            const c = r.split(",");

            return {
                title: c[0]?.trim(),
                category: c[1]?.trim(),
                tags: c[2] ? c[2].split(";").map(t => t.trim()) : [],
                description: c[3]?.trim(),
                url: c[4]?.trim(),
                status: (c[5] || "active").trim().toLowerCase()
            };
        })
            .filter(d => d.title && d.category && d.url)
            .filter(d => d.status === "active");

        applyFilters();

    } catch (err) {
        console.error(err);
        document.getElementById("results").innerHTML = "Failed to load data.";
    }
}

// ================= FILTERING =================
function applyFilters() {
    let filtered = documents;

    // SEARCH
    if (searchQuery) {
        const q = searchQuery.toLowerCase();

        filtered = filtered.map(doc => {
            let score = 0;

            if (doc.title.toLowerCase().includes(q)) score += 5;
            if (doc.tags.some(t => t.toLowerCase().includes(q))) score += 3;
            if (doc.description?.toLowerCase().includes(q)) score += 1;

            return { doc, score };
        })
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(x => x.doc);
    }

    // TAG
    if (activeTag) {
        filtered = filtered.filter(d => d.tags.includes(activeTag));
    }

    // CATEGORY (supports nesting)
    if (activeCategory) {
        filtered = filtered.filter(d =>
            d.category.startsWith(activeCategory)
        );
    }

    renderNav(documents);
    renderResults(filtered);
    renderBreadcrumb();
}

// ================= NAV =================
function groupNested(docs) {
    const tree = {};

    docs.forEach(doc => {
        const parts = doc.category.split("/");
        let current = tree;

        parts.forEach(part => {
            if (!current[part]) current[part] = {};
            current = current[part];
        });

        if (!current._docs) current._docs = [];
        current._docs.push(doc);
    });

    return tree;
}

function renderNav(docs) {
    const nav = document.getElementById("nav");
    nav.innerHTML = "";

    const tree = groupNested(docs);

    function renderNode(node, container, path = "") {
        Object.keys(node).forEach(key => {
            if (key === "_docs") return;

            const fullPath = path ? path + "/" + key : key;

            const wrapper = document.createElement("div");

            // header row
            const header = document.createElement("div");
            header.style.display = "flex";
            header.style.alignItems = "center";
            header.style.cursor = "pointer";

            // toggle icon
            const toggle = document.createElement("span");
            toggle.style.marginRight = "6px";

            // label
            const label = document.createElement("span");
            label.textContent = key;

            if (activeCategory === fullPath) {
                label.style.fontWeight = "bold";
            }

            header.appendChild(toggle);
            header.appendChild(label);
            wrapper.appendChild(header);

            // child container
            const child = document.createElement("div");
            child.className = "category";

            const isOpen = expandedCategories.has(fullPath);
            child.style.display = isOpen ? "block" : "none";
            toggle.textContent = isOpen ? "▼" : "▶";

            wrapper.appendChild(child);

            // render children
            renderNode(node[key], child, fullPath);

            // render docs
            if (node[key]._docs) {
                node[key]._docs.forEach(doc => {
                    const link = document.createElement("div");
                    link.className = "doc-link";
                    link.textContent = doc.title;
                    link.onclick = () => openDoc(doc);
                    child.appendChild(link);
                });
            }

            container.appendChild(wrapper);
        });
    }

    renderNode(tree, nav);
}

// ================= RESULTS =================
function renderResults(docs) {
    const results = document.getElementById("results");
    results.innerHTML = "";

    docs.forEach(doc => {
        const div = document.createElement("div");
        div.className = "doc-card";

        div.innerHTML = `
            <h3>${doc.title}</h3>
            <p>${doc.description || ""}</p>
            ${doc.tags.map(t => `<span class="tag">${t}</span>`).join("")}
        `;

        div.onclick = () => openDoc(doc);

        div.querySelectorAll(".tag").forEach(tagEl => {
            tagEl.onclick = (e) => {
                e.stopPropagation();
                activeTag = tagEl.textContent;
                applyFilters();
            };
        });

        results.appendChild(div);
    });
}

// ================= DOCUMENT VIEW =================
function openDoc(doc) {
    const related = findRelated(doc);

    document.getElementById("viewer").innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2>${doc.title}</h2>
            <button onclick="closeDoc()">✖ Close</button>
        </div>

        <p>${doc.description || ""}</p>
        ${doc.tags.map(t => `<span class="tag">${t}</span>`).join("")}

        <iframe src="${doc.url}"></iframe>

        <h3>Related Documents</h3>
        ${related.map(r => `<div class="doc-link related">${r.title}</div>`).join("")}
    `;

    document.querySelectorAll(".related").forEach((el, i) => {
        el.onclick = () => openDoc(related[i]);
    });
}

function closeDoc() {
    document.getElementById("viewer").innerHTML = `
        <p>Select a document to view it here.</p>
    `;
}

// ================= RELATED =================
function findRelated(doc) {
    return documents
        .filter(d => d !== doc)
        .map(d => ({
            doc: d,
            score: d.tags.filter(t => doc.tags.includes(t)).length
        }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(x => x.doc);
}

// ================= BREADCRUMB =================
function renderBreadcrumb() {
    let container = document.getElementById("breadcrumb");

    if (!container) {
        container = document.createElement("div");
        container.id = "breadcrumb";
        document.querySelector("main").prepend(container);
    }

    container.innerHTML = "";

    // HOME
    const home = document.createElement("span");
    home.textContent = "Home";
    home.style.cursor = "pointer";
    home.onclick = () => {
        activeCategory = null;
        activeTag = null;
        applyFilters();
    };
    container.appendChild(home);

    // CATEGORY PATH
    if (activeCategory) {
        const parts = activeCategory.split("/");

        let path = "";

        parts.forEach(part => {
            container.append(" > ");

            path = path ? path + "/" + part : part;

            const el = document.createElement("span");
            el.textContent = part;
            el.style.cursor = "pointer";

            el.onclick = () => {
                activeCategory = path;
                applyFilters();
            };

            container.appendChild(el);
        });
    }

    // TAG
    if (activeTag) {
        container.append(" > ");

        const tag = document.createElement("span");
        tag.textContent = "Tag: " + activeTag;
        tag.style.cursor = "pointer";

        tag.onclick = () => {
            activeTag = null;
            applyFilters();
        };

        container.appendChild(tag);
    }

    // RESET BUTTON
    const btn = document.createElement("button");
    btn.textContent = "Reset";
    btn.style.marginLeft = "10px";
    btn.onclick = clearFilters;

    container.appendChild(btn);
}

// ================= RESET =================
function clearFilters() {
    activeTag = null;
    activeCategory = null;
    searchQuery = "";
    document.getElementById("search").value = "";
    applyFilters();
}

// ================= EVENTS =================
document.getElementById("search").addEventListener("input", e => {
    searchQuery = e.target.value;
    applyFilters();
});

// auto refresh
// setInterval(loadDocs, 60000);

// start
loadDocs();