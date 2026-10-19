/* =======================================================
   01 시대의 부름: 배경 카드 4종 + 세계지도(OSM)
   - 데이터: /js/data/history-data.js S1_ERA
   - 카드: 제목 · 영문/장소 → 사진 → 설명 순
   - 이미지 클릭 시 전역 확대 모달, 이미지 로드 실패 시 사진 영역 숨김
   - 세계지도: OpenStreetMap 타일, 카드 4곳 번호 마커
   - 마커 호버 시 장소명 툴팁, 마커·카드 클릭 시 해당 위치 확대 + 카드 강조
   - 전체 보기 축척에서 서울 마커 2개(남산·대한문) 좌우 분리 표시
======================================================= */
import { S1_ERA } from "/js/data/history-data.js";

// 장소 확대 줌
const FOCUS_ZOOM = 15;
// 이 줌 미만이면 서울 마커 2개 좌우 분리 (실제 거리 약 1km → 낮은 줌에서 겹침)
const SPLIT_ZOOM = 12;
// 겹침 분리 방향: 카드 index → -1 왼쪽 / 1 오른쪽
const SPLIT_DIR = { 0: 1, 1: -1 };

export function initEra() {
  const grid = document.getElementById("s1-era");
  if (!grid) return;

  grid.innerHTML = S1_ERA.map(
    (item, index) => `
      <article class="era-card reveal" style="--delay:${index * 80}ms" data-index="${index}">
        <h3 class="era-title">${item.title}</h3>
        <p class="era-en">${item.en} · ${item.place}</p>
        <button type="button" class="era-photo" data-index="${index}" aria-label="${item.caption} 확대 보기">
          <img src="${item.imgUrl}" alt="${item.caption}" loading="lazy" onerror="this.closest('.era-photo').classList.add('is-empty'); this.remove();">
          <span class="era-chip">${item.label}</span>
          <span class="era-date">${item.date}</span>
        </button>
        <p class="era-body">${item.body}</p>
        ${item.quote ? `<p class="era-quote">${item.quote}</p>` : ""}
      </article>
    `,
  ).join("");

  grid.querySelectorAll(".era-photo").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = S1_ERA[Number(btn.dataset.index)];
      if (window.openGlobalModal && !btn.classList.contains("is-empty")) {
        window.openGlobalModal(
          item.imgUrl,
          `${item.caption}<br><small>${item.place}</small>`,
        );
      }
    });
  });

  initEraMap(grid);
}

/* ---------- 세계지도 (OSM) ---------- */
function initEraMap(grid) {
  const mapEl = document.getElementById("map-s1");
  const resetBtn = document.getElementById("s1-reset");
  if (!mapEl || typeof L === "undefined") return;

  const items = S1_ERA.filter((item) => item.latlng);
  if (!items.length) return;

  const map = L.map(mapEl, {
    zoomControl: false,
    scrollWheelZoom: false,
    attributionControl: false,
    worldCopyJump: true,
    minZoom: 2,
  });

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(map);

  // OSM 이용 조건: 저작권 표기 필수
  L.control
    .attribution({ prefix: false, position: "bottomright" })
    .addAttribution(
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    )
    .addTo(map);

  const cards = [...grid.querySelectorAll(".era-card")];
  const bounds = L.latLngBounds(items.map((item) => item.latlng));
  const FIT_OPTIONS = { padding: [60, 60], maxZoom: 5 };

  const showAll = (animate = true) =>
    map.fitBounds(bounds, { ...FIT_OPTIONS, animate });

  let activeIndex = -1;

  const setActive = (index) => {
    activeIndex = index;
    cards.forEach((card) =>
      card.classList.toggle("is-active", Number(card.dataset.index) === index),
    );
    mapEl
      .querySelectorAll(".era-marker")
      .forEach((el) =>
        el.classList.toggle("is-active", Number(el.dataset.index) === index),
      );
  };

  const focus = (index) => {
    const item = S1_ERA[index];
    if (!item?.latlng) return;
    setActive(index);
    map.flyTo(item.latlng, FOCUS_ZOOM, { duration: 1.4 });
  };

  // 번호 마커
  S1_ERA.forEach((item, index) => {
    if (!item.latlng) return;
    const icon = L.divIcon({
      className: "era-marker-wrap",
      html: `<span class="era-marker" data-index="${index}" style="--split:${SPLIT_DIR[index] || 0}">${index + 1}</span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    L.marker(item.latlng, { icon, riseOnHover: true })
      .addTo(map)
      .bindTooltip(`${item.place}<small>${item.date}</small>`, {
        className: "place-tooltip era-tooltip",
        direction: "top",
        offset: [0, -16],
      })
      .on("click", () => focus(index));
  });

  // 카드 클릭 → 지도 위치 이동 (사진 클릭은 확대 모달 유지)
  cards.forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".era-photo, a")) return;
      focus(Number(card.dataset.index));
    });
  });

  // 낮은 줌: 서울 마커 좌우 분리 / 전체 보기 버튼 표시
  const update = () => {
    const zoom = map.getZoom();
    mapEl.classList.toggle("is-split", zoom < SPLIT_ZOOM);
    resetBtn?.classList.toggle("show", zoom > FIT_OPTIONS.maxZoom);
  };
  map.on("zoomend", update);

  resetBtn?.addEventListener("click", () => {
    setActive(-1);
    showAll();
  });

  // 섹션 진입 전 크기 0 대비: 크기 확정 후 전체 보기
  new ResizeObserver(() => {
    map.invalidateSize();
    if (activeIndex === -1) showAll(false);
  }).observe(mapEl);

  showAll(false);
  update();
}
