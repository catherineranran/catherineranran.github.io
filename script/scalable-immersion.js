const encryptedProject = {
    salt: "YJs9Vd/WGSCCCOvBwuzaxw==",
    iv: "8YefE5Fh9PZnNufy",
    ciphertext: "jJqy6S5cxAWSqBYUrIvrQPPbPazyxmONFwr2HYbC3SzVjDa04EOlHd8RaWNWQn+TAVdH6JAJWSXNi/5KaExiSuRX63nndURqG6QOgCHMjRyDlbdyF8JRk3cvHl0a4Bwx50YXvccIUEUE49+qVbO4JadOlpgzjYTd41+O03EAl3FiRvt7OTu4VmFMItg7SbWR56g1FWJjXBbRpJuGfjTCXkgEjaSArCTydlrFsOcpfGY/XCht92wyk9ixEtqufk2v2627AkBLp2SV8kUGC2gAkw8OOyyWQ6KD9bGsbP2h4k8pafhbpMwD2tONyUjYiMXk20MISkGIjttPr2Ra+uw8M6V9L9UMTFiuvO3FOE0hBmRkF2TOqbivtw+nX3s0fUTaIlcbUBqYpo4gKmiTpNrXkKpvEuEB4q7oHnzVFPwSquPivAHsNWo5uwKhudnh9I3T1IUpzI+6xrQ6cFyqbzapIhUcYnROIXTKrOFPROdkK99o+l598nzHYdR6jtZnvdM17Etwu2a5NX+tCs4cE5fVIEpjSENXDWzg5rRHEhcCv49qczK/EWmLKo3yEFb/cWU9WxL2dgnkAUzhaZZ5VS0LQKFas3DZdVpuxfeP9J2Q/75k5kj7WyN5HZ3dxX1WuP3f1dSYMz8MD84tsmuJDRZuj6kf6zlJ7ePnhm0Umk8DC7fB1WpSZMxHn2Ro",
};

const lockSection = document.querySelector("#project-lock");
const contentSection = document.querySelector("#project-content");
const passwordForm = document.querySelector("#project-password-form");
const passwordInput = document.querySelector("#project-password");
const passwordMessage = document.querySelector("#project-password-message");

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

function renderProject(project) {
    const header = document.createElement("header");
    header.className = "project-hero";
    const heroCopy = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "project-eyebrow";
    eyebrow.textContent = "Scalable immersive scenarios";
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
    previewFrame.className = "project-preview-frame";
    previewFrame.src = googleDocPreviewUrl(project.documentUrl);
    previewFrame.title = `${project.documentTitle} preview`;
    previewFrame.loading = "lazy";
    previewFrame.referrerPolicy = "strict-origin-when-cross-origin";
    preview.append(previewHeader, previewFrame);

    const note = document.createElement("p");
    note.className = "project-access-note";
    note.textContent = "Google Drive permissions apply when opening or editing these materials.";

    contentSection.replaceChildren(header, citationPanel, resources, preview, note);
    lockSection.classList.add("is-hidden");
    contentSection.classList.remove("is-hidden");
    document.title = `${project.title} | Ranran Li`;
}

passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    passwordMessage.textContent = "Unlocking…";
    try {
        const project = await decryptProject(passwordInput.value.trim());
        renderProject(project);
    } catch (error) {
        passwordMessage.textContent = "That password did not work.";
        passwordInput.select();
    }
});
