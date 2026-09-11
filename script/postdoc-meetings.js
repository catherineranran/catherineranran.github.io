const POSTDOC_MEETINGS_PASSWORD_HASH = "959840abcf054be86024f447a7ca5b1262955b279fc978b22c9330f100267487";
const postdocMeetingsLock = document.querySelector("#postdoc-meetings-lock");
const postdocMeetingsContent = document.querySelector("#postdoc-meetings-content");
const postdocMeetingsForm = document.querySelector("#postdoc-meetings-password-form");
const postdocMeetingsInput = document.querySelector("#postdoc-meetings-password");
const postdocMeetingsMessage = document.querySelector("#postdoc-meetings-password-message");

function postdocMeetingsSha256Fallback(value) {
    const rightRotate = (number, amount) => (number >>> amount) | (number << (32 - amount));
    const maxWord = 2 ** 32;
    const words = [];
    const bytes = new TextEncoder().encode(value);
    const hash = [
        0x6a09e667,
        0xbb67ae85,
        0x3c6ef372,
        0xa54ff53a,
        0x510e527f,
        0x9b05688c,
        0x1f83d9ab,
        0x5be0cd19,
    ];
    const keys = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    for (let index = 0; index < bytes.length; index += 1) {
        words[index >> 2] |= bytes[index] << (24 - (index % 4) * 8);
    }

    words[bytes.length >> 2] |= 0x80 << (24 - (bytes.length % 4) * 8);
    words[(((bytes.length + 8) >> 6) << 4) + 15] = bytes.length * 8;

    for (let block = 0; block < words.length; block += 16) {
        const schedule = Array(64).fill(0);
        const workingHash = hash.slice(0);

        for (let index = 0; index < 16; index += 1) {
            schedule[index] = words[block + index] || 0;
        }

        for (let index = 16; index < 64; index += 1) {
            const gamma0 = rightRotate(schedule[index - 15], 7) ^ rightRotate(schedule[index - 15], 18) ^ (schedule[index - 15] >>> 3);
            const gamma1 = rightRotate(schedule[index - 2], 17) ^ rightRotate(schedule[index - 2], 19) ^ (schedule[index - 2] >>> 10);
            schedule[index] = (schedule[index - 16] + gamma0 + schedule[index - 7] + gamma1) | 0;
        }

        for (let index = 0; index < 64; index += 1) {
            const sigma0 = rightRotate(workingHash[0], 2) ^ rightRotate(workingHash[0], 13) ^ rightRotate(workingHash[0], 22);
            const sigma1 = rightRotate(workingHash[4], 6) ^ rightRotate(workingHash[4], 11) ^ rightRotate(workingHash[4], 25);
            const choose = (workingHash[4] & workingHash[5]) ^ (~workingHash[4] & workingHash[6]);
            const majority = (workingHash[0] & workingHash[1]) ^ (workingHash[0] & workingHash[2]) ^ (workingHash[1] & workingHash[2]);
            const temp1 = (workingHash[7] + sigma1 + choose + keys[index] + schedule[index]) | 0;
            const temp2 = (sigma0 + majority) | 0;
            workingHash.pop();
            workingHash.unshift((temp1 + temp2) | 0);
            workingHash[4] = (workingHash[4] + temp1) | 0;
        }

        for (let index = 0; index < 8; index += 1) {
            hash[index] = (hash[index] + workingHash[index]) | 0;
        }
    }

    return hash.map((valuePart) => (valuePart + maxWord).toString(16).slice(-8)).join("");
}

async function postdocMeetingsSha256(value) {
    if (!window.crypto || !window.crypto.subtle) {
        return postdocMeetingsSha256Fallback(value);
    }

    const encoded = new TextEncoder().encode(value);

    try {
        const digest = await crypto.subtle.digest("SHA-256", encoded);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    } catch (error) {
        return postdocMeetingsSha256Fallback(value);
    }
}

function showPostdocMeetingsContent() {
    document.body.classList.add("postdoc-meetings-unlocked");
    postdocMeetingsLock.classList.add("is-hidden");
    postdocMeetingsContent.classList.remove("is-hidden");
}

postdocMeetingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    postdocMeetingsMessage.textContent = "";

    const candidatePassword = postdocMeetingsInput.value.trim();
    const candidateHash = await postdocMeetingsSha256(candidatePassword);

    if (candidateHash === POSTDOC_MEETINGS_PASSWORD_HASH) {
        showPostdocMeetingsContent();
        return;
    }

    postdocMeetingsMessage.textContent = "Wrong password. Try again.";
    postdocMeetingsInput.select();
});
