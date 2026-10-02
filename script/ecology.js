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
const ecologyBoard = document.querySelector("#ecology-board");

// People and collaborations live only in the encrypted payload (script/ecology-data.js).
let ecologyNodes = [];
let ecologyEdges = [];

let ecologyAnimationFrame = null;
let ecologyNetworkState = null;

function fromBase64(value) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function decryptEcology(password) {
    const payload = window.ecologyEncrypted;
    if (!payload) {
        throw new Error("missing-payload");
    }
    const encoder = new TextEncoder();
    const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: fromBase64(payload.salt), iterations: payload.iterations || 250000, hash: "SHA-256" },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(payload.iv) },
        key,
        fromBase64(payload.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
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

    let data;
    try {
        data = await decryptEcology(passwordInput.value.trim());
    } catch (error) {
        passwordMessage.textContent = error.message === "missing-payload"
            ? "The workspace data could not be loaded."
            : "That password did not work.";
        passwordInput.select();
        return;
    }

    ecologyNodes = data.nodes || [];
    ecologyEdges = data.edges || [];
    if (ecologyBoard && data.boardHtml) {
        ecologyBoard.innerHTML = data.boardHtml;
    }
    passwordInput.value = "";
    passwordMessage.textContent = "";
    showContent();
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
    if (!ecologyNetwork || !ecologyYearSlider || !ecologyNodes.length) {
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
}
