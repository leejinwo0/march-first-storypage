/* =======================================================
   04 역사의 현장: 좌측 범례 패널(필터 카드 + 2열 목록) | 우측 지도
   - 데이터: 스마트서울맵 테마 11100550, COT_THEME_SUB_ID '4' 중요 지점 / '3' 시위 장소
   - 섹션 진입 시 마커 120ms 간격 순차 표시
   - 필터 카드: 레이어 ON/OFF / 목록·마커 클릭: 확대 + 팝업, 재클릭 시 전체 보기 복귀
   - 범례 목록: 중요 지점(좌) · 시위 장소(우) 2열 분리, 필터 OFF 시 해당 열 흐리게 표시
   - 마커 호버: 장소명 툴팁 표시
   - 경성대지도 전환 시 줌 1단계 축소 (장소 확대 줌도 동일 보정)
   - 팝업: 우측 상단 X 클릭 시 팝업만 닫힘(확대·선택 유지), 지도 클릭 시 유지, 설명은 '더보기' 클릭 시 펼침
   - 확대 상태: 호버 툴팁 미표시, 선택 장소 재클릭 시 팝업 표시 중이면 전체 보기 / 닫힌 상태면 팝업 재표시
   - 모바일(1024px 이하): 팝업에 분류·장소명·더보기만 표시, 더보기 클릭 시 하단 시트로 상세(주소·설명·스마트서울맵) 표시
======================================================= */
import { fetchTimeTravelData } from "/services/mapService.js";
import { createStoryMap } from "/js/utils/mapUtils.js";
import { setStat, openSheet } from "/js/utils/uiUtils.js";

// 장소 분류: 테마 하위 분류 ID · 표시명 · 마커 클래스
const CATEGORY = {
    hub: {
        subId: "4",
        label: "중요 지점",
        markerClass: "place-pin place-pin-hub",
    },
    site: {
        subId: "3",
        label: "시위 장소",
        markerClass: "place-pin place-pin-site",
    },
};

// 장소 클릭 시 확대 줌: PC 10 / 모바일 7 (작은 지도 → 주변 범위 함께 표시)
const MOBILE_QUERY = window.matchMedia("(max-width: 1024px)");
const FOCUS_ZOOM = 10;
const FOCUS_ZOOM_MOBILE = 7;

// 팝업 내용 DOM 생성: 좌측 분류 배지 · 장소명 · 주소 / 우측 [스마트서울맵]·[더보기] 세로 배치 → 설명(접힘)
function createPopupContent(place, mapLink) {
    const el = document.createElement("div");
    el.className = "story-popup-inner";
    el.innerHTML = `
    <div class="popup-head">
      <div class="popup-head-text">
        <span class="popup-badge popup-badge-${place.key}">${CATEGORY[place.key].label}</span>
        <h3>${place.name}</h3>
        <p class="popup-addr">${place.address}</p>
      </div>
      <div class="popup-actions">
        <a class="line-btn line-btn-red" href="${mapLink}" target="_blank" rel="noopener noreferrer">스마트서울맵</a>
        <button type="button" class="line-btn line-btn-gold popup-more-btn" aria-expanded="false">더보기</button>
      </div>
    </div>
    <div class="popup-desc" hidden>${place.desc}</div>
  `;
    return el;
}

// 모바일 상세 시트 내용: 분류 배지 · 장소명 · 주소 · 설명 · 스마트서울맵
function createSheetContent(place, mapLink) {
    return `
    <article class="place-sheet">
      <span class="popup-badge popup-badge-${place.key}">${CATEGORY[place.key].label}</span>
      <h3 class="place-sheet-title">${place.name}</h3>
      <p class="place-sheet-addr">${place.address}</p>
      <div class="place-sheet-desc">${place.desc}</div>
      <a class="line-btn line-btn-red place-sheet-link" href="${mapLink}" target="_blank" rel="noopener noreferrer">스마트서울맵</a>
    </article>`;
}

export async function initPlaces() {
    const list = document.getElementById("s4-list");
    const columns = {
        hub: document.getElementById("s4-list-hub"),
        site: document.getElementById("s4-list-site"),
    };
    const resetBtn = document.getElementById("s4-reset");
    const filterBtns = document.querySelectorAll("#s4-filters .places-filter");
    const mapEl = document.getElementById("map-s4");
    if (!mapEl || !list || !columns.hub || !columns.site) return;

    // 정수 줌 고정: 소수 줌 단계에서 기본지도 타일 미표시 방지
    // 더블클릭 확대 비활성: 마커 연속 클릭 시 추가 확대 방지 (장소 확대는 FOCUS_ZOOM 고정)
    const { map, zoomFor } = createStoryMap("map-s4", {
        center: [37.5586, 126.9369],
        zoom: 7,
        // 경성대지도: 일반지도 기준 1단계 축소 (복귀 시 복원)
        zoomOffset: 1,
        mapOptions: { zoomSnap: 1, doubleClickZoom: false },
    });
    const layers = {
        hub: L.layerGroup().addTo(map),
        site: L.layerGroup().addTo(map),
    };
    let defaultBounds = null;

    // 범례 패널이 지도 밖에 위치 → 균등 여백
    const FIT_PADDING = { padding: [40, 40] };

    // 전체 보기: 모든 장소 범위 맞춤 + 팝업 닫기 + 목록 선택 해제
    const showAll = () => {
        if (defaultBounds)
            map.fitBounds(defaultBounds, {
                ...FIT_PADDING,
                maxZoom: 11,
                animate: true,
            });
        map.closePopup();
        list.querySelectorAll(".places-item").forEach((li) =>
            li.classList.remove("active"),
        );
    };

    // 확대 상태(장소 선택 또는 전체 보기보다 확대): 전체 보기 버튼 표시 + 호버 툴팁 숨김(.is-zoomed)
    const updateReset = () => {
        const base = defaultBounds ? map.getBoundsZoom(defaultBounds) : 7;
        const hasActive = !!list.querySelector(".places-item.active");
        const zoomed = hasActive || map.getZoom() > base + 0.5;
        resetBtn?.classList.toggle("show", zoomed);
        mapEl.classList.toggle("is-zoomed", zoomed);
    };
    map.on("zoomend", updateReset);
    resetBtn?.addEventListener("click", () => {
        showAll();
        updateReset();
    });

    const geojson = await fetchTimeTravelData();

    const places = [];
    geojson.features.forEach((feature) => {
        const props = feature.properties;
        const key = Object.keys(CATEGORY).find(
            (k) => CATEGORY[k].subId === String(props.COT_THEME_SUB_ID),
        );
        if (!key || !props.COT_COORD_Y || !props.COT_COORD_X) return;
        places.push({
            key,
            name: props.COT_CONTS_NAME || "알 수 없는 장소",
            address:
                props.COT_ADDR_FULL_NEW ||
                props.COT_ADDR_FULL_OLD ||
                "주소 정보 없음",
            desc: (
                props.COT_VALUE_03 ||
                props.COT_VALUE_01 ||
                "상세 설명이 없습니다."
            ).replace(/\n/g, "<br>"),
            poiId: props.COT_CONTS_ID,
            latlng: [
                parseFloat(props.COT_COORD_Y),
                parseFloat(props.COT_COORD_X),
            ],
        });
    });

    const hubCount = places.filter((p) => p.key === "hub").length;
    const siteCount = places.filter((p) => p.key === "site").length;
    setStat("hub", hubCount);
    setStat("site", siteCount);
    setStat("place-total", hubCount + siteCount);

    if (places.length)
        defaultBounds = L.latLngBounds(places.map((p) => p.latlng));

    // 1. 목록 + 마커 생성
    places.forEach((place) => {
        const mapLink = `https://map.seoul.go.kr/smgis2/poiViewMap?ti=11100550&pi=${place.poiId}&lang=ko`;
        place.marker = L.marker(place.latlng, {
            icon: L.divIcon({
                className: "place-pin-wrap",
                html: `<span class="${CATEGORY[place.key].markerClass}"></span>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
            }),
        });
        // 호버 툴팁: 장소명
        place.marker.bindTooltip(place.name, {
            className: "place-tooltip",
            direction: "top",
            offset: [0, -18],
        });

        // 팝업: 지도 클릭 시 유지 (X 클릭 · 다른 장소 선택 · 재클릭 시 닫힘)
        const popupEl = createPopupContent(place, mapLink);
        const moreBtn = popupEl.querySelector(".popup-more-btn");
        const descEl = popupEl.querySelector(".popup-desc");
        const setDesc = (open) => {
            descEl.hidden = !open;
            moreBtn.textContent = open ? "접기" : "더보기";
            moreBtn.setAttribute("aria-expanded", String(open));
        };
        moreBtn.addEventListener("click", () => {
            // 모바일: 하단 시트로 상세 표시
            if (MOBILE_QUERY.matches) {
                openSheet(createSheetContent(place, mapLink));
                return;
            }
            setDesc(descEl.hidden);
            place.marker.getPopup()?.update(); // 높이 변경 후 팝업 위치 재계산
        });
        place.marker.bindPopup(popupEl, {
            className: "story-popup",
            maxWidth: 420,
            offset: [0, -12],
            // X 버튼: 팝업만 닫기 (확대·선택 상태 유지)
            closeButton: true,
            closeOnClick: false,
            autoPanPaddingTopLeft: [12, 60],
            autoPanPaddingBottomRight: [12, 12],
        });
        // 팝업 열릴 때 설명 접힘 상태로 초기화, 툴팁 숨김
        place.marker.on("popupopen", () => {
            setDesc(false);
            place.marker.closeTooltip();
        });

        // 분류별 열(좌 중요 지점 / 우 시위 장소)에 항목 추가
        const li = document.createElement("li");
        li.className = `places-item places-item-${place.key}`;
        li.innerHTML = `<button type="button"><i class="legend-dot legend-${place.key}"></i>${place.name}</button>`;
        columns[place.key].appendChild(li);
        place.li = li;

        const activate = () => {
            if (li.classList.contains("active")) {
                // 선택 장소 재클릭: 팝업 표시 중이면 전체 보기 복귀, X로 닫은 상태면 팝업만 다시 표시
                if (place.marker.isPopupOpen()) showAll();
                else place.marker.openPopup();
                return;
            }
            // 필터 OFF 상태면 해당 레이어 재활성화
            const btn = document.querySelector(
                `#s4-filters [data-filter="${place.key}"]`,
            );
            if (btn && !btn.classList.contains("is-on"))
                toggleFilter(btn, true);

            list.querySelectorAll(".places-item").forEach((item) =>
                item.classList.remove("active"),
            );
            li.classList.add("active");
            li.scrollIntoView({ block: "nearest", behavior: "smooth" });
            updateReset();

            // 팝업 공간 확보용 Y 오프셋: 지도 높이의 10% (최대 120px) → 마커를 중앙보다 약간 아래 배치
            // 경성대지도 표시 중이면 1단계 축소 줌 적용 (zoomFor)
            const zoom = zoomFor(
                MOBILE_QUERY.matches ? FOCUS_ZOOM_MOBILE : FOCUS_ZOOM,
            );
            const point = map.project(place.latlng, zoom);
            point.y -= Math.min(120, mapEl.clientHeight * 0.1);

            // 팝업은 지도 이동 완료 후 열기
            // (이동 애니메이션 중 팝업 autoPan 실행 시 줌 애니메이션 중단 → 타일 미표시 회색 화면 발생)
            place.marker.closePopup();
            let opened = false;
            const openAfterMove = () => {
                if (opened) return;
                opened = true;
                place.marker.openPopup();
            };
            map.once("moveend", openAfterMove);
            setTimeout(openAfterMove, 1000); // 이동 없음(moveend 미발생) 대비
            map.setView(map.unproject(point, zoom), zoom, {
                animate: true,
                duration: 0.8,
            });
        };

        li.querySelector("button").addEventListener("click", activate);
        // 마커 클릭: Leaflet 기본 즉시 팝업 열림 해제 후 activate에서 이동 완료 시점에 열기
        place.marker.off("click", place.marker._openPopup, place.marker);
        place.marker.on("click", activate);
    });

    // 2. 필터 카드 토글
    function toggleFilter(btn, force) {
        const key = btn.dataset.filter;
        const on = force ?? !btn.classList.contains("is-on");
        btn.classList.toggle("is-on", on);
        btn.setAttribute("aria-pressed", String(on));
        if (on) map.addLayer(layers[key]);
        else map.removeLayer(layers[key]);
        // 목록 열: 숨기지 않고 흐리게 표시 (항목 클릭 시 필터 자동 재활성화)
        columns[key].classList.toggle("is-off", !on);
        if (!on)
            columns[key]
                .querySelectorAll(".places-item")
                .forEach((li) => li.classList.remove("active"));
    }
    filterBtns.forEach((btn) =>
        btn.addEventListener("click", () => toggleFilter(btn)),
    );

    // 3. 섹션 진입 시 전체 보기 + 마커 순차 표시 (1회)
    let triggered = false;
    new IntersectionObserver(
        (entries, observer) => {
            if (!entries.some((e) => e.isIntersecting) || triggered) return;
            triggered = true;
            observer.disconnect();
            map.invalidateSize();
            if (defaultBounds)
                map.fitBounds(defaultBounds, {
                    ...FIT_PADDING,
                    maxZoom: 11,
                    animate: false,
                });
            const delay = { hub: 0, site: 0 };
            places.forEach((place) => {
                setTimeout(
                    () => place.marker.addTo(layers[place.key]),
                    delay[place.key],
                );
                delay[place.key] += 120;
            });
        },
        { threshold: 0.25 },
    ).observe(mapEl);
}
