/* =======================================================
   1. 상단 내비게이션 · TOP 버튼 · 등장 애니메이션
======================================================= */
export function initGlobalUI() {
  const topNav = document.querySelector(".top-nav");
  const navLinks = document.querySelectorAll(".top-nav-link");
  const sections = document.querySelectorAll("[data-section]");

  // 화면 중앙 40% 구간에 들어온 섹션 기준 내비 활성 표시
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const current = entry.target.getAttribute("data-section");
        navLinks.forEach((link) => {
          link.classList.toggle(
            "active",
            link.getAttribute("data-target-section") === current,
          );
        });
      });
    },
    { rootMargin: "-40% 0px -40% 0px", threshold: 0 },
  );
  sections.forEach((section) => sectionObserver.observe(section));

  const backToTopBtn = document.getElementById("backToTopBtn");
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      if (topNav) topNav.classList.toggle("is-scrolled", y > 80);
      if (backToTopBtn) backToTopBtn.classList.toggle("show", y > 300);
    },
    { passive: true },
  );
  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  }

  // .reveal 요소: 화면 진입 시 .is-visible 부여 (1회)
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );
  document
    .querySelectorAll(".reveal")
    .forEach((el) => revealObserver.observe(el));
}

/* =======================================================
   2. 전역 이미지 확대 모달
   - 섹션 JS에서 window.openGlobalModal(이미지 URL, 캡션) 호출
======================================================= */
export function initGlobalModal() {
  const modal = document.getElementById("image-modal");
  const modalImg = document.getElementById("img-in-modal");
  const caption = document.getElementById("caption-modal");
  if (!modal || !modalImg || !caption) return;

  window.openGlobalModal = (imgUrl, text, options = {}) => {
    modal.classList.toggle("is-full", Boolean(options.full));
    modalImg.src = imgUrl;
    modalImg.alt = text || "";
    caption.innerHTML = text || "";
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
  };

  const close = () => {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
  };
  window.closeGlobalModal = close;

  modal.querySelector(".close-modal")?.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) close();
  });
}

/* =======================================================
   3. 수치 띠 값 갱신 (data-stat 속성 기준)
======================================================= */
export function setStat(key, value) {
  document.querySelectorAll(`[data-stat="${key}"]`).forEach((el) => {
    el.textContent = value;
  });
}

/* =======================================================
   4. 한글 문자열 첫 글자 초성 추출 (섹션 5 검색용)
======================================================= */
export function getInitialConsonant(word) {
  if (!word) return "";
  const consonants = [
    "ㄱ",
    "ㄲ",
    "ㄴ",
    "ㄷ",
    "ㄸ",
    "ㄹ",
    "ㅁ",
    "ㅂ",
    "ㅃ",
    "ㅅ",
    "ㅆ",
    "ㅇ",
    "ㅈ",
    "ㅉ",
    "ㅊ",
    "ㅋ",
    "ㅌ",
    "ㅍ",
    "ㅎ",
  ];
  const code = word.charCodeAt(0);
  if (code < 44032 || code > 55203) return "";
  const cho = consonants[Math.floor((code - 44032) / 588)];
  const mapDouble = { ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ" };
  return mapDouble[cho] || cho;
}

/* =======================================================
   5. 이미지 URL 처리 (섹션 2·5 공용)
   - 상대경로 → 스마트서울맵 https 절대경로
   - http 외부 이미지 → weserv 프록시 (HTTPS 혼합 콘텐츠 차단 회피)
======================================================= */
export function toAbsoluteUrl(url) {
  const value = String(url || "").trim();
  if (!value || value === "null") return "";
  if (value.startsWith("http://map.seoul.go.kr"))
    return value.replace("http://", "https://");
  if (value.startsWith("http")) return value;
  return "https://map.seoul.go.kr" + (value.startsWith("/") ? "" : "/") + value;
}

export function toSafeImageUrl(url) {
  const abs = toAbsoluteUrl(url);
  return abs.startsWith("http://")
    ? "https://images.weserv.nl/?url=" + encodeURIComponent(abs)
    : abs;
}

// 이미지 후보 목록: COT_IMG_MAIN_URL1~4(스마트서울맵) → COT_IMG_MAIN_URL(프록시) → 원본
export function getImageCandidates(props) {
  const list = [
    "COT_IMG_MAIN_URL1",
    "COT_IMG_MAIN_URL2",
    "COT_IMG_MAIN_URL3",
    "COT_IMG_MAIN_URL4",
  ].map((key) => toAbsoluteUrl(props[key]));
  const main = toAbsoluteUrl(props.COT_IMG_MAIN_URL);
  if (main.startsWith("http://"))
    list.push("https://images.weserv.nl/?url=" + encodeURIComponent(main));
  list.push(main);
  return [...new Set(list.filter(Boolean))];
}

// <img>에 후보 URL 순차 적용, 전체 실패(404 등) 시 onFail 호출
export function attachImageFallback(img, candidates, onFail) {
  let index = 0;
  img.addEventListener("error", () => {
    index++;
    if (index < candidates.length) {
      img.src = candidates[index];
      return;
    }
    if (onFail) onFail(img);
    else img.hidden = true;
  });
}
