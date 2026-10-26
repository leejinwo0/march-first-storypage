/* =======================================================
   01 시대의 부름: 배경 카드 4종 + 세계지도(OSM)
   - 데이터: /js/data/history-data.js S1_ERA
   - 카드: 제목 · 영문/장소 → 사진 → 설명 순
   - 이미지 클릭 시 전역 확대 모달, 이미지 로드 실패 시 사진 영역 숨김
   - 세계지도: OpenStreetMap 타일, 카드 4곳 번호 마커
   - 마커 호버 시 장소명·날짜 툴팁, 마커·카드 클릭 시 해당 위치 확대 + 카드·마커 강조(빨간색)
   - 선택된 카드 재클릭 시 선택 해제 + 전체 보기 복귀
   - 선택 팝업(장소명·날짜): 지도 클릭 시 유지, 우측 상단 X 클릭 시 닫힘 + 선택 해제 + 전체 보기 복귀
   - 확대 상태(전체 보기 줌 초과)에서는 호버 툴팁 미표시
   - 전체 보기 축척에서 서울 마커 2개(남산·대한문) 좌우 분리 표시
   - 모바일(560px 이하): 카드 설명 숨김, 사진 클릭 시 확대 모달에 설명 함께 표시
     선택 마커를 지도 아래쪽(76% 지점)에 배치 + 팝업 축소 → 낮은 지도 높이에서 팝업 전체 표시
======================================================= */
import { S1_ERA } from "/js/data/history-data.js";

// 마커·카드 클릭 시 장소 확대 줌
const FOCUS_ZOOM = 15;
// 이 줌 미만이면 서울 마커 2개 좌우 분리 (실제 거리 약 1km → 낮은 줌에서 겹침)
const SPLIT_ZOOM = 12;
// 겹침 분리 방향: 카드 index → -1 왼쪽 / 1 오른쪽
const SPLIT_DIR = { 0: 1, 1: -1 };
// 모바일 기준: 카드 설명 → 사진 확대 모달 표시, 세계지도 여백 축소
const MOBILE_QUERY = window.matchMedia("(max-width: 560px)");
// 모바일 선택 마커 세로 위치 보정: 지도 높이의 26% 아래로 이동 (중앙 50% → 76%, 위쪽 팝업 공간 확보)
const MOBILE_MARKER_SHIFT = 0.26;

/* ---------- 1. 카드 4종 렌더링 + 사진 확대 ---------- */
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
          <span class="era-date">${item.date}</span>
          <span class="era-more" aria-hidden="true">눌러서 설명 보기</span>
        </button>
        <p class="era-body">${item.body}</p>
        ${item.quote ? `<p class="era-quote">${item.quote}</p>` : ""}
      </article>
    `,
    ).join("");

    // 사진 클릭: 확대 모달 (사진 로드 실패 카드 제외)
    grid.querySelectorAll(".era-photo").forEach((btn) => {
        btn.addEventListener("click", () => {
            const item = S1_ERA[Number(btn.dataset.index)];
            if (window.openGlobalModal && !btn.classList.contains("is-empty")) {
                // 모바일: 카드에서 숨긴 설명·인용문을 캡션 아래 표시
                const detail = MOBILE_QUERY.matches
                    ? `<span class="modal-desc">${item.body}${item.quote ? `<em>${item.quote}</em>` : ""}</span>`
                    : "";
                window.openGlobalModal(
                    item.imgUrl,
                    `${item.caption}<br><small>${item.place}</small>${detail}`,
                );
            }
        });
    });

    initEraMap(grid);
}

/* ---------- 2. 세계지도 (OSM) ---------- */
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
        // 소수 줌 허용: 화면 크기와 관계없이 파리~도쿄 범위를 지도 가로폭에 맞춤
        zoomSnap: 0,
        minZoom: 0,
    });

    // 오픈스트리트맵 타일 (흑백 필터: base.css .map-canvas .leaflet-tile-pane)
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
    // 전체 보기: 4곳 범위 맞춤 (최대 줌 5)
    // 여백: PC 좌우 70px·상하 40px / 모바일 좌우 24px·상하 22px (마커 여유)
    const FIT_OPTIONS = { maxZoom: 5 };
    const fitPadding = () => (MOBILE_QUERY.matches ? [24, 22] : [70, 40]);

    const showAll = (animate = true) =>
        map.fitBounds(bounds, {
            ...FIT_OPTIONS,
            padding: fitPadding(),
            animate,
        });

    let activeIndex = -1; // 선택 카드 번호 (-1: 선택 없음)

    // 카드·마커 선택 강조 동기화
    const setActive = (index) => {
        activeIndex = index;
        cards.forEach((card) =>
            card.classList.toggle(
                "is-active",
                Number(card.dataset.index) === index,
            ),
        );
        mapEl
            .querySelectorAll(".era-marker")
            .forEach((el) =>
                el.classList.toggle(
                    "is-active",
                    Number(el.dataset.index) === index,
                ),
            );
    };

    const markers = []; // 카드 index → 마커

    // 선택: 카드·마커 강조 + 팝업 열기 + 해당 위치 확대
    const focus = (index) => {
        const item = S1_ERA[index];
        if (!item?.latlng) return;
        setActive(index);
        markers[index]?.openPopup();
        // 모바일: 지도 높이가 낮아 중앙 배치 시 팝업 상단 잘림 → 지도 중심을 위로 옮겨 마커를 아래쪽에 배치
        let center = L.latLng(item.latlng);
        if (MOBILE_QUERY.matches) {
            const point = map.project(center, FOCUS_ZOOM);
            point.y -= mapEl.clientHeight * MOBILE_MARKER_SHIFT;
            center = map.unproject(point, FOCUS_ZOOM);
        }
        map.flyTo(center, FOCUS_ZOOM, { duration: 1.4 });
    };

    // 번호 마커 (호버: 장소명·날짜 툴팁 / 클릭: 해당 위치 확대 + 팝업)
    S1_ERA.forEach((item, index) => {
        if (!item.latlng) return;
        const icon = L.divIcon({
            className: "era-marker-wrap",
            html: `<span class="era-marker" data-index="${index}" style="--split:${SPLIT_DIR[index] || 0}">${index + 1}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });
        const marker = L.marker(item.latlng, { icon, riseOnHover: true })
            .addTo(map)
            .bindTooltip(`${item.place}<small>${item.date}</small>`, {
                className: "place-tooltip era-tooltip",
                direction: "top",
                offset: [0, -16],
            })
            // 팝업: 지도 클릭 시 유지, 우측 상단 X 클릭 시에만 닫힘 (다른 장소 선택 시 교체)
            .bindPopup(
                `<p class="era-popup-title">${item.place}</p><p class="era-popup-date">${item.date}</p>`,
                {
                    className: "story-popup era-popup",
                    offset: [0, -14],
                    closeButton: true,
                    closeOnClick: false,
                    // 확대 이동(flyTo) 중 autoPan 충돌 방지 (마커가 지도 중앙으로 이동)
                    autoPan: false,
                },
            );
        // 마커 클릭: Leaflet 기본 팝업 토글(재클릭 시 닫힘) 해제 → focus에서 열기
        marker.off("click", marker._openPopup, marker);
        marker.on("click", () => focus(index));
        // 팝업 표시 중 툴팁 숨김
        marker.on("popupopen", () => marker.closeTooltip());
        // X 클릭으로 닫힘 → 선택 해제 + 전체 보기 복귀 (다른 마커 선택으로 교체된 경우 제외)
        marker.on("popupclose", () => {
            if (activeIndex !== index) return;
            setActive(-1);
            showAll();
        });
        markers[index] = marker;
    });

    // 선택 해제: 강조 해제 + 팝업 닫기 + 전체 보기 복귀
    const clearSelection = () => {
        setActive(-1);
        map.closePopup();
        showAll();
    };

    // 카드 클릭 → 지도 위치 이동, 선택된 카드 재클릭 → 선택 해제 + 전체 보기 (사진 클릭은 확대 모달 유지)
    cards.forEach((card) => {
        card.addEventListener("click", (e) => {
            if (e.target.closest(".era-photo, a")) return;
            const index = Number(card.dataset.index);
            if (index === activeIndex) clearSelection();
            else focus(index);
        });
    });

    // 낮은 줌: 서울 마커 좌우 분리 / 확대 상태: 호버 툴팁 숨김 + 전체 보기 버튼 표시
    const update = () => {
        const zoom = map.getZoom();
        const zoomed = zoom > FIT_OPTIONS.maxZoom;
        mapEl.classList.toggle("is-split", zoom < SPLIT_ZOOM);
        mapEl.classList.toggle("is-zoomed", zoomed);
        resetBtn?.classList.toggle("show", zoomed);
    };
    map.on("zoomend", update);

    resetBtn?.addEventListener("click", clearSelection);

    // 섹션 진입 전 크기 0 대비: 크기 확정 후 전체 보기
    new ResizeObserver(() => {
        map.invalidateSize();
        if (activeIndex === -1) showAll(false);
    }).observe(mapEl);

    showAll(false);
    update();
}
