// Starry night sky behind the homepage: twinkling stars, a faint Milky Way,
// a few bright four-pointed stars and the occasional shooting star.
// Used on index.html only; the other pages keep script/particles.js.
(function () {
	const host = document.getElementById("particles-bg");
	if (!host) return;

	const canvas = document.createElement("canvas");
	canvas.className = "starry-sky";
	canvas.setAttribute("aria-hidden", "true");
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	host.appendChild(canvas);

	const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
	let still = motionQuery.matches;

	// Star colours: mostly white, some cool blue, a few warm and rosy ones.
	const TINTS = [
		"255,255,255", "255,255,255", "255,255,255", "255,255,255",
		"222,233,255", "200,218,255",
		"255,240,222", "255,224,238"
	];
	const SPARKLE_TINTS = ["255,255,255", "255,244,226", "226,236,255", "255,228,240"];

	let W = 0, H = 0, fieldH = 0, dpr = 1;
	let stars = [];      // the general field; drifts a little as you scroll
	let dust = [];       // faint stars packed along the Milky Way
	let sparkles = [];   // a handful of bright four-pointed stars
	let meteors = [];
	let milkyWay = null; // pre-rendered band glow
	const glow = makeGlow();
	const sparkleSprites = SPARKLE_TINTS.map(makeSparkleSprite);
	let nextMeteorAt = 0;
	let rafId = 0;
	let lastFrame = 0;

	const rand = (a, b) => a + Math.random() * (b - a);
	const pick = (list) => list[(Math.random() * list.length) | 0];
	const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
	// roughly normal, mean 0, sd 1
	const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 0.577;
	const wrapY = (y) => ((y % fieldH) + fieldH) % fieldH;

	function makeGlow() {
		const c = document.createElement("canvas");
		c.width = c.height = 64;
		const g = c.getContext("2d");
		const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		grad.addColorStop(0, "rgba(255,255,255,1)");
		grad.addColorStop(0.25, "rgba(255,255,255,0.35)");
		grad.addColorStop(1, "rgba(255,255,255,0)");
		g.fillStyle = grad;
		g.fillRect(0, 0, 64, 64);
		return c;
	}

	// A soft halo, two thin light spikes and a curved four-pointed body.
	function makeSparkleSprite(tint) {
		const S = 128, c = S / 2;
		const cv = document.createElement("canvas");
		cv.width = cv.height = S;
		const g = cv.getContext("2d");

		const halo = g.createRadialGradient(c, c, 0, c, c, c * 0.62);
		halo.addColorStop(0, "rgba(" + tint + ",0.5)");
		halo.addColorStop(0.3, "rgba(" + tint + ",0.12)");
		halo.addColorStop(1, "rgba(" + tint + ",0)");
		g.fillStyle = halo;
		g.fillRect(0, 0, S, S);

		g.lineWidth = 1.2;
		const h = g.createLinearGradient(0, c, S, c);
		h.addColorStop(0, "rgba(" + tint + ",0)");
		h.addColorStop(0.5, "rgba(" + tint + ",0.75)");
		h.addColorStop(1, "rgba(" + tint + ",0)");
		g.strokeStyle = h;
		g.beginPath(); g.moveTo(4, c); g.lineTo(S - 4, c); g.stroke();
		const v = g.createLinearGradient(c, 0, c, S);
		v.addColorStop(0, "rgba(" + tint + ",0)");
		v.addColorStop(0.5, "rgba(" + tint + ",0.75)");
		v.addColorStop(1, "rgba(" + tint + ",0)");
		g.strokeStyle = v;
		g.beginPath(); g.moveTo(c, 4); g.lineTo(c, S - 4); g.stroke();

		const R = S * 0.2, k = S * 0.028;
		g.fillStyle = "rgba(" + tint + ",0.95)";
		g.beginPath();
		g.moveTo(c, c - R);
		g.quadraticCurveTo(c + k, c - k, c + R, c);
		g.quadraticCurveTo(c + k, c + k, c, c + R);
		g.quadraticCurveTo(c - k, c + k, c - R, c);
		g.quadraticCurveTo(c - k, c - k, c, c - R);
		g.fill();

		g.fillStyle = "#ffffff";
		g.beginPath(); g.arc(c, c, S * 0.025, 0, Math.PI * 2); g.fill();
		return cv;
	}

	function makeStar(x, y, faint) {
		const r = faint ? rand(0.25, 0.6) : 0.3 + Math.pow(Math.random(), 4) * 1.35;
		return {
			x, y, r,
			a: faint ? rand(0.12, 0.38) : clamp(rand(0.3, 0.75) * (0.6 + r * 0.4), 0, 1),
			col: "rgb(" + pick(TINTS) + ")",
			tw: rand(0.15, 0.55),   // how deep it twinkles
			sp: rand(0.5, 1.9),     // how fast
			ph: rand(0, Math.PI * 2),
			depth: faint ? 0 : 0.012 + r * 0.025 // nearer (bigger) stars drift more
		};
	}

	function generate() {
		fieldH = H + 160;
		const area = W * H;

		stars = [];
		const n = Math.round(clamp(area / 2600, 120, 650));
		for (let i = 0; i < n; i++) stars.push(makeStar(rand(0, W), rand(0, fieldH), false));

		// Milky Way: a band across the sky, steeper on portrait screens.
		const angle = (W > H ? -22 : -62) * Math.PI / 180;
		const dx = Math.cos(angle), dy = Math.sin(angle);
		const nx = -dy, ny = dx;
		const cx = W * 0.5, cy = H * 0.42;
		const L = Math.hypot(W, H) * 1.1;
		const sigma = Math.min(W, H) * 0.09;

		dust = [];
		const m = Math.round(clamp(area / 3800, 60, 420));
		for (let i = 0; i < m; i++) {
			const u = rand(-0.5, 0.5) * L, v = gauss() * sigma;
			const x = cx + dx * u + nx * v, y = cy + dy * u + ny * v;
			if (x >= 0 && x <= W && y >= 0 && y <= H) dust.push(makeStar(x, y, true));
		}

		milkyWay = document.createElement("canvas");
		milkyWay.width = Math.ceil(W / 2);
		milkyWay.height = Math.ceil(H / 2);
		const g = milkyWay.getContext("2d");
		g.scale(0.5, 0.5);
		g.translate(cx, cy);
		g.rotate(angle);
		const clouds = ["150,170,255", "185,160,255", "255,190,225", "170,215,255"];
		for (let i = 0; i < 40; i++) {
			const rx = rand(0.06, 0.18) * L, ry = rand(0.5, 1.7) * sigma;
			const col = pick(clouds);
			g.save();
			g.translate(rand(-0.55, 0.55) * L, gauss() * sigma * 0.75);
			g.scale(1, ry / rx);
			const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
			grad.addColorStop(0, "rgba(" + col + ",0.06)");
			grad.addColorStop(1, "rgba(" + col + ",0)");
			g.fillStyle = grad;
			g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
			g.restore();
		}
		// darker dust lanes running through the band
		g.globalCompositeOperation = "destination-out";
		for (let i = 0; i < 4; i++) {
			const rx = rand(0.12, 0.28) * L, ry = sigma * rand(0.1, 0.18);
			g.save();
			g.translate(rand(-0.4, 0.4) * L, gauss() * sigma * 0.15);
			g.scale(1, ry / rx);
			const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
			grad.addColorStop(0, "rgba(0,0,0,0.55)");
			grad.addColorStop(1, "rgba(0,0,0,0)");
			g.fillStyle = grad;
			g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
			g.restore();
		}

		// Bright stars stay in the margins beside the 1024px content column,
		// so they never sit behind text; narrow screens get just a few, dimmer.
		sparkles = [];
		const gutter = (W - 1024) / 2;
		const roomy = gutter >= 80;
		const k = roomy ? Math.round(clamp(H / 100, 6, 10)) : 3;
		for (let i = 0; i < k; i++) {
			const x = roomy
				? (i % 2 === 0 ? rand(14, gutter - 14) : W - rand(14, gutter - 14))
				: rand(0.06, 0.94) * W;
			sparkles.push({
				x,
				y: rand(0.03, 0.97) * fieldH,
				R: rand(5, 9.5) * (W < 600 ? 0.8 : 1),
				dim: roomy ? 1 : 0.7,
				img: pick(sparkleSprites),
				sp: rand(0.35, 0.9),
				ph: rand(0, Math.PI * 2),
				depth: rand(0.03, 0.05)
			});
		}
	}

	function launchMeteor(now) {
		const small = W < 600 ? 0.7 : 1;
		const fromRight = Math.random() < 0.7;
		const ang = rand(0.32, 0.58);           // 18–33 degrees below the horizon
		const speed = rand(700, 1100) * small;  // px per second
		const dir = fromRight ? -1 : 1;
		meteors.push({
			x: fromRight ? rand(0.35, 1) * W : rand(0, 0.65) * W,
			y: rand(-0.02, 0.4) * H,
			vx: dir * Math.cos(ang) * speed,
			vy: Math.sin(ang) * speed,
			len: rand(110, 230) * small,
			born: now,
			life: rand(0.75, 1.25)
		});
		nextMeteorAt = now + rand(4.5, 11);
	}

	function draw(now) {
		ctx.clearRect(0, 0, W, H);
		const off = still ? 0 : window.scrollY;

		if (milkyWay) {
			ctx.globalAlpha = 1;
			ctx.drawImage(milkyWay, 0, 0, W, H);
		}

		for (const s of dust) {
			const tw = still ? 1 : 1 - s.tw + s.tw * (0.5 + 0.5 * Math.sin(now * s.sp + s.ph));
			ctx.globalAlpha = s.a * tw;
			ctx.fillStyle = s.col;
			ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
		}

		for (const s of stars) {
			const y = wrapY(s.y - off * s.depth);
			if (y > H + 4) continue;
			const tw = still ? 1 : 1 - s.tw + s.tw * (0.5 + 0.5 * Math.sin(now * s.sp + s.ph));
			const a = s.a * tw;
			if (s.r > 1) {
				const d = s.r * 7;
				ctx.globalAlpha = a * 0.3;
				ctx.drawImage(glow, s.x - d / 2, y - d / 2, d, d);
			}
			ctx.globalAlpha = a;
			ctx.fillStyle = s.col;
			ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, Math.PI * 2); ctx.fill();
		}

		for (const s of sparkles) {
			const y = wrapY(s.y - off * s.depth);
			if (y > H + 30) continue;
			const pulse = still ? 0.8 : 0.5 + 0.5 * Math.sin(now * s.sp + s.ph);
			const d = s.R * 5 * (0.75 + 0.35 * pulse);
			ctx.globalAlpha = (0.45 + 0.55 * pulse) * s.dim;
			ctx.drawImage(s.img, s.x - d / 2, y - d / 2, d, d);
		}

		for (let i = meteors.length - 1; i >= 0; i--) {
			const m = meteors[i];
			const age = now - m.born, p = age / m.life;
			if (p >= 1) { meteors.splice(i, 1); continue; }
			if (p <= 0) continue;
			const hx = m.x + m.vx * age, hy = m.y + m.vy * age;
			const sp = Math.hypot(m.vx, m.vy);
			const tail = m.len * Math.min(1, age / 0.25);
			const tx = hx - (m.vx / sp) * tail, ty = hy - (m.vy / sp) * tail;
			const env = Math.min(1, p / 0.12) * (1 - Math.max(0, (p - 0.55) / 0.45));
			const grad = ctx.createLinearGradient(hx, hy, tx, ty);
			grad.addColorStop(0, "rgba(255,255,255," + 0.95 * env + ")");
			grad.addColorStop(0.3, "rgba(205,218,255," + 0.45 * env + ")");
			grad.addColorStop(1, "rgba(170,185,255,0)");
			ctx.globalAlpha = 1;
			ctx.strokeStyle = grad;
			ctx.lineWidth = 1.6;
			ctx.lineCap = "round";
			ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
			ctx.globalAlpha = env;
			ctx.drawImage(glow, hx - 6, hy - 6, 12, 12);
		}
		ctx.globalAlpha = 1;
	}

	function frame(ms) {
		rafId = requestAnimationFrame(frame);
		// twinkling is fine at ~30 fps; shooting stars get every frame
		if (!meteors.length && ms - lastFrame < 32) return;
		lastFrame = ms;
		const now = ms / 1000;
		if (now >= nextMeteorAt) launchMeteor(now);
		draw(now);
	}

	function start() {
		cancelAnimationFrame(rafId);
		meteors = [];
		if (still) {
			draw(0);
			return;
		}
		nextMeteorAt = performance.now() / 1000 + rand(2.5, 5);
		rafId = requestAnimationFrame(frame);
	}

	function setup(force) {
		const w = window.innerWidth, h = window.innerHeight;
		// phones resize by a toolbar's height while scrolling; don't reshuffle the sky for that
		const regen = force || w !== W || Math.abs(h - H) > 140;
		W = w; H = h;
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		canvas.style.width = W + "px";
		canvas.style.height = H + "px";
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		if (regen) generate();
		if (still) draw(0);
	}

	let resizeTimer = 0;
	window.addEventListener("resize", () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => setup(false), 150);
	});

	const onMotionChange = (e) => { still = e.matches; start(); };
	if (motionQuery.addEventListener) motionQuery.addEventListener("change", onMotionChange);
	else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);

	// Lets a shooting star be sent on demand (handy from the console).
	window.starrySky = { shoot: () => { if (!still) launchMeteor(performance.now() / 1000); } };

	setup(true);
	start();
})();
