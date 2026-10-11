// Liquid-glass navigation: a white thumb that rests on the current section,
// glides to whatever you hover, and springs back when you leave.
(function () {
	const track = document.querySelector(".glass-nav-track");
	if (!track) return;

	const thumb = track.querySelector(".glass-nav-thumb");
	const items = Array.from(track.querySelectorAll(".glass-nav-item"));

	// Real refraction only renders in Chromium; elsewhere the plain blur is used.
	const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
	if (brands.some((b) => /Chromium/i.test(b.brand))) {
		document.documentElement.classList.add("lg-refract");
	}

	// Items that point at a section on this page, in page order.
	const sectionItems = items
		.map((item) => {
			const id = (item.getAttribute("href") || "").replace(/^#/, "");
			const el = item.getAttribute("href").startsWith("#") && document.getElementById(id);
			return el ? { item, el } : null;
		})
		.filter(Boolean);

	let current = sectionItems.length ? sectionItems[0].item : null;
	let hovered = null;

	function place(target, animate) {
		if (!target) {
			thumb.classList.remove("is-ready");
			return;
		}
		thumb.classList.toggle("no-anim", !animate);
		thumb.style.width = target.offsetWidth + "px";
		thumb.style.transform = "translateX(" + target.offsetLeft + "px)";
		thumb.classList.add("is-ready");
		items.forEach((i) => i.classList.toggle("is-current", i === target));
		if (!animate) {
			// let the browser apply the jump before animations come back
			requestAnimationFrame(() => thumb.classList.remove("no-anim"));
		}
	}

	function keepInView(target) {
		if (track.scrollWidth <= track.clientWidth) return;
		const left = target.offsetLeft - 24;
		const right = target.offsetLeft + target.offsetWidth + 24;
		if (left < track.scrollLeft || right > track.scrollLeft + track.clientWidth) {
			track.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
		}
	}

	// Which on-page section is under the nav right now?
	function sectionAtTop() {
		const line = window.scrollY + window.innerHeight * 0.32;
		let found = sectionItems[0];
		for (const s of sectionItems) {
			if (s.el.offsetTop <= line) found = s;
		}
		// At the very bottom of the page, nothing below is reachable: keep the last one passed.
		return found ? found.item : null;
	}

	let ticking = false;
	function onScroll() {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => {
			ticking = false;
			const next = sectionAtTop();
			if (next !== current) {
				current = next;
				if (!hovered) {
					place(current, true);
					keepInView(current);
				}
			}
		});
	}

	items.forEach((item) => {
		item.addEventListener("pointerenter", (e) => {
			if (e.pointerType !== "mouse") return;
			hovered = item;
			place(item, true);
		});
		item.addEventListener("focus", () => {
			hovered = item;
			place(item, true);
			keepInView(item);
		});
		item.addEventListener("blur", () => {
			hovered = null;
			place(current, true);
		});
		item.addEventListener("click", () => {
			if (item.getAttribute("href").startsWith("#")) {
				current = item;
				place(item, true);
			}
		});
	});

	track.addEventListener("pointerleave", () => {
		hovered = null;
		place(current, true);
	});

	function updateEdges() {
		const max = track.scrollWidth - track.clientWidth;
		track.classList.toggle("more-left", track.scrollLeft > 4);
		track.classList.toggle("more-right", track.scrollLeft < max - 4);
	}
	track.addEventListener("scroll", updateEdges, { passive: true });
	window.addEventListener("resize", updateEdges);
	updateEdges();

	window.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("resize", () => place(hovered || current, false));
	// Fonts change item widths once they load.
	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(() => place(hovered || current, false));
	}

	current = sectionAtTop() || current;
	place(current, false);
})();
