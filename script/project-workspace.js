const { eyebrow: projectEyebrow, encryptedProject, encryptedHtml } = window.projectWorkspaceConfig;

const lockSection = document.querySelector("#project-lock");
const contentSection = document.querySelector("#project-content");
const passwordForm = document.querySelector("#project-password-form");
const passwordInput = document.querySelector("#project-password");
const passwordMessage = document.querySelector("#project-password-message");
const activeObjectUrls = [];

function fromBase64(value) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function decryptProject(password) {
    const encoder = new TextEncoder();
    const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: fromBase64(encryptedProject.salt), iterations: 250000, hash: "SHA-256" },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(encryptedProject.iv) },
        key,
        fromBase64(encryptedProject.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
}

async function decryptHtml(password) {
    if (!encryptedHtml) return null;

    let encryptedBytes;
    if (encryptedHtml.ciphertext) {
        encryptedBytes = fromBase64(encryptedHtml.ciphertext);
    } else {
        const response = await fetch(encryptedHtml.path);
        if (!response.ok) throw new Error("The encrypted analysis file could not be loaded.");
        encryptedBytes = await response.arrayBuffer();
    }

    const encoder = new TextEncoder();
    const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: fromBase64(encryptedHtml.salt), iterations: 250000, hash: "SHA-256" },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(encryptedHtml.iv) },
        key,
        encryptedBytes
    );
    const objectUrl = URL.createObjectURL(new Blob([decrypted], { type: "text/html;charset=utf-8" }));
    activeObjectUrls.push(objectUrl);
    return objectUrl;
}

function externalLink(url, className, label, iconClass) {
    const link = document.createElement("a");
    link.href = url;
    link.className = className;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const icon = document.createElement("i");
    icon.className = iconClass;
    icon.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = label;
    link.append(icon, text);
    return link;
}

function googleDocPreviewUrl(documentUrl) {
    const match = documentUrl.match(/\/document\/d\/([^/]+)/);
    return match ? `https://docs.google.com/document/d/${match[1]}/preview` : documentUrl;
}

function renderProject(project, analysisUrl = null) {
    const header = document.createElement("header");
    header.className = "project-hero";
    const heroCopy = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "project-eyebrow";
    eyebrow.textContent = projectEyebrow;
    const title = document.createElement("h1");
    title.textContent = project.title;
    const subtitle = document.createElement("p");
    subtitle.className = "project-subtitle";
    subtitle.textContent = project.subtitle;
    heroCopy.append(eyebrow, title, subtitle);

    const lockButton = document.createElement("button");
    lockButton.className = "project-lock-button";
    lockButton.type = "button";
    lockButton.textContent = "Lock workspace";
    lockButton.addEventListener("click", () => {
        activeObjectUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
        contentSection.replaceChildren();
        contentSection.classList.add("is-hidden");
        lockSection.classList.remove("is-hidden");
        passwordInput.value = "";
        passwordMessage.textContent = "";
        passwordInput.focus();
    });
    header.append(heroCopy, lockButton);

    const citationPanel = document.createElement("section");
    citationPanel.className = "project-citation-panel";
    const citationLabel = document.createElement("p");
    citationLabel.className = "project-panel-label";
    citationLabel.textContent = "Project";
    const citation = document.createElement("p");
    citation.className = "project-citation";
    citation.textContent = project.citation;
    const tags = document.createElement("div");
    tags.className = "project-tags";
    project.tags.forEach((tag) => {
        const item = document.createElement("span");
        item.textContent = tag;
        tags.append(item);
    });
    citationPanel.append(citationLabel, citation, tags);

    const resources = document.createElement("section");
    resources.className = "project-resources";
    const resourcesHeader = document.createElement("div");
    resourcesHeader.className = "project-section-heading";
    const resourcesLabel = document.createElement("p");
    resourcesLabel.className = "project-panel-label";
    resourcesLabel.textContent = "Workspace";
    const resourcesTitle = document.createElement("h2");
    resourcesTitle.textContent = "Project documents";
    resourcesHeader.append(resourcesLabel, resourcesTitle);
    const resourceGrid = document.createElement("div");
    resourceGrid.className = "project-resource-grid";
    resourceGrid.append(
        externalLink(project.documentUrl, "project-resource-card project-document-card", `${project.documentTitle} (see preview below)`, "fa-regular fa-file-lines"),
        externalLink(project.folderUrl, "project-resource-card project-folder-card", "Open the Google Drive folder", "fa-regular fa-folder-open")
    );
    if (analysisUrl) {
        resourceGrid.classList.add("project-resource-grid-three");
        resourceGrid.append(
            externalLink(analysisUrl, "project-resource-card project-analysis-card", `${encryptedHtml.title} (see preview below)`, "fa-solid fa-chart-line")
        );
    }
    resources.append(resourcesHeader, resourceGrid);

    const preview = document.createElement("section");
    preview.className = "project-document-preview";
    const previewHeader = document.createElement("div");
    previewHeader.className = "project-preview-heading";
    const previewCopy = document.createElement("div");
    const previewLabel = document.createElement("p");
    previewLabel.className = "project-panel-label";
    previewLabel.textContent = "Document preview";
    const previewTitle = document.createElement("h2");
    previewTitle.textContent = project.documentTitle;
    previewCopy.append(previewLabel, previewTitle);
    previewHeader.append(previewCopy, externalLink(project.documentUrl, "project-preview-open", "Open in Google Docs", "fa-solid fa-arrow-up-right-from-square"));

    const previewFrame = document.createElement("iframe");
    previewFrame.className = analysisUrl
        ? "project-preview-frame project-working-document-frame"
        : "project-preview-frame";
    previewFrame.src = googleDocPreviewUrl(project.documentUrl);
    previewFrame.title = `${project.documentTitle} preview`;
    previewFrame.loading = "lazy";
    previewFrame.referrerPolicy = "strict-origin-when-cross-origin";
    preview.append(previewHeader, previewFrame);

    let analysisPreview = null;
    if (analysisUrl) {
        analysisPreview = document.createElement("section");
        analysisPreview.className = "project-document-preview";
        const analysisHeader = document.createElement("div");
        analysisHeader.className = "project-preview-heading";
        const analysisCopy = document.createElement("div");
        const analysisLabel = document.createElement("p");
        analysisLabel.className = "project-panel-label";
        analysisLabel.textContent = "Analysis preview";
        const analysisTitle = document.createElement("h2");
        analysisTitle.textContent = encryptedHtml.title;
        analysisCopy.append(analysisLabel, analysisTitle);
        analysisHeader.append(analysisCopy, externalLink(analysisUrl, "project-preview-open", "Open full analysis", "fa-solid fa-arrow-up-right-from-square"));

        const analysisFrame = document.createElement("iframe");
        analysisFrame.className = "project-preview-frame project-analysis-frame";
        analysisFrame.src = analysisUrl;
        analysisFrame.title = `${encryptedHtml.title} preview`;
        analysisFrame.loading = "lazy";
        analysisFrame.setAttribute("sandbox", "");
        analysisPreview.append(analysisHeader, analysisFrame);
    }

    const note = document.createElement("p");
    note.className = "project-access-note";
    note.textContent = "Google Drive permissions apply when opening or editing these materials.";

    const sections = [header, citationPanel, resources, preview];
    if (analysisPreview) sections.push(analysisPreview);
    sections.push(note);
    contentSection.replaceChildren(...sections);
    lockSection.classList.add("is-hidden");
    contentSection.classList.remove("is-hidden");
    document.title = `${project.title} | Ranran Li`;
}

passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    passwordMessage.textContent = "Unlocking…";
    const password = passwordInput.value.trim();
    let project;
    try {
        project = await decryptProject(password);
    } catch (error) {
        passwordMessage.textContent = "That password did not work.";
        passwordInput.select();
        return;
    }

    try {
        const analysisUrl = await decryptHtml(password);
        renderProject(project, analysisUrl);
    } catch (error) {
        passwordMessage.textContent = "The workspace unlocked, but the analysis preview could not be loaded.";
    }
});
