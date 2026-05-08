const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-Wpsuef1T_Furukaxfg6eQZRk4jeGMk4TCoYCgrJ7ONWo7Xa5IZ3zLO64jIE3pzt4rn-hySxqsvkY/pub?output=csv://docs.google.com/spreadsheets/d/1s9u8FzL_0g9XCOiWS7Swl-s3A4psghFwpOexhxBzWFc/edit?usp=sharing";

let documents = [];
let activeTag = null;

async function loadDocs() {
    const res = await fetch(SHEET_URL + "&t=" + Date.now());
    const text = await res.text();

    const rows = text.split("\n").slice(1);

    documents = rows.map(r => {
        const c = r.split(",");

        return {
            title: c[0],
            category: c[1],
            tags: c[2] ? c[2].split(";").map(t => t.trim()) : [],
            description: c[3],
            url: c[4],
            status: c[5] || "active"
        };
    }).filter(d => d.status === "active");

    renderAll(documents);
}

function renderAll(docs) {
    renderNav(docs);
    renderResults(docs);
}

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

    function renderNode(node, container) {
        Object.keys(node).forEach(key => {
            if (key === "_docs") return;

            const div = document.createElement("div");
            div.textContent = key;
            container.appendChild(div);

            const child = document.createElement("div");
            child.className = "category";
            container.appendChild(child);

            renderNode(node[key], child);

            if (node[key]._docs) {
                node[key]._docs.forEach(doc => {
                    const link = document.createElement("div");
                    link.className = "doc-link";
                    link.textContent = doc.title;
                    link.onclick = () => openDoc(doc);
                    child.appendChild(link);
                });
            }
        });
    }

    renderNode(tree, nav);
}

function renderResults(docs) {
    const results = document.getElementById("results");
    results.innerHTML = "";

    docs.forEach(doc => {
        const div = document.createElement("div");
        div.className = "doc-card";

        div.innerHTML = `
      <h3>${doc.title}</h3>
      <p>${doc.description}</p>
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

function openDoc(doc) {
    document.getElementById("results").innerHTML = "";

    const related = findRelated(doc);

    document.getElementById("viewer").innerHTML = `
    <h2>${doc.title}</h2>
    <p>${doc.description}</p>
    ${doc.tags.map(t => `<span class="tag">${t}</span>`).join("")}
    <iframe src="${doc.url}"></iframe>
    <h3>Related Documents</h3>
    ${related.map(r => `<div class="doc-link">${r.title}</div>`).join("")}
  `;

    document.querySelectorAll(".doc-link").forEach((el, i) => {
        if (related[i]) el.onclick = () => openDoc(related[i]);
    });
}

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

function applyFilters() {
    let filtered = documents;

    const q = document.getElementById("search").value.toLowerCase();

    if (q) {
        filtered = filtered.map(doc => {
            let score = 0;

            if (doc.title.toLowerCase().includes(q)) score += 5;
            if (doc.tags.some(t => t.toLowerCase().includes(q))) score += 3;
            if (doc.description.toLowerCase().includes(q)) score += 1;

            return { doc, score };
        })
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(x => x.doc);
    }

    if (activeTag) {
        filtered = filtered.filter(d => d.tags.includes(activeTag));
    }

    renderAll(filtered);
}

document.getElementById("search").addEventListener("input", applyFilters);

// auto refresh every minute
setInterval(loadDocs, 60000);

loadDocs();