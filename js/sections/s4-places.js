/* =======================================================
   04 역사의 현장: 필터 지도 + 범례 (중요 지점 / 시위 장소)
   - 데이터: 스마트서울맵 테마 11100550, COT_THEME_SUB_ID '4' 중요 지점 / '3' 시위 장소
   - 섹션 진입 시 마커 150ms 간격 순차 표시
   - 필터 카드: 레이어 ON/OFF / 목록·마커 클릭: 확대 + 팝업, 재클릭 시 전체 보기 복귀
   - 범례 목록: 중요 지점 → 시위 장소 순 그룹 표시
======================================================= */
import { fetchTimeTravelData } from "/api/mapService.js";
import { createStoryMap } from "/js/utils/mapUtils.js";
import { setStat } from "/js/utils/uiUtils.js";

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

export async function initPlaces() {
  const list = document.getElementById("s4-list");
  const resetBtn = document.getElementById("s4-reset");
  const filterBtns = document.querySelectorAll("#s4-filters .places-filter");
  const mapEl = document.getElementById("map-s4");
  if (!mapEl || !list) return;

  const { map } = createStoryMap("map-s4", {
    center: [37.5586, 126.9369],
    zoom: 7,
  });
  const layers = {
    hub: L.layerGroup().addTo(map),
    site: L.layerGroup().addTo(map),
  };
  let defaultBounds = null;

  const isDesktop = () => window.matchMedia("(min-width: 1025px)").matches;
  // 범례 패널(좌측) 영역 제외 여백
  const fitPadding = () =>
    isDesktop()
      ? { paddingTopLeft: [400, 40], paddingBottomRight: [40, 40] }
      : { padding: [30, 30] };

  const showAll = () => {
    if (defaultBounds)
      map.fitBounds(defaultBounds, {
        ...fitPadding(),
        maxZoom: 11,
        animate: true,
      });
    map.closePopup();
    list
      .querySelectorAll(".places-item")
      .forEach((li) => li.classList.remove("active"));
  };

  map.on("zoomend", () => {
    const base = defaultBounds ? map.getBoundsZoom(defaultBounds) : 7;
    resetBtn?.classList.toggle("show", map.getZoom() > base + 0.5);
  });
  resetBtn?.addEventListener("click", showAll);

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
        props.COT_ADDR_FULL_NEW || props.COT_ADDR_FULL_OLD || "주소 정보 없음",
      desc: (
        props.COT_VALUE_03 ||
        props.COT_VALUE_01 ||
        "상세 설명이 없습니다."
      ).replace(/\n/g, "<br>"),
      poiId: props.COT_CONTS_ID,
      latlng: [parseFloat(props.COT_COORD_Y), parseFloat(props.COT_COORD_X)],
    });
  });

  const hubCount = places.filter((p) => p.key === "hub").length;
  const siteCount = places.filter((p) => p.key === "site").length;
  setStat("hub", hubCount);
  setStat("site", siteCount);
  setStat("place-total", hubCount + siteCount);

  if (places.length)
    defaultBounds = L.latLngBounds(places.map((p) => p.latlng));

  // 목록 순서: 중요 지점 → 시위 장소 (분류별 그룹)
  places.sort((a, b) => (a.key === b.key ? 0 : a.key === "hub" ? -1 : 1));
  let lastKey = "";

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
    place.marker.bindPopup(
      `<div class="story-popup-inner">
        <span class="popup-badge popup-badge-${place.key}">${CATEGORY[place.key].label}</span>
        <h3>${place.name}</h3>
        <p class="popup-addr">${place.address}</p>
        <div class="popup-desc">${place.desc}</div>
        <div class="btn-pair">
          <a class="line-btn line-btn-red" href="${mapLink}" target="_blank" rel="noopener noreferrer">스마트서울맵</a>
          <a class="line-btn line-btn-gold" href="https://history.seoul.go.kr/" target="_blank" rel="noopener noreferrer">역사편찬원</a>
        </div>
      </div>`,
      { className: "story-popup", maxWidth: 420, offset: [0, -12] },
    );

    // 분류가 바뀌는 지점에 그룹 제목 삽입
    if (place.key !== lastKey) {
      const head = document.createElement("li");
      head.className = `places-group places-group-${place.key}`;
      head.innerHTML = `<i class="legend-dot legend-${place.key}"></i>${CATEGORY[place.key].label}`;
      list.appendChild(head);
      lastKey = place.key;
    }

    const li = document.createElement("li");
    li.className = `places-item places-item-${place.key}`;
    li.innerHTML = `<button type="button"><i class="legend-dot legend-${place.key}"></i>${place.name}</button>`;
    list.appendChild(li);
    place.li = li;

    const activate = () => {
      if (li.classList.contains("active")) {
        showAll();
        return;
      }
      // 필터 OFF 상태면 해당 레이어 재활성화
      const btn = document.querySelector(
        `#s4-filters [data-filter="${place.key}"]`,
      );
      if (btn && !btn.classList.contains("is-on")) toggleFilter(btn, true);

      list
        .querySelectorAll(".places-item")
        .forEach((item) => item.classList.remove("active"));
      li.classList.add("active");
      li.scrollIntoView({ block: "nearest", behavior: "smooth" });

      // 데스크톱: 좌측 범례 패널을 피하도록 X -180px, 팝업 공간 확보용 Y -120px 오프셋
      const zoom = 13;
      const point = map.project(place.latlng, zoom);
      if (isDesktop()) point.x -= 180;
      point.y -= 120;
      map.setView(map.unproject(point, zoom), zoom, {
        animate: true,
        duration: 0.8,
      });
      setTimeout(() => place.marker.openPopup(), 350);
    };

    li.querySelector("button").addEventListener("click", activate);
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
    list.querySelectorAll(`.places-group-${key}`).forEach((head) => {
      head.hidden = !on;
    });
    list.querySelectorAll(`.places-item-${key}`).forEach((li) => {
      li.hidden = !on;
      if (!on) li.classList.remove("active");
    });
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
          ...fitPadding(),
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
