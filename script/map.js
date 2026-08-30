const perspectives = [
    {
        id: "commons",
        title: "Governing the Commons",
        author: "Ostrom, 1990",
        discipline: "Economics",
        accent: "#68d391",
        x: 927,
        y: 356,
        type: "book",
        visual: "cover",
        note: "How communities develop durable institutions for governing shared resources.",
    },
    {
        id: "multilevel",
        title: "Multilevel selection theory",
        author: "Wilson, 1975",
        discipline: "Evolutionary Biology",
        accent: "#f6ad55",
        x: 315,
        y: 513,
        visual: "multilevel",
        note: "Selection can operate within groups and between groups at the same time.",
    },
    {
        id: "interdependence",
        title: "Interdependence theory",
        author: "Thibaut & Kelley, 1959; Kelley & Thibaut, 1978",
        discipline: "Social Psychology",
        accent: "#67e8f9",
        x: 608,
        y: 446,
        visual: "interdependence",
        note: "How each person’s outcomes depend on both partners’ choices and on the structure of their situation.",
    },
    {
        id: "modernization",
        title: "Modernization, Cultural Change, and Democracy",
        author: "Inglehart & Welzel, 2005",
        discipline: "Political Science",
        accent: "#63b3ed",
        x: 306,
        y: 63,
        type: "book",
        visual: "modernization",
        note: "Socioeconomic development, value change, and democratic institutions form a linked trajectory.",
    },
    {
        id: "values",
        title: "Cultural value dimensions",
        author: "Schwartz, 2006, 2008, 2011; Gelfand, 2006; Hofstede, 1980s",
        discipline: "Cultural Psychology",
        accent: "#c4b5fd",
        x: 612,
        y: 72,
        visual: "values",
        note: "A culture-level lens on shared value priorities and dimensions of societal variation.",
    },
    {
        id: "individual-differences",
        title: "Individual differences in personality traits, values, and ideologies",
        author: "HEXACO, Ashton & Lee, 2004; Schwartz, 2011; etc.",
        discipline: "Personality Psychology",
        accent: "#f9a8d4",
        x: 18,
        y: 450,
        visual: "personality",
        note: "A person-level lens on recurring differences in traits, motivational priorities, and ideological orientation.",
    },
];

const connections = [
    { from: "commons", to: "multilevel", label: "collective action across levels", bend: -522 },
    { from: "modernization", to: "values", label: "culture and values", bend: -306 },
    { from: "modernization", to: "multilevel", label: "cultural evolution", bend: -72 },
    { from: "values", to: "individual-differences", label: "cultural ↔ individual variation", bend: -126 },
    { from: "modernization", to: "individual-differences", label: "value change and individual differences", bend: 225 },
    { from: "multilevel", to: "interdependence", label: "interdependence across levels", bend: -288 },
    { from: "interdependence", to: "commons", label: "mutual dependence and cooperation", bend: 540 },
    { from: "modernization", to: "commons", label: "institutions and development", bend: 144 },
];

const canvas = document.querySelector("#knowledge-map-canvas");
const nodeLayer = document.querySelector("#knowledge-map-nodes");
const edgeLayer = document.querySelector("#knowledge-map-edges");
const nodeElements = new Map();

function multilevelFigure() {
    return `
        <svg viewBox="0 0 300 168" role="img" aria-label="Selection within and between groups">
            <defs><marker id="map-arrow-orange" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#f6ad55"/></marker></defs>
            <g fill="none" stroke="#f6ad55" stroke-opacity=".55" stroke-width="2">
                <circle cx="78" cy="82" r="47"/><circle cx="222" cy="82" r="47"/>
            </g>
            <g fill="#fed7aa">
                <circle cx="58" cy="65" r="9"/><circle cx="91" cy="58" r="9"/><circle cx="74" cy="96" r="9"/><circle cx="104" cy="101" r="9"/>
            </g>
            <g fill="#f6ad55">
                <circle cx="202" cy="65" r="9"/><circle cx="235" cy="58" r="9"/><circle cx="218" cy="96" r="9"/><circle cx="248" cy="101" r="9"/>
            </g>
            <path d="M128 82H170" stroke="#f6ad55" stroke-width="2" marker-end="url(#map-arrow-orange)"/>
            <text x="78" y="148" text-anchor="middle">within groups</text>
            <text x="222" y="148" text-anchor="middle">between groups</text>
        </svg>`;
}

function modernizationFigure() {
    return `
        <svg viewBox="0 0 300 168" role="img" aria-label="Development, values, and democracy pathway">
            <defs><marker id="map-arrow-blue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#63b3ed"/></marker></defs>
            <path d="M42 127C89 118 101 78 146 78S209 39 258 35" fill="none" stroke="#63b3ed" stroke-width="4" marker-end="url(#map-arrow-blue)"/>
            <circle cx="48" cy="126" r="8" fill="#bee3f8"/><circle cx="146" cy="78" r="8" fill="#90cdf4"/><circle cx="254" cy="36" r="8" fill="#63b3ed"/>
            <text x="48" y="151" text-anchor="middle">development</text>
            <text x="146" y="104" text-anchor="middle">values</text>
            <text x="250" y="18" text-anchor="middle">democracy</text>
        </svg>`;
}

function valuesFigure() {
    return `
        <svg viewBox="0 0 300 168" role="img" aria-label="Circular map of cultural value dimensions">
            <g transform="translate(150 82)">
                <circle r="59" fill="none" stroke="#c4b5fd" stroke-opacity=".28" stroke-width="21"/>
                <path d="M0-59A59 59 0 0 1 59 0" fill="none" stroke="#a78bfa" stroke-width="21"/>
                <path d="M59 0A59 59 0 0 1 0 59" fill="none" stroke="#818cf8" stroke-width="21"/>
                <path d="M0 59A59 59 0 0 1-59 0" fill="none" stroke="#c4b5fd" stroke-width="21"/>
                <path d="M-59 0A59 59 0 0 1 0-59" fill="none" stroke="#e9d5ff" stroke-width="21"/>
                <circle r="32" fill="#162135" stroke="#c4b5fd" stroke-opacity=".5"/>
                <text y="-4" text-anchor="middle">cultural</text><text y="13" text-anchor="middle">dimensions</text>
            </g>
        </svg>`;
}

function personalityFigure() {
    return `
        <svg viewBox="0 0 300 168" role="img" aria-label="Individual differences across traits, values, and ideologies">
            <g transform="translate(150 82)">
                <path d="M0-61L53-31L53 31L0 61L-53 31L-53-31Z" fill="rgba(249,168,212,.08)" stroke="#f9a8d4" stroke-opacity=".55" stroke-width="2"/>
                <path d="M0-46L34-20L41 24L0 42L-31 18L-44-26Z" fill="rgba(249,168,212,.25)" stroke="#f9a8d4" stroke-width="2"/>
                <g stroke="#f9a8d4" stroke-opacity=".28">
                    <path d="M0 0V-61M0 0L53-31M0 0L53 31M0 0V61M0 0L-53 31M0 0L-53-31"/>
                </g>
                <g fill="#fbcfe8">
                    <circle cy="-46" r="4"/><circle cx="34" cy="-20" r="4"/><circle cx="41" cy="24" r="4"/>
                    <circle cy="42" r="4"/><circle cx="-31" cy="18" r="4"/><circle cx="-44" cy="-26" r="4"/>
                </g>
            </g>
            <text x="150" y="15" text-anchor="middle">traits</text>
            <text x="250" y="86" text-anchor="middle">values</text>
            <text x="52" y="86" text-anchor="middle">ideologies</text>
        </svg>`;
}

function interdependenceFigure() {
    return `
        <svg viewBox="0 0 300 168" role="img" aria-label="Two people's choices jointly determine their outcomes">
            <defs><marker id="map-arrow-cyan" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#67e8f9"/></marker></defs>
            <g fill="#cffafe" stroke="#67e8f9" stroke-width="2">
                <circle cx="46" cy="55" r="20"/><circle cx="46" cy="116" r="20"/>
            </g>
            <text x="46" y="59" text-anchor="middle" style="fill:#0f172a">A</text>
            <text x="46" y="120" text-anchor="middle" style="fill:#0f172a">B</text>
            <g stroke="#67e8f9" stroke-width="2" fill="none" marker-end="url(#map-arrow-cyan)">
                <path d="M69 55C91 55 91 67 111 67"/><path d="M69 116C91 116 91 101 111 101"/>
            </g>
            <g transform="translate(119 31)" fill="none" stroke="#67e8f9" stroke-opacity=".72">
                <rect width="132" height="106" rx="7"/><path d="M66 0V106M0 53H132"/>
            </g>
            <g fill="#dbeafe" font-size="11" text-anchor="middle">
                <text x="152" y="62">3, 3</text><text x="218" y="62">1, 4</text>
                <text x="152" y="115">4, 1</text><text x="218" y="115">2, 2</text>
            </g>
            <text x="185" y="154" text-anchor="middle">joint outcomes</text>
        </svg>`;
}

function nodeVisual(node) {
    if (node.visual === "cover") {
        return `<img src="./assets/map-governing-commons.svg" alt="Custom cover for Governing the Commons">`;
    }
    if (node.visual === "multilevel") return multilevelFigure();
    if (node.visual === "modernization") return modernizationFigure();
    if (node.visual === "personality") return personalityFigure();
    if (node.visual === "interdependence") return interdependenceFigure();
    return valuesFigure();
}

function createNode(node) {
    const article = document.createElement("article");
    article.className = "knowledge-node";
    article.dataset.nodeId = node.id;
    article.style.setProperty("--node-accent", node.accent);
    article.style.left = `${node.x}px`;
    article.style.top = `${node.y}px`;
    article.tabIndex = 0;
    article.innerHTML = `
        <div class="knowledge-node-grip" title="Drag to rearrange" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="knowledge-node-visual">${nodeVisual(node)}</div>
        <div class="knowledge-node-copy">
            <p class="knowledge-node-discipline">${node.discipline}</p>
            <h3${node.type === "book" ? " class=\"is-book\"" : ""}>${node.title}</h3>
            <p class="knowledge-node-author">${node.author}</p>
            <p class="knowledge-node-note">${node.note}</p>
        </div>`;
    nodeLayer.append(article);
    nodeElements.set(node.id, article);
    enableDragging(article, node);
}

function nodeCenter(id) {
    const element = nodeElements.get(id);
    return {
        x: element.offsetLeft + element.offsetWidth / 2,
        y: element.offsetTop + element.offsetHeight / 2,
    };
}

function updateEdges() {
    edgeLayer.setAttribute("viewBox", `0 0 ${canvas.offsetWidth} ${canvas.offsetHeight}`);
    edgeLayer.replaceChildren();
    connections.forEach((connection) => {
        const start = nodeCenter(connection.from);
        const end = nodeCenter(connection.to);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy) || 1;
        const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const control = {
            x: midpoint.x - (dy / length) * connection.bend,
            y: midpoint.y + (dx / length) * connection.bend,
        };
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M${start.x},${start.y} Q${control.x},${control.y} ${end.x},${end.y}`);
        path.setAttribute("class", "knowledge-edge");
        edgeLayer.append(path);

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        const labelPoint = {
            x: (start.x + 2 * control.x + end.x) / 4,
            y: (start.y + 2 * control.y + end.y) / 4,
        };
        label.setAttribute("x", labelPoint.x);
        label.setAttribute("y", labelPoint.y - 9);
        label.setAttribute("class", "knowledge-edge-label");
        label.textContent = connection.label;
        edgeLayer.append(label);
    });
}

function enableDragging(element, node) {
    const grip = element.querySelector(".knowledge-node-grip");
    let activePointer = null;
    let offsetX = 0;
    let offsetY = 0;

    grip.addEventListener("pointerdown", (event) => {
        activePointer = event.pointerId;
        const bounds = element.getBoundingClientRect();
        const canvasBounds = canvas.getBoundingClientRect();
        offsetX = event.clientX - bounds.left;
        offsetY = event.clientY - bounds.top;
        element.classList.add("is-dragging");
        grip.setPointerCapture(activePointer);
        event.preventDefault();

        function move(moveEvent) {
            if (moveEvent.pointerId !== activePointer) return;
            const x = Math.max(12, Math.min(canvas.offsetWidth - element.offsetWidth - 12, moveEvent.clientX - canvasBounds.left - offsetX));
            const y = Math.max(12, Math.min(canvas.offsetHeight - element.offsetHeight - 12, moveEvent.clientY - canvasBounds.top - offsetY));
            node.x = x;
            node.y = y;
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
            updateEdges();
        }

        function end(endEvent) {
            if (endEvent.pointerId !== activePointer) return;
            element.classList.remove("is-dragging");
            grip.releasePointerCapture(activePointer);
            activePointer = null;
            grip.removeEventListener("pointermove", move);
            grip.removeEventListener("pointerup", end);
            grip.removeEventListener("pointercancel", end);
        }

        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", end);
        grip.addEventListener("pointercancel", end);
    });
}

perspectives.forEach(createNode);
updateEdges();
window.addEventListener("load", updateEdges);
window.addEventListener("resize", updateEdges);
