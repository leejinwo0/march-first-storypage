/* =======================================================
   1. 전역 스크롤 및 UI 컨트롤
======================================================= */
export function initGlobalUI() {
  const dots = document.querySelectorAll(".global-dot");
  const sections = document.querySelectorAll(".scroll-section");

  const observerOptions = {
    root: null,
    rootMargin: "-40% 0px -40% 0px",
    threshold: 0,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const currentNum = entry.target.getAttribute("data-section");
        dots.forEach((dot) => {
          dot.classList.remove("active");
          if (dot.getAttribute("data-target-section") === currentNum)
            dot.classList.add("active");
        });
      }
    });
  }, observerOptions);

  sections.forEach((section) => observer.observe(section));

  dots.forEach((dot) => {
    dot.addEventListener("click", function () {
      const targetNum = this.getAttribute("data-target-section");
      const targetSection = document.querySelector(
        `.scroll-section[data-section="${targetNum}"]`,
      );
      if (targetSection) targetSection.scrollIntoView({ behavior: "smooth" });
    });
  });

  const backToTopBtn = document.getElementById("backToTopBtn");
  if (backToTopBtn) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 300) backToTopBtn.classList.add("show");
      else backToTopBtn.classList.remove("show");
    });
    backToTopBtn.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  }
}

/* =======================================================
   2. 한글 문자열에서 첫 글자의 초성 추출 (섹션 5 검색용)
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
  const firstChar = word.charCodeAt(0);

  if (firstChar >= 44032 && firstChar <= 55203) {
    const index = Math.floor((firstChar - 44032) / 588);
    let cho = consonants[index];
    const mapDouble = { ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ" };
    return mapDouble[cho] || cho;
  }
  return "";
}
