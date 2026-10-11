// Starry night sky behind the homepage: twinkling stars, a few of which drift
// and link up with faint lines, a soft Milky Way, glinting bright stars, the
// odd shooting star, and a small star that follows the mouse with a meteor tail.
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

	// The mouse star draws on its own layer, above the page content.
	const trail = document.createElement("canvas");
	trail.className = "star-trail";
	trail.setAttribute("aria-hidden", "true");
	const tctx = trail.getContext("2d");

	const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
	const mouseQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
	let still = motionQuery.matches;

	// Star colours: mostly white, some cool blue, a few warm and rosy ones.
	const TINTS = [
		"255,255,255", "255,255,255", "255,255,255", "255,255,255",
		"222,233,255", "200,218,255",
		"255,240,222", "255,224,238"
	];
	const SPARKLE_TINTS = ["255,255,255", "255,244,226", "226,236,255", "255,228,240"];
	const SPECK_TINTS = ["255,255,255", "214,226,255", "236,214,255", "255,236,214"];
	const LINK_ALPHA = 0.13;   // the strongest a link line gets (very faint)
	const CURSOR_REACH = 170;  // px within which the mouse star links to stars
	const TAIL_LIFE = 0.45;    // seconds each point of the mouse star's tail lasts

	const rand = (a, b) => a + Math.random() * (b - a);
	const pick = (list) => list[(Math.random() * list.length) | 0];
	const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
	// roughly normal, mean 0, sd 1
	const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 0.577;

	const glow = makeGlow();
	const sparkleSprites = SPARKLE_TINTS.map(makeSparkleSprite);

	let W = 0, H = 0, fieldH = 0, dpr = 1;
	let backdrop = null;  // Milky Way glow and its faint stars, drawn once
	let stars = [];       // twinkling field stars; drift a little as you scroll
	let links = [];       // brighter stars that wander slowly and link up
	let sparkles = [];    // a handful of bright four-pointed stars
	let glints = [];      // brief flares on random stars
	let meteors = [];
	let linkDist = 120;
	let nextMeteorAt = 0, nextGlintAt = 0;
	let rafId = 0, lastBg = 0, lastNow = 0, lastDrift = 0;

	const cursor = {
		on: false,      // a mouse is present and motion is allowed
		inside: false,  // the pointer is over the page
		x: 0, y: 0,     // the pointer
		sx: 0, sy: 0,   // the star, easing after the pointer
		alpha: 0,
		points: [],     // recent positions, for the tail
		specks: [],     // stardust shed along the way
		carry: 0,
		lastMoveAt: -10,
		box: null       // area drawn last frame, cleared next frame
	};

	// Stars live in a field a little taller than the screen; the wrap seams sit
	// 80px above and below it, so nothing pops in at the visible edges.
	const wrapY = (y) => ((y % fieldH) + fieldH) % fieldH;
	const screenY = (y) => wrapY(y) - 80;
	function wrapX(x) {
		const span = W + 80;
		return ((((x + 40) % span) + span) % span) - 40;
	}

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

	function makeStar(x, y, kind) {
		const s = { x, y, col: "rgb(" + pick(TINTS) + ")", ph: rand(0, Math.PI * 2) };
		if (kind === "faint") {
			s.r = rand(0.25, 0.6);
			s.a = rand(0.12, 0.38);
		} else if (kind === "link") {
			s.r = rand(0.8, 1.6);
			s.a = rand(0.55, 0.9);
			s.tw = rand(0.25, 0.6);
			s.sp = rand(0.6, 2.2);
			s.depth = rand(0.025, 0.04);
			const dir = rand(0, Math.PI * 2), speed = rand(4, 11); // px per second
			s.vx = Math.cos(dir) * speed;
			s.vy = Math.sin(dir) * speed;
		} else {
			s.r = 0.3 + Math.pow(Math.random(), 4) * 1.35;
			s.a = clamp(rand(0.35, 0.85) * (0.6 + s.r * 0.4), 0, 1);
			s.tw = Math.random() < 0.6 ? rand(0.35, 0.8) : rand(0.1, 0.3); // how deep it twinkles
			s.sp = rand(0.6, 3.2);                                          // and how fast
			s.depth = 0.012 + s.r * 0.025; // nearer (bigger) stars drift more on scroll
		}
		return s;
	}

	// Brightness 0..1: a slow swell with quicker scintillation on top.
	function shine(s, t) {
		if (still) return 1;
		const slow = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
		const fast = 0.78 + 0.22 * Math.sin(t * s.sp * 2.7 + s.ph * 1.7);
		return 1 - s.tw + s.tw * slow * fast;
	}

	function generate() {
		fieldH = H + 160;
		const area = W * H;

		stars = [];
		const n = Math.round(clamp(area / 3000, 110, 560));
		for (let i = 0; i < n; i++) stars.push(makeStar(rand(0, W), rand(0, fieldH), "field"));

		links = [];
		const nl = Math.round(clamp(area / 15000, 18, 90));
		for (let i = 0; i < nl; i++) links.push(makeStar(rand(0, W), rand(0, fieldH), "link"));
		linkDist = clamp(Math.min(W, H) * 0.14, 90, 125);

		buildBackdrop(area);

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
				y: rand(0, fieldH),
				R: rand(5, 9.5) * (W < 600 ? 0.8 : 1),
				dim: roomy ? 1 : 0.7,
				img: pick(sparkleSprites),
				sp: rand(0.35, 0.9),
				ph: rand(0, Math.PI * 2),
				rot: rand(-0.25, 0.25),
				depth: rand(0.03, 0.05)
			});
		}
	}

	// Milky Way: a soft band across the sky (steeper on portrait screens),
	// with darker dust lanes and many faint stars packed along it.
	function buildBackdrop(area) {
		const angle = (W > H ? -22 : -62) * Math.PI / 180;
		const dx = Math.cos(angle), dy = Math.sin(angle);
		const nx = -dy, ny = dx;
		const cx = W * 0.5, cy = H * 0.42;
		const L = Math.hypot(W, H) * 1.1;
		const sigma = Math.min(W, H) * 0.09;

		backdrop = document.createElement("canvas");
		backdrop.width = Math.ceil(W);
		backdrop.height = Math.ceil(H);
		const g = backdrop.getContext("2d");

		g.save();
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
		g.restore();

		const m = Math.round(clamp(area / 3800, 60, 420));
		for (let i = 0; i < m; i++) {
			const u = rand(-0.5, 0.5) * L, v = gauss() * sigma;
			const x = cx + dx * u + nx * v, y = cy + dy * u + ny * v;
			if (x < 0 || x > W || y < 0 || y > H) continue;
			const s = makeStar(x, y, "faint");
			g.globalAlpha = s.a;
			g.fillStyle = s.col;
			g.beginPath(); g.arc(x, y, s.r, 0, Math.PI * 2); g.fill();
		}
		g.globalAlpha = 1;
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

		ctx.globalAlpha = 1;
		if (backdrop) ctx.drawImage(backdrop, 0, 0, W, H);

		for (const s of stars) {
			const y = screenY(s.y - off * s.depth);
			if (y < -4 || y > H + 4) continue;
			const a = s.a * shine(s, now);
			if (s.r > 1) {
				const d = s.r * 7;
				ctx.globalAlpha = a * 0.3;
				ctx.drawImage(glow, s.x - d / 2, y - d / 2, d, d);
			}
			ctx.globalAlpha = a;
			ctx.fillStyle = s.col;
			ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, Math.PI * 2); ctx.fill();
		}

		drawLinks(now, off);
		drawSparkles(now, off);
		drawGlints(now, off);
		drawMeteors(now);
		ctx.globalAlpha = 1;
	}

	// Brighter stars wander slowly; neighbours are joined by very faint lines
	// that come and go as they drift, like the old particle background.
	function drawLinks(now, off) {
		const dt = still ? 0 : clamp(now - lastDrift, 0, 0.1);
		lastDrift = now;
		const pts = [];
		for (const s of links) {
			if (dt) {
				s.x = wrapX(s.x + s.vx * dt);
				s.y = wrapY(s.y + s.vy * dt);
			}
			pts.push({ x: s.x, y: screenY(s.y - off * s.depth), b: shine(s, now), s });
		}

		ctx.lineWidth = 0.7;
		ctx.strokeStyle = "rgb(190,205,255)";
		for (let i = 0; i < pts.length; i++) {
			const p = pts[i];
			for (let j = i + 1; j < pts.length; j++) {
				const q = pts[j];
				const ddx = p.x - q.x, ddy = p.y - q.y;
				if (ddx > linkDist || ddx < -linkDist || ddy > linkDist || ddy < -linkDist) continue;
				const d = Math.sqrt(ddx * ddx + ddy * ddy);
				if (d >= linkDist) continue;
				ctx.globalAlpha = LINK_ALPHA * (1 - d / linkDist) * (0.55 + 0.45 * Math.min(p.b, q.b));
				ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
			}
		}

		// the mouse star joins in with a few faint lines of its own
		if (cursor.on && cursor.alpha > 0.02) {
			const near = [];
			for (const p of pts) {
				const d = Math.hypot(p.x - cursor.sx, p.y - cursor.sy);
				if (d < CURSOR_REACH) near.push({ d, p });
			}
			near.sort((a, b) => a.d - b.d);
			for (const { d, p } of near.slice(0, 4)) {
				ctx.globalAlpha = 0.22 * (1 - d / CURSOR_REACH) * cursor.alpha;
				ctx.beginPath(); ctx.moveTo(cursor.sx, cursor.sy); ctx.lineTo(p.x, p.y); ctx.stroke();
			}
		}

		for (const p of pts) {
			if (p.y < -4 || p.y > H + 4) continue;
			const a = p.s.a * p.b;
			const d = p.s.r * 7;
			ctx.globalAlpha = a * 0.35;
			ctx.drawImage(glow, p.x - d / 2, p.y - d / 2, d, d);
			ctx.globalAlpha = a;
			ctx.fillStyle = p.s.col;
			ctx.beginPath(); ctx.arc(p.x, p.y, p.s.r, 0, Math.PI * 2); ctx.fill();
		}
	}

	function drawSparkles(now, off) {
		for (const s of sparkles) {
			const y = screenY(s.y - off * s.depth);
			if (y < -30 || y > H + 30) continue;
			const pulse = still ? 0.8 : 0.5 + 0.5 * Math.sin(now * s.sp + s.ph);
			const d = s.R * 5 * (0.7 + 0.45 * pulse);
			ctx.globalAlpha = (0.35 + 0.65 * pulse) * s.dim;
			ctx.save();
			ctx.translate(s.x, y);
			ctx.rotate(still ? 0 : now * s.rot);
			ctx.drawImage(s.img, -d / 2, -d / 2, d, d);
			ctx.restore();
		}
	}

	// Every fraction of a second a random star flares up for a moment.
	function drawGlints(now, off) {
		if (still) return;
		if (now >= nextGlintAt && stars.length) {
			for (let tries = 0; tries < 6; tries++) {
				const s = pick(stars);
				const y = screenY(s.y - off * s.depth);
				if (y < 10 || y > H - 10) continue;
				glints.push({
					s,
					born: now,
					life: rand(0.9, 1.6),
					size: rand(10, 18) * (W < 600 ? 0.8 : 1),
					img: pick(sparkleSprites),
					rot: rand(0, Math.PI / 4)
				});
				break;
			}
			nextGlintAt = now + (W < 600 ? rand(0.6, 1.4) : rand(0.25, 0.7));
		}
		for (let i = glints.length - 1; i >= 0; i--) {
			const g = glints[i];
			const p = (now - g.born) / g.life;
			if (p >= 1) { glints.splice(i, 1); continue; }
			if (p <= 0) continue;
			const env = Math.sin(Math.PI * p);
			const y = screenY(g.s.y - off * g.s.depth);
			const d = g.size * (0.4 + 0.6 * env);
			ctx.globalAlpha = 0.95 * env;
			ctx.save();
			ctx.translate(g.s.x, y);
			ctx.rotate(g.rot);
			ctx.drawImage(g.img, -d / 2, -d / 2, d, d);
			ctx.restore();
		}
	}

	function drawMeteors(now) {
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
	}

	// ---- the star that follows the mouse --------------------------------

	function onPointerMove(e) {
		if (!cursor.on || e.pointerType === "touch") return;
		if (cursor.alpha < 0.05) {
			// arriving: start the star right at the pointer
			cursor.sx = e.clientX;
			cursor.sy = e.clientY;
			cursor.points = [];
		}
		cursor.inside = true;
		cursor.x = e.clientX;
		cursor.y = e.clientY;
		cursor.lastMoveAt = performance.now() / 1000;
	}

	function drawCursor(now, dt) {
		const c = cursor;
		const prevX = c.sx, prevY = c.sy;
		const ease = 1 - Math.pow(0.7, dt * 60); // follows closely, trailing a little
		c.sx += (c.x - c.sx) * ease;
		c.sy += (c.y - c.sy) * ease;
		// bright while moving, softer when the mouse rests, gone when it leaves
		const target = !c.inside ? 0 : now - c.lastMoveAt > 1.5 ? 0.55 : 1;
		c.alpha += (target - c.alpha) * (1 - Math.pow(0.88, dt * 60));
		const moved = Math.hypot(c.sx - prevX, c.sy - prevY);

		if (moved > 0.3) c.points.push({ x: c.sx, y: c.sy, t: now });
		while (c.points.length && now - c.points[0].t > TAIL_LIFE) c.points.shift();

		// shed a speck of stardust every 10px or so
		c.carry += moved;
		while (c.carry > 10) {
			c.carry -= 10;
			if (c.specks.length < 80) {
				c.specks.push({
					x: c.sx + rand(-2, 2), y: c.sy + rand(-2, 2),
					vx: rand(-14, 14), vy: rand(6, 30),
					r: rand(0.5, 1.3), born: now, life: rand(0.5, 1.1),
					col: "rgb(" + pick(SPECK_TINTS) + ")"
				});
			}
		}

		if (c.box) tctx.clearRect(c.box[0], c.box[1], c.box[2] - c.box[0], c.box[3] - c.box[1]);
		c.box = null;
		if (c.alpha < 0.01 && c.points.length < 2 && !c.specks.length) return;

		const box = [Infinity, Infinity, -Infinity, -Infinity];
		const grow = (x, y, pad) => {
			if (x - pad < box[0]) box[0] = x - pad;
			if (y - pad < box[1]) box[1] = y - pad;
			if (x + pad > box[2]) box[2] = x + pad;
			if (y + pad > box[3]) box[3] = y + pad;
		};

		// the tail: a soft glow along the whole path, then a bright core that tapers off
		const pts = c.points;
		if (pts.length > 1) {
			const head = pts[pts.length - 1], end = pts[0];
			const halo = tctx.createLinearGradient(head.x, head.y, end.x, end.y);
			halo.addColorStop(0, "rgba(220,228,255,0.32)");
			halo.addColorStop(0.5, "rgba(200,190,255,0.14)");
			halo.addColorStop(1, "rgba(230,190,255,0)");
			tctx.globalAlpha = 1;
			tctx.strokeStyle = halo;
			tctx.lineWidth = 7;
			tctx.lineCap = "round";
			tctx.lineJoin = "round";
			tctx.beginPath();
			tctx.moveTo(end.x, end.y);
			for (let i = 1; i < pts.length; i++) tctx.lineTo(pts[i].x, pts[i].y);
			tctx.stroke();

			tctx.lineCap = "butt";
			for (let i = 1; i < pts.length; i++) {
				const a = pts[i - 1], b = pts[i];
				const life = 1 - (now - b.t) / TAIL_LIFE; // 1 at the head, 0 at the end
				if (life <= 0) continue;
				tctx.globalAlpha = 0.9 * Math.pow(life, 1.4);
				tctx.lineWidth = 0.4 + 2.6 * Math.pow(life, 1.2);
				tctx.strokeStyle = life > 0.6 ? "#ffffff" : life > 0.3 ? "rgb(214,224,255)" : "rgb(228,200,255)";
				tctx.beginPath(); tctx.moveTo(a.x, a.y); tctx.lineTo(b.x, b.y); tctx.stroke();
				grow(a.x, a.y, 10);
			}
			grow(head.x, head.y, 10);
		}

		for (let i = c.specks.length - 1; i >= 0; i--) {
			const s = c.specks[i];
			const p = (now - s.born) / s.life;
			if (p >= 1) { c.specks.splice(i, 1); continue; }
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			s.vx *= 0.97;
			const a = 0.9 * Math.pow(1 - p, 1.5);
			const d = s.r * 6;
			tctx.globalAlpha = a * 0.5;
			tctx.drawImage(glow, s.x - d / 2, s.y - d / 2, d, d);
			tctx.globalAlpha = a;
			tctx.fillStyle = s.col;
			tctx.beginPath(); tctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); tctx.fill();
			grow(s.x, s.y, d);
		}

		if (c.alpha > 0.01) {
			const tw = 0.88 + 0.12 * Math.sin(now * 5.1) * Math.sin(now * 2.3 + 1);
			const size = 26 * tw;
			tctx.globalAlpha = 0.5 * c.alpha;
			tctx.drawImage(glow, c.sx - 14, c.sy - 14, 28, 28);
			tctx.globalAlpha = c.alpha;
			tctx.save();
			tctx.translate(c.sx, c.sy);
			tctx.rotate(now * 0.8);
			tctx.drawImage(sparkleSprites[0], -size / 2, -size / 2, size, size);
			tctx.restore();
			grow(c.sx, c.sy, 18);
		}
		tctx.globalAlpha = 1;
		if (box[0] !== Infinity) {
			c.box = [Math.floor(box[0]) - 2, Math.floor(box[1]) - 2, Math.ceil(box[2]) + 2, Math.ceil(box[3]) + 2];
		}
	}

	function sizeTrail() {
		const tdpr = Math.min(window.devicePixelRatio || 1, 2);
		trail.width = Math.round(W * tdpr);
		trail.height = Math.round(H * tdpr);
		trail.style.width = W + "px";
		trail.style.height = H + "px";
		tctx.setTransform(tdpr, 0, 0, tdpr, 0, 0);
		cursor.box = null;
	}

	function setCursor() {
		const want = mouseQuery.matches && !still;
		if (want === cursor.on) return;
		cursor.on = want;
		cursor.points = [];
		cursor.specks = [];
		cursor.alpha = 0;
		cursor.inside = false;
		cursor.box = null;
		if (want) {
			document.body.appendChild(trail);
			sizeTrail();
		} else {
			trail.remove();
		}
	}

	window.addEventListener("pointermove", onPointerMove, { passive: true });
	window.addEventListener("mouseout", (e) => { if (!e.relatedTarget) cursor.inside = false; });
	window.addEventListener("blur", () => { cursor.inside = false; });

	// ---- running it -----------------------------------------------------

	function frame(ms) {
		rafId = requestAnimationFrame(frame);
		const now = ms / 1000;
		const dt = clamp(now - lastNow, 0, 0.05);
		lastNow = now;
		if (cursor.on) drawCursor(now, dt);
		// the sky redraws at ~30 fps, or every frame while something moves fast
		const busy = meteors.length > 0 || (cursor.on && cursor.alpha > 0.02 && now - cursor.lastMoveAt < 0.8);
		if (!busy && ms - lastBg < 32) return;
		lastBg = ms;
		if (now >= nextMeteorAt) launchMeteor(now);
		draw(now);
	}

	function start() {
		cancelAnimationFrame(rafId);
		meteors = [];
		glints = [];
		setCursor();
		if (still) {
			draw(0);
			return;
		}
		const t = performance.now() / 1000;
		lastNow = lastDrift = t;
		nextMeteorAt = t + rand(2.5, 5);
		nextGlintAt = t + 0.4;
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
		sizeTrail();
		if (regen) generate();
		if (still) draw(0);
	}

	let resizeTimer = 0;
	window.addEventListener("resize", () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => setup(false), 150);
	});

	const listen = (q, fn) => {
		if (q.addEventListener) q.addEventListener("change", fn);
		else if (q.addListener) q.addListener(fn);
	};
	listen(motionQuery, (e) => { still = e.matches; start(); });
	listen(mouseQuery, () => setCursor());

	// Lets a shooting star be sent on demand (handy from the console).
	window.starrySky = { shoot: () => { if (!still) launchMeteor(performance.now() / 1000); } };

	setup(true);
	start();
})();
