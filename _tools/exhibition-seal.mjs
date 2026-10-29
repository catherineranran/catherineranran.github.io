#!/usr/bin/env node
/*
  Seal and unseal the posts on exhibition.html.

  The posts are encrypted inside the page (AES-GCM; the key comes from the password
  through PBKDF2-SHA256, 250,000 rounds), so this public repo never holds them in
  readable form. script/exhibition-lock.js opens them in the browser.

  To add or edit posts (the password comes from Ranran; never write it into the repo):

    EXHIBITION_PASSWORD='…' node _tools/exhibition-seal.mjs unseal
        writes exhibition-content.html, the readable posts (git-ignored: never commit it)
    …edit exhibition-content.html…
    EXHIBITION_PASSWORD='…' node _tools/exhibition-seal.mjs seal
        encrypts it back into exhibition.html, then delete exhibition-content.html

  `seal` keeps the same salt, so devices unlocked in the last 8 hours stay unlocked.
  It refuses a password that does not open the current page, so a typo can't lock
  everyone out. To change the password:

    EXHIBITION_PASSWORD='old' NEW_PASSWORD='new' node _tools/exhibition-seal.mjs repassword
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'exhibition.html');
const PLAIN = join(ROOT, 'exhibition-content.html');
const ROUNDS = 250000;
const BLOCK = /(<script type="application\/json" id="exhibition-sealed">)([\s\S]*?)(<\/script>)/;

const { subtle } = webcrypto;
const te = new TextEncoder();
const td = new TextDecoder();
const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const unb64 = (text) => new Uint8Array(Buffer.from(text, 'base64'));

async function keyFor(password, salt) {
    const base = await subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ROUNDS, hash: 'SHA-256' }, base, 256);
    return subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function open(sealed, password) {
    const key = await keyFor(password, unb64(sealed.salt));
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.ct));
    return td.decode(plain);
}

async function close(html, password, saltText) {
    const salt = saltText ? unb64(saltText) : webcrypto.getRandomValues(new Uint8Array(16));
    const iv = webcrypto.getRandomValues(new Uint8Array(12));   // fresh every time
    const key = await keyFor(password, salt);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(html)));
    return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

function env(name) {
    const value = process.env[name];
    if (!value) {
        console.error(`Set ${name} first.`);
        process.exit(1);
    }
    return value;
}

function fail(text) {
    console.error(text);
    process.exit(1);
}

const command = process.argv[2];
const page = readFileSync(PAGE, 'utf8');
const match = BLOCK.exec(page);
if (!match) fail('exhibition.html has no <script id="exhibition-sealed"> block.');
const current = match[2].trim() && match[2].trim() !== '{}' ? JSON.parse(match[2]) : null;

async function write(sealed, html, password) {
    if ((await open(sealed, password)) !== html) fail('Round trip failed; exhibition.html was not changed.');
    writeFileSync(PAGE, page.replace(BLOCK, (_, start, __, end) => start + JSON.stringify(sealed) + end));
}

if (command === 'unseal') {
    if (!current) fail('Nothing is sealed yet.');
    const html = await open(current, env('EXHIBITION_PASSWORD')).catch(() => fail('Wrong password.'));
    writeFileSync(PLAIN, html);
    console.log('Wrote exhibition-content.html. Edit it, run `seal`, then delete it. Never commit it.');
} else if (command === 'seal') {
    const password = env('EXHIBITION_PASSWORD');
    if (current) {
        await open(current, password).catch(() => fail('That password does not open the current page; nothing changed.'));
    } else if (!process.argv.includes('--first')) {
        fail('Nothing is sealed yet; run `seal --first` to seal for the first time.');
    }
    const html = readFileSync(PLAIN, 'utf8');
    await write(await close(html, password, current && current.salt), html, password);
    console.log(`Sealed ${html.length} characters into exhibition.html.`);
} else if (command === 'repassword') {
    if (!current) fail('Nothing is sealed yet.');
    const html = await open(current, env('EXHIBITION_PASSWORD')).catch(() => fail('Wrong current password.'));
    const fresh = env('NEW_PASSWORD');
    await write(await close(html, fresh, null), html, fresh);
    console.log('Re-sealed with the new password. Every device will ask for it again.');
} else {
    console.log('usage: node _tools/exhibition-seal.mjs unseal | seal [--first] | repassword');
}
