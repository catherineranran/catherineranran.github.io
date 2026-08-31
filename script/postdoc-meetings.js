const POSTDOC_MEETINGS_PASSWORD_HASH = "959840abcf054be86024f447a7ca5b1262955b279fc978b22c9330f100267487";
const postdocMeetingsLock = document.querySelector("#postdoc-meetings-lock");
const postdocMeetingsContent = document.querySelector("#postdoc-meetings-content");
const postdocMeetingsForm = document.querySelector("#postdoc-meetings-password-form");
const postdocMeetingsInput = document.querySelector("#postdoc-meetings-password");
const postdocMeetingsMessage = document.querySelector("#postdoc-meetings-password-message");

async function postdocMeetingsSha256(value) {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function showPostdocMeetingsContent() {
    document.body.classList.add("postdoc-meetings-unlocked");
    postdocMeetingsLock.classList.add("is-hidden");
    postdocMeetingsContent.classList.remove("is-hidden");
}

postdocMeetingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    postdocMeetingsMessage.textContent = "";

    const candidateHash = await postdocMeetingsSha256(postdocMeetingsInput.value.trim());

    if (candidateHash === POSTDOC_MEETINGS_PASSWORD_HASH) {
        showPostdocMeetingsContent();
        return;
    }

    postdocMeetingsMessage.textContent = "Wrong password. Try again.";
    postdocMeetingsInput.select();
});
