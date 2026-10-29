/*
  Exhibition lock.

  The posts are encrypted inside exhibition.html (#exhibition-sealed) and open only with
  the password, so the public repo never holds them in readable form. After unlocking,
  a key derived from the password (never the password itself) stays on this device for
  8 hours, like the launch pad. To edit the posts, see _tools/exhibition-seal.mjs.
*/
(function () {
    var HOURS = 8;
    var STORE = "exhibition.unlock";
    var ROUNDS = 250000;

    var lock = document.getElementById("exhibition-lock");
    var content = document.getElementById("exhibition-content");
    var form = document.getElementById("exhibition-password-form");
    var input = document.getElementById("exhibition-password");
    var message = document.getElementById("exhibition-password-message");
    var sealed = JSON.parse(document.getElementById("exhibition-sealed").textContent);
    var encoder = new TextEncoder();

    function bytes(text) {
        return Uint8Array.from(atob(text), function (c) { return c.charCodeAt(0); });
    }

    function base64(data) {
        var text = "";
        data.forEach(function (b) { text += String.fromCharCode(b); });
        return btoa(text);
    }

    function readSaved() {
        try { var v = localStorage.getItem(STORE); return v ? JSON.parse(v) : null; } catch (e) { return null; }
    }

    function save(value) {
        try { localStorage.setItem(STORE, JSON.stringify(value)); } catch (e) { /* storage blocked: unlocked for this visit only */ }
    }

    function forget() {
        try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
    }

    function keyFromPassword(password) {
        return crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"])
            .then(function (base) {
                return crypto.subtle.deriveBits(
                    { name: "PBKDF2", salt: bytes(sealed.salt), iterations: ROUNDS, hash: "SHA-256" }, base, 256);
            })
            .then(function (bits) { return new Uint8Array(bits); });
    }

    function openWith(raw) {
        return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"])
            .then(function (key) {
                return crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(sealed.iv) }, key, bytes(sealed.ct));
            })
            .then(function (plain) { return new TextDecoder().decode(plain); });
    }

    function showLock(note) {
        content.classList.add("is-hidden");
        content.replaceChildren();
        lock.classList.remove("is-hidden");
        message.textContent = note || "";
        input.value = "";
        input.focus();
    }

    function showPosts(html, until) {
        content.innerHTML = html;
        message.textContent = "";

        var bar = document.createElement("div");
        bar.className = "exhibition-lockbar";
        var note = document.createElement("span");
        note.textContent = "Unlocked on this device until " +
            new Date(until).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        var button = document.createElement("button");
        button.type = "button";
        button.className = "project-lock-button";
        button.textContent = "Lock";
        button.addEventListener("click", function () { forget(); showLock(); });
        bar.append(note, button);
        content.prepend(bar);

        lock.classList.add("is-hidden");
        content.classList.remove("is-hidden");
        if (typeof window.initExhibitionBoard === "function") window.initExhibitionBoard();
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        message.textContent = "Unlocking…";
        var raw;
        keyFromPassword(input.value.trim())
            .then(function (key) { raw = key; return openWith(key); })
            .then(function (html) {
                var until = Date.now() + HOURS * 3600000;
                save({ key: base64(raw), salt: sealed.salt, until: until });
                showPosts(html, until);
            })
            .catch(function () {
                message.textContent = "That password did not work.";
                input.select();
            });
    });

    // Unlocked on this device in the last 8 hours? Open straight away.
    var saved = readSaved();
    if (saved && saved.salt === sealed.salt && saved.until > Date.now()) {
        openWith(bytes(saved.key))
            .then(function (html) { showPosts(html, saved.until); })
            .catch(function () { forget(); showLock(); });
    } else {
        if (saved) forget();
        showLock();
    }
})();
