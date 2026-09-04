const PASSWORD_HASH = "ebb3de8a3d9a40366132eb5deb5af44e4c96c11696f8fc34ea2c1d8bd8399171";
const lockSection = document.querySelector("#network-lock");
const contentSection = document.querySelector("#network-content");
const passwordForm = document.querySelector("#network-password-form");
const passwordInput = document.querySelector("#network-password");
const passwordMessage = document.querySelector("#network-password-message");
const lockButton = document.querySelector("#network-lock-button");
const ecologyNetwork = document.querySelector("#ecology-network");
const ecologyNetworkWrap = document.querySelector(".ecology-network-wrap");
const ecologyNodeTooltip = document.querySelector("#ecology-node-tooltip");
const ecologyYearSlider = document.querySelector("#ecology-year-slider");
const ecologyYearValue = document.querySelector("#ecology-year-value");
const ecologyNetworkStatus = document.querySelector("#ecology-network-status");

const ecologyNodes = [
    {
        id: "ranran",
        name: "Ranran Li",
        anchor: true,
        field: "psychology (personality)",
        expertise: "bridging personality psychology with criminology, behavioral economics, etc.",
        affiliation: "Max Planck Institute for the Study of Crime, Security, and Law",
    },
    {
        id: "botao-amber-hu",
        name: "Botao Amber Hu",
        knownSince: 2026,
        field: "computer science, AI, HCI",
        expertise: "Human-Computer Interaction (social computing), protocol studies, experiential futures, etc.",
        affiliation: "University of Oxford; Reality Design Lab",
    },
    { id: "matthijs-baas", name: "Matthijs Baas", knownSince: 2018, field: "", expertise: "", affiliation: "" },
    {
        id: "reinout",
        name: "Reinout E. de Vries",
        knownSince: 2020,
        field: "psychology (personality)",
        expertise: "HEXACO personality, personality assessment, psychometrics, scale development, communication styles, leadership",
        affiliation: "Vrije Universiteit Amsterdam",
    },
    {
        id: "jean-louis",
        name: "Jean-Louis van Gelder",
        knownSince: 2024,
        orbitScale: 0.48,
        field: "criminology, psychology",
        expertise: "Virtual Reality in criminology, affect and cognition, future orientation, short-term mindsets",
        affiliation: "Max Planck Institute for the Study of Crime, Security, and Law",
    },
    {
        id: "ingo",
        name: "Ingo Zettler",
        knownSince: 2024,
        field: "psychology (personality)",
        expertise: "HEXACO personality, Dark factor of personality, prosocial & antisocial behavior, cultural psychology",
        affiliation: "University of Copenhagen",
    },
    { id: "daniel-balliet", name: "Daniel Balliet", knownSince: 2020, field: "", expertise: "", affiliation: "" },
    { id: "isabel-thielmann", name: "Isabel Thielmann", knownSince: 2020, orbitScale: 1, field: "", expertise: "", affiliation: "" },
    { id: "rene-mottus", name: "René Mõttus", knownSince: 2022, orbitScale: 1, field: "", expertise: "", affiliation: "" },
    { id: "giulio-costantini", name: "Giulio Costantini", knownSince: 2022, field: "", expertise: "", affiliation: "" },
    { id: "hadas-okon-singer", name: "Hadas Okon-Singer", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "hannes-rusche", name: "Hannes Rusch", knownSince: 2024, field: "", expertise: "", affiliation: "" },
    { id: "nicholas-umashev", name: "Nicholas Umashev", knownSince: 2025, field: "", expertise: "", affiliation: "" },
    { id: "rima-maria-rahal", name: "Rima-Maria Rahal", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "lennart-reddmann", name: "Lennart Reddmann", knownSince: 2024, field: "", expertise: "", affiliation: "" },
    { id: "yixin-zou", name: "Yixin Zou", knownSince: 2026, orbitScale: 1, field: "", expertise: "", affiliation: "" },
    { id: "yijin-he", name: "Yijin He", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "yunrui-liu", name: "Yunrui Liu", knownSince: 2026, orbitScale: 0.62, field: "", expertise: "", affiliation: "" },
    { id: "lorren-tisdall", name: "Lorren Tisdall", knownSince: 2025, orbitScale: 0.62, field: "", expertise: "", affiliation: "" },
    { id: "luke-smille", name: "Luke Smille", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "joshua-wilt", name: "Joshua Wilt", knownSince: 2025, field: "", expertise: "", affiliation: "" },
    { id: "timothy-c-barnum", name: "Timothy C Barnum", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "shaina-herman", name: "Shaina Herman", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "caspar-j-van-lissa", name: "Caspar J. van Lissa", knownSince: 2025, field: "", expertise: "", affiliation: "" },
    { id: "nick-ballou", name: "Nick Ballou", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "emily-caspar", name: "Emily Caspar", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "ori-weisel", name: "Ori Weisel", knownSince: 2025, field: "", expertise: "", affiliation: "" },
    { id: "balazs-aczel", name: "Balazs Aczel", knownSince: 2025, field: "", expertise: "", affiliation: "" },
    { id: "max-knabe", name: "Max Knabe", knownSince: 2025, field: "", expertise: "", affiliation: "" },
    { id: "heith-copes", name: "Heith Copes", knownSince: 2025, field: "", expertise: "", affiliation: "" },
    { id: "william-pridemore", name: "William Pridemore", knownSince: 2025, field: "", expertise: "", affiliation: "" },
    { id: "roza-g-kamiloglu", name: "Roza G. Kamiloğlu", knownSince: 2024, field: "", expertise: "", affiliation: "" },
    { id: "jon-brauer", name: "Jon Brauer", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "felix-schonbrodt", name: "Felix Schönbrodt", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "victor-van-der-geest", name: "Victor van der Geest", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "william-fleeson", name: "William Fleeson", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "shaul-oreg", name: "Shaul Oreg", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "anna-baumert", name: "Anna Baumert", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "nicola-baumann", name: "Nicola Baumann", knownSince: 2026, field: "", expertise: "", affiliation: "" },
    { id: "reeshad-s-dalal", name: "Reeshad S. Dalal", knownSince: 2025, field: "", expertise: "", affiliation: "" },
    { id: "wilco-van-dijk", name: "Wilco van Dijk", knownSince: 2025, field: "", expertise: "", affiliation: "" },
    { id: "simon-columbus", name: "Simon Columbus", knownSince: 2022, field: "", expertise: "", affiliation: "" },
];

const ecologyEdges = [
    { source: "ranran", target: "matthijs-baas", knownSince: 2018, status: "past" },
    { source: "ranran", target: "reinout", knownSince: 2020, status: "ongoing" },
    { source: "ranran", target: "jean-louis", knownSince: 2024, status: "ongoing" },
    { source: "ranran", target: "ingo", knownSince: 2024, status: "past" },
    { source: "ranran", target: "daniel-balliet", knownSince: 2020, status: "past" },
    { source: "ranran", target: "isabel-thielmann", knownSince: 2020, status: "past" },
    { source: "ranran", target: "hannes-rusche", knownSince: 2024, status: "past" },
    { source: "ranran", target: "nicholas-umashev", knownSince: 2025, status: "past" },
    { source: "ranran", target: "yijin-he", knownSince: 2026, status: "ongoing" },
    { source: "ranran", target: "lorren-tisdall", knownSince: 2025, status: "ongoing" },
    { source: "ranran", target: "joshua-wilt", knownSince: 2025, status: "past" },
    { source: "ranran", target: "timothy-c-barnum", knownSince: 2026, status: "ongoing" },
    { source: "ranran", target: "shaina-herman", knownSince: 2026, status: "ongoing" },
    { source: "ranran", target: "caspar-j-van-lissa", knownSince: 2025, status: "ongoing" },
    { source: "ranran", target: "nick-ballou", knownSince: 2026, status: "past" },
    { source: "ranran", target: "max-knabe", knownSince: 2025, status: "ongoing" },
    { source: "ranran", target: "botao-amber-hu", knownSince: 2026, status: "ongoing" },
    { source: "ranran", target: "nicola-baumann", knownSince: 2026, status: "ongoing" },
    { source: "ranran", target: "wilco-van-dijk", knownSince: 2025, status: "ongoing" },
];

let ecologyAnimationFrame = null;
let ecologyNetworkState = null;

async function sha256(value) {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function showContent() {
    lockSection.classList.add("is-hidden");
    contentSection.classList.remove("is-hidden");
    renderEcologyNetwork();
}

function showLock() {
    contentSection.classList.add("is-hidden");
    lockSection.classList.remove("is-hidden");
    passwordInput.value = "";
    passwordMessage.textContent = "";
    passwordInput.focus();
}

passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    passwordMessage.textContent = "Checking...";

    const submittedHash = await sha256(passwordInput.value.trim());
    if (submittedHash === PASSWORD_HASH) {
        showContent();
        return;
    }

    passwordMessage.textContent = "That password did not work.";
    passwordInput.select();
});

if (lockButton) {
    lockButton.addEventListener("click", () => {
        showLock();
    });
}

function splitName(name) {
    const parts = name.split(" ");
    if (parts.length <= 2) {
        return [name];
    }

    const midpoint = Math.ceil(parts.length / 2);
    return [parts.slice(0, midpoint).join(" "), parts.slice(midpoint).join(" ")];
}

function makeSvgElement(tagName, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
    return element;
}

function tooltipRows(node) {
    return [
        ["Main Field", node.field],
        ["Expertise", node.expertise],
        ["Current Affiliation", node.affiliation],
    ].filter(([, value]) => value);
}

function showNodeTooltip(node, event) {
    if (!ecologyNodeTooltip || !ecologyNetworkWrap) {
        return;
    }

    const rows = tooltipRows(node);
    ecologyNodeTooltip.innerHTML = `
        <div class="ecology-node-tooltip-name">${node.name}</div>
        ${node.knownSince ? `<div class="ecology-node-tooltip-year">Known since ${node.knownSince}</div>` : ""}
        ${rows.length ? rows.map(([label, value]) => `
            <div class="ecology-node-tooltip-row">
                <span>${label}</span>
                <p>${value}</p>
            </div>
        `).join("") : `<p class="ecology-node-tooltip-empty">People Map details pending.</p>`}
    `;
    ecologyNodeTooltip.classList.remove("is-hidden");
    moveNodeTooltip(event, node);
}

function moveNodeTooltip(event, fallbackNode = null) {
    if (!ecologyNodeTooltip || !ecologyNetworkWrap) {
        return;
    }

    const bounds = ecologyNetworkWrap.getBoundingClientRect();
    const tooltipWidth = ecologyNodeTooltip.offsetWidth || 260;
    const tooltipHeight = ecologyNodeTooltip.offsetHeight || 160;
    const hasPointer = event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY);
    const baseX = hasPointer ? event.clientX - bounds.left : (fallbackNode?.x || bounds.width / 2);
    const baseY = hasPointer ? event.clientY - bounds.top : (fallbackNode?.y || bounds.height / 2);
    const x = Math.min(Math.max(baseX + 16, 8), bounds.width - tooltipWidth - 8);
    const y = Math.min(Math.max(baseY + 16, 8), bounds.height - tooltipHeight - 8);
    ecologyNodeTooltip.style.transform = `translate(${x}px, ${y}px)`;
}

function hideNodeTooltip() {
    if (ecologyNodeTooltip) {
        ecologyNodeTooltip.classList.add("is-hidden");
    }
}

function createNetworkState(width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const basePositions = { ranran: { x: centerX, y: centerY } };
    const orbitNodes = ecologyNodes.filter((node) => !node.anchor);
    const radiusX = Math.max(170, width * 0.36);
    const radiusY = Math.max(130, height * 0.32);
    const innerCount = Math.ceil(orbitNodes.length * 0.45);

    orbitNodes.forEach((node, index) => {
        const isInner = index < innerCount;
        const ringIndex = isInner ? index : index - innerCount;
        const ringCount = isInner ? innerCount : orbitNodes.length - innerCount;
        const angle = (Math.PI * 2 * ringIndex) / ringCount - Math.PI / 2 + (isInner ? 0 : Math.PI / ringCount);
        const scale = node.orbitScale || (isInner ? 0.62 : 1);
        basePositions[node.id] = {
            x: centerX + Math.cos(angle) * radiusX * scale,
            y: centerY + Math.sin(angle) * radiusY * scale,
        };
    });

    return {
        width,
        height,
        nodes: ecologyNodes.map((node, index) => ({
            ...node,
            baseX: basePositions[node.id].x,
            baseY: basePositions[node.id].y,
            x: basePositions[node.id].x,
            y: basePositions[node.id].y,
            phase: index * 1.7,
            speed: node.anchor ? 0.00018 : 0.00025 + index * 0.000025,
            drift: node.anchor ? 5 : 10,
            element: null,
            circle: null,
            hitArea: null,
            text: null,
        })),
        edges: ecologyEdges.map((edge) => ({
            ...edge,
            line: null,
            label: null,
        })),
    };
}

function nodeById(id) {
    return ecologyNetworkState.nodes.find((node) => node.id === id);
}

function updateNetworkVisibility() {
    if (!ecologyNetworkState || !ecologyYearSlider) {
        return;
    }

    const selectedYear = Number(ecologyYearSlider.value);
    const visibleEdges = ecologyNetworkState.edges.filter((edge) => edge.knownSince <= selectedYear);

    ecologyNetworkState.edges.forEach((edge) => {
        const isVisible = edge.knownSince <= selectedYear;
        edge.line.classList.toggle("is-muted", !isVisible);
    });

    ecologyNetworkState.nodes.forEach((node) => {
        const isVisible = node.anchor || node.knownSince <= selectedYear;
        node.element.classList.toggle("is-muted", !isVisible);
    });

    if (ecologyYearValue) {
        ecologyYearValue.textContent = selectedYear;
    }
    if (ecologyNetworkStatus) {
        const count = visibleEdges.length;
        const ongoingCount = visibleEdges.filter((edge) => edge.status === "ongoing").length;
        ecologyNetworkStatus.textContent = `${count} collaboration ${count === 1 ? "edge is" : "edges are"} visible by ${selectedYear}. Solid lines represent ongoing collaborations (N=${ongoingCount}) whereas dashed lines represent past collaborations.`;
    }
}

function updateNetworkGeometry(time = 0) {
    if (!ecologyNetworkState) {
        return;
    }

    ecologyNetworkState.nodes.forEach((node) => {
        const orbit = time * node.speed + node.phase;
        node.x = node.baseX + Math.cos(orbit) * node.drift;
        node.y = node.baseY + Math.sin(orbit * 1.25) * node.drift;

        node.circle.setAttribute("cx", node.x);
        node.circle.setAttribute("cy", node.y);
        node.hitArea.setAttribute("x", node.x - 12);
        node.hitArea.setAttribute("y", node.y - 20);
        node.hitArea.setAttribute("width", 190);
        node.hitArea.setAttribute("height", node.knownSince ? 46 : 30);
        node.text.setAttribute("x", node.x + 13);
        node.text.querySelectorAll("tspan").forEach((tspan) => {
            tspan.setAttribute("x", node.x + 13);
        });
        node.text.setAttribute("y", node.y + 4 - (splitName(node.name).length - 1) * 8);
    });

    ecologyNetworkState.edges.forEach((edge) => {
        const source = nodeById(edge.source);
        const target = nodeById(edge.target);
        const labelX = (source.x + target.x) / 2;
        const labelY = (source.y + target.y) / 2 - 10;

        edge.line.setAttribute("x1", source.x);
        edge.line.setAttribute("y1", source.y);
        edge.line.setAttribute("x2", target.x);
        edge.line.setAttribute("y2", target.y);
        if (edge.label) {
            edge.label.setAttribute("x", labelX);
            edge.label.setAttribute("y", labelY);
        }
    });
}

function animateEcologyNetwork(time) {
    updateNetworkGeometry(time);
    ecologyAnimationFrame = requestAnimationFrame(animateEcologyNetwork);
}

function startEcologyAnimation() {
    if (!ecologyAnimationFrame) {
        ecologyAnimationFrame = requestAnimationFrame(animateEcologyNetwork);
    }
}

function renderEcologyNetwork() {
    if (!ecologyNetwork || !ecologyYearSlider) {
        return;
    }

    const width = ecologyNetwork.clientWidth || 960;
    const height = ecologyNetwork.clientHeight || 448;
    ecologyNetworkState = createNetworkState(width, height);
    ecologyNetwork.setAttribute("viewBox", `0 0 ${width} ${height}`);
    ecologyNetwork.innerHTML = "";

    const edgeGroup = makeSvgElement("g", { class: "ecology-edge-layer" });
    const nodeGroup = makeSvgElement("g", { class: "ecology-node-layer" });

    ecologyNetworkState.edges.forEach((edge) => {
        const line = makeSvgElement("line", { class: `ecology-edge is-${edge.status || "past"}` });
        edgeGroup.appendChild(line);

        edge.line = line;
        edge.label = null;
    });

    ecologyNetworkState.nodes.forEach((node) => {
        const group = makeSvgElement("g");
        const classes = ["ecology-node"];
        if (node.anchor) {
            classes.push("is-anchor");
        }
        group.setAttribute("class", classes.join(" "));
        group.setAttribute("tabindex", "0");
        group.setAttribute("role", "button");
        group.setAttribute("aria-label", `${node.name} details`);

        const hitArea = makeSvgElement("rect", { class: "ecology-node-hit-area" });
        group.appendChild(hitArea);

        const circle = makeSvgElement("circle", { r: node.anchor ? 9 : 7 });
        group.appendChild(circle);

        const text = makeSvgElement("text");
        splitName(node.name).forEach((line, index) => {
            const tspan = makeSvgElement("tspan", { dy: index === 0 ? 0 : 16 });
            tspan.textContent = line;
            text.appendChild(tspan);
        });
        if (node.knownSince) {
            const year = makeSvgElement("tspan", { class: "ecology-node-year", dy: 17 });
            year.textContent = `(${node.knownSince})`;
            text.appendChild(year);
        }
        group.appendChild(text);
        nodeGroup.appendChild(group);

        node.element = group;
        node.circle = circle;
        node.hitArea = hitArea;
        node.text = text;

        group.addEventListener("pointerenter", (event) => showNodeTooltip(node, event));
        group.addEventListener("pointermove", moveNodeTooltip);
        group.addEventListener("pointerleave", hideNodeTooltip);
        group.addEventListener("mouseenter", (event) => showNodeTooltip(node, event));
        group.addEventListener("mousemove", moveNodeTooltip);
        group.addEventListener("mouseleave", hideNodeTooltip);
        group.addEventListener("click", (event) => showNodeTooltip(node, event));
        group.addEventListener("focus", (event) => showNodeTooltip(node, event));
        group.addEventListener("blur", hideNodeTooltip);
    });

    ecologyNetwork.append(edgeGroup, nodeGroup);
    updateNetworkGeometry();
    updateNetworkVisibility();
    startEcologyAnimation();
}

if (ecologyYearSlider) {
    ecologyYearSlider.addEventListener("input", updateNetworkVisibility);
    window.addEventListener("resize", renderEcologyNetwork);
    renderEcologyNetwork();
}
