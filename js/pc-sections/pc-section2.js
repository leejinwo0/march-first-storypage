import {
  fetchTimeTravelData,
  MAP_ENDPOINTS,
  HISTORICAL_MAPS,
} from "/api/mapService.js";
import { addMapToggleControl, generateCurvedPath } from "/js/utils/mapUtils.js";

/* -------------------------------------------------------
   이미지 후보 URL 목록 생성
   - 1순위: COT_IMG_MAIN_URL1~4 (스마트서울맵 서버 상대경로 → https 절대경로)
   - 2순위: COT_IMG_MAIN_URL (외부 http 이미지 → weserv 프록시, 이후 원본 직접 요청)
   - 빈 값·중복 제거
------------------------------------------------------- */
function toAbsoluteUrl(url) {
  const value = String(url || "").trim();
  if (!value || value === "null") return "";
  if (value.startsWith("http://map.seoul.go.kr"))
    return value.replace("http://", "https://");
  if (value.startsWith("http")) return value;
  return "https://map.seoul.go.kr" + (value.startsWith("/") ? "" : "/") + value;
}

function getImageCandidates(props) {
  const candidates = [];

  [
    "COT_IMG_MAIN_URL1",
    "COT_IMG_MAIN_URL2",
    "COT_IMG_MAIN_URL3",
    "COT_IMG_MAIN_URL4",
  ].forEach((key) => candidates.push(toAbsoluteUrl(props[key])));

  const mainUrl = toAbsoluteUrl(props.COT_IMG_MAIN_URL);
  if (mainUrl.startsWith("http://")) {
    // http 이미지 → 이미지 프록시(weserv) 경유 (HTTPS 페이지 혼합 콘텐츠 차단 회피)
    candidates.push(
      "https://images.weserv.nl/?url=" + encodeURIComponent(mainUrl),
    );
  }
  candidates.push(mainUrl);

  return [...new Set(candidates.filter(Boolean))];
}

/* =======================================================
   Section 2: 거사의 맹세 (스크롤 연동 타임라인)
   - .sc2-scroll-step 진입 시 카드 내용·마커·경로선 갱신
======================================================= */
export async function initSection2() {
  const mapContainer = document.getElementById("map-s2");
  if (!mapContainer) return;

  const defaultCenter = [37.5759, 126.985];

  // 초기 줌 10: 일반지도 기준, zoomSnap 0.5: 경성대지도 0.5단계 보정용
  const mapS2 = L.map("map-s2", {
    zoomControl: false,
    scrollWheelZoom: false,
    closePopupOnClick: false,
    zoomSnap: 0.5,
    crs: getCrsEx(),
  }).setView(defaultCenter, 10);

  const baseMapS2 = new L.TileLayer.DAWULGIS_EX(
    MAP_ENDPOINTS.seoulBaseMap_kor,
    { minZoom: 1, maxZoom: 15 },
  );

  const gyeongseongMapS2 = L.tileLayer.wms(HISTORICAL_MAPS.wmsUrl, {
    layers: HISTORICAL_MAPS.gyeongseong,
    format: "image/png",
    transparent: true,
    maxZoom: 18,
    attribution: "경성대지도",
  });

  baseMapS2.addTo(mapS2);
  addMapToggleControl(mapS2, baseMapS2, gyeongseongMapS2, "경성대지도");

  // 경성대지도(WMS) 줌 보정값: 일반지도 대비 축소 단계 수 (값이 클수록 더 멀리 표시)
  const GYEONGSEONG_ZOOM_OFFSET = 0.5;

  // 지도 전환 시 줌 보정: 경성대지도 전환 시 축소, 일반지도 복귀 시 원래 줌으로 복원
  mapS2.on("layeradd", (e) => {
    if (e.layer === gyeongseongMapS2) {
      mapS2.setZoom(mapS2.getZoom() - GYEONGSEONG_ZOOM_OFFSET, {
        animate: false,
      });
    }
    if (e.layer === baseMapS2) {
      mapS2.setZoom(mapS2.getZoom() + GYEONGSEONG_ZOOM_OFFSET, {
        animate: false,
      });
    }
  });

  // 현재 레이어 기준 기본 줌 / 확대 줌 반환 (일반지도 10 / 12 고정)
  const getDefaultZoom = () =>
    mapS2.hasLayer(gyeongseongMapS2) ? 10 - GYEONGSEONG_ZOOM_OFFSET : 10;
  const getTargetZoom = () =>
    mapS2.hasLayer(gyeongseongMapS2) ? 12 - GYEONGSEONG_ZOOM_OFFSET : 12;

  const resizeObserverS2 = new ResizeObserver(() => mapS2.invalidateSize());
  resizeObserverS2.observe(mapContainer);

  const pathLine = L.polyline([], {
    color: "#000000",
    weight: 3,
    dashArray: "8, 8",
    opacity: 1,
    lineJoin: "round",
  }).addTo(mapS2);

  let isMarkerClicked = false;

  try {
    const geojsonData = await fetchTimeTravelData();

    // 타임라인 표시 순서 (테마 콘텐츠 ID, mobile-sections/section2.js와 동일)
    const targetIds = [
      "start_01",
      "start_02",
      "start_03",
      "start_04",
      "start_08",
      "start_05",
      "start_09",
      "start_07",
      "start_13",
    ];

    const timelineData = [];
    const locationsS2 = [];

    targetIds.forEach((targetId) => {
      const feature = geojsonData.features.find(
        (f) => f.properties.COT_CONTS_ID === targetId,
      );

      if (feature) {
        const props = feature.properties;
        const imgCandidates = getImageCandidates(props);

        const title = props.COT_CONTS_NAME || "지명 없음";

        let rawVal01 = (props.COT_VALUE_01 || "").trim().replace(/^"|"$/g, "");
        let rawVal03 = (props.COT_VALUE_03 || "").trim().replace(/^"|"$/g, "");

        let val01 = rawVal01
          ? rawVal01.replace(/\n/g, "<br>").replace(/ - /g, "<br>- ")
          : "";
        let val03 = rawVal03
          ? rawVal03.replace(/\n/g, "<br>").replace(/ - /g, "<br>- ")
          : "";

        let combinedDesc = "";
        if (val01) combinedDesc += val01;
        if (val01 && val03) combinedDesc += "<br><br>";
        if (val03) combinedDesc += val03;
        if (!combinedDesc) combinedDesc = "상세 설명이 없습니다.";

        timelineData.push({
          id: targetId,
          title: title,
          desc: combinedDesc,
          imgCandidates: imgCandidates,
          addrNew: props.COT_ADDR_FULL_NEW || "현재 주소 정보 없음",
          addrOld: props.COT_ADDR_FULL_OLD || "옛 주소 정보 없음",
          poiId: props.COT_CONTS_ID,
        });

        if (feature.geometry.type === "Point" && feature.geometry.coordinates) {
          locationsS2.push({
            id: targetId,
            pos: [
              feature.geometry.coordinates[1],
              feature.geometry.coordinates[0],
            ],
            label: title,
          });
        }
      }
    });

    const scrollTrack = document.getElementById("sc2-scroll-track");
    const cardContent = document.getElementById("sc2-card-content");
    const sideNav = document.getElementById("sc2-side-nav");

    scrollTrack.innerHTML = "";
    sideNav.innerHTML = "";

    timelineData.forEach((item, index) => {
      const stepNum = index + 1;
      scrollTrack.insertAdjacentHTML(
        "beforeend",
        `<div class="sc2-scroll-step" data-marker="${item.id}" id="step-${item.id}"></div>`,
      );
      sideNav.insertAdjacentHTML(
        "beforeend",
        `<button class="sc2-nav-btn" data-marker="${item.id}" aria-label="${stepNum}번째 장소">${stepNum}</button>`,
      );
    });

    const navBtns = document.querySelectorAll(".sc2-nav-btn");
    let currentCardId = null;

    navBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-marker");
        const targetStep = document.getElementById(`step-${targetId}`);
        if (targetStep)
          targetStep.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    function updateCardContent(activeId) {
      if (currentCardId === activeId) return;
      currentCardId = activeId;

      const item = timelineData.find((d) => d.id === activeId);
      if (!item) return;

      navBtns.forEach((btn) => {
        if (btn.getAttribute("data-marker") === activeId) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });

      cardContent.classList.add("fade-out");
      setTimeout(() => {
        // 이미지: 첫 번째 후보 URL로 생성, 실패 시 아래 error 핸들러에서 다음 후보로 교체
        const firstImg = item.imgCandidates[0];
        const imageHTML = firstImg
          ? `<img src="${firstImg}" alt="${item.title}" class="sc2-item-img">`
          : "";
        const mapLink = `https://map.seoul.go.kr/smgis2/poiViewMap?ti=11100550&pi=${item.poiId}&lang=ko`;
        const sajeokLink = `http://sajeok.i815.or.kr/i815/search_list?keyword=${encodeURIComponent(item.title)}`;

        cardContent.innerHTML = `
          <h4 class="sc2-pop-title sc2-card-title">${item.title}</h4>
          ${imageHTML}
          <div class="sc2-pop-info sc2-card-info">
            <p><strong>현재:</strong> ${item.addrNew}</p>
            <p><strong>옛지명:</strong> ${item.addrOld}</p>
          </div>
          <div class="sc2-pop-desc sc2-card-desc">${item.desc}</div>
          <div class="sc2-pop-btns sc2-card-btns">
            <a href="${mapLink}" target="_blank" class="sc2-btn map-btn">스마트서울맵</a>
            <a href="${sajeokLink}" target="_blank" class="sc2-btn history-btn">독립운동 사적지</a>
          </div>
        `;
        cardContent.classList.remove("fade-out");

        const currentImg = cardContent.querySelector(".sc2-item-img");
        if (currentImg) {
          let candidateIndex = 0;

          // 로드 실패(404 등) 시 다음 후보 URL로 교체, 전체 실패 시 숨김 처리
          currentImg.addEventListener("error", () => {
            candidateIndex++;
            if (candidateIndex < item.imgCandidates.length) {
              currentImg.src = item.imgCandidates[candidateIndex];
              return;
            }
            console.warn(
              `[Section2] 이미지 전체 후보 로드 실패: ${item.id}`,
              item.imgCandidates,
            );
            currentImg.style.display = "none";
          });

          currentImg.addEventListener("click", () => {
            if (window.openGlobalModal) {
              window.openGlobalModal(currentImg.src, item.title);
            }
          });
        } else {
          console.warn(`[Section2] 이미지 URL 없음: ${item.id}`);
        }
      }, 300);
    }

    const markers = {};
    locationsS2.forEach((loc) => {
      const stepNumber = targetIds.indexOf(loc.id) + 1;
      const icon = L.divIcon({
        className: "custom-div-icon",
        html: `<div class='sc2-marker-wrapper sc2-marker-dimmed' id='map-marker-container-${loc.id}'><div class='sc2-marker-circle'>${stepNumber}</div></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const marker = L.marker(loc.pos, { icon }).addTo(mapS2);

      const popupContent = `
        <div class="sc2-popup-inner sc2-popup-mini">
          <h4 class="sc2-pop-title">${loc.label}</h4>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: "sc2-leaflet-popup",
        offset: [0, -15],
        closeButton: false,
        autoClose: false,
        closeOnClick: false,
      });

      marker.on("click", () => {
        isMarkerClicked = true;

        const targetStep = document.getElementById(`step-${loc.id}`);
        if (targetStep)
          targetStep.scrollIntoView({ behavior: "smooth", block: "center" });

        setTimeout(() => {
          marker.openPopup();
        }, 10);

        let targetZoom;
        // 같은 마커 재클릭 시 기본 줌 복귀, 그 외 확대 줌 적용
        if (mapS2.getZoom() > getDefaultZoom() && currentCardId === loc.id) {
          targetZoom = getDefaultZoom();
        } else {
          targetZoom = getTargetZoom();
        }

        const targetPoint = mapS2.project(loc.pos, targetZoom);
        // PC: 좌측 고정 카드 영역에 마커가 가려지지 않도록 X축 오프셋 적용
        targetPoint.x -= window.innerWidth <= 768 ? 0 : 350;

        mapS2.setView(mapS2.unproject(targetPoint, targetZoom), targetZoom, {
          animate: true,
          duration: 0.8,
        });

        setTimeout(() => {
          isMarkerClicked = false;
        }, 900);
      });

      markers[loc.id] = { marker, popup: marker.getPopup() };
    });

    const initialCoords = targetIds
      .map((id) => locationsS2.find((l) => l.id === id)?.pos)
      .filter(Boolean);
    pathLine.setLatLngs(generateCurvedPath(initialCoords));

    // 스크롤 스텝 진입 감지 → 카드·마커 상태·경로선 갱신 (마커 클릭 이동 중에는 panTo 생략)
    const markerObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const activeId = String(entry.target.getAttribute("data-marker"));
            const activeIndex = targetIds.indexOf(activeId);

            updateCardContent(activeId);

            Object.keys(markers).forEach((key) => {
              if (key === activeId) {
                if (!markers[key].marker.isPopupOpen())
                  markers[key].marker.openPopup();
              } else {
                if (markers[key].marker.isPopupOpen())
                  markers[key].marker.closePopup();
              }
            });

            targetIds.forEach((id) => {
              const container = document.getElementById(
                `map-marker-container-${id}`,
              );
              if (container) {
                if (id === activeId) {
                  container.classList.remove("sc2-marker-dimmed");
                  container.classList.add("sc2-marker-active");
                } else {
                  container.classList.remove("sc2-marker-active");
                  container.classList.add("sc2-marker-dimmed");
                }
              }
            });

            const visibleCoords = targetIds
              .slice(0, activeIndex + 1)
              .map((id) => locationsS2.find((l) => String(l.id) === id)?.pos)
              .filter(Boolean);
            pathLine.setLatLngs(generateCurvedPath(visibleCoords));

            const activeLoc = locationsS2.find(
              (l) => String(l.id) === activeId,
            );

            if (activeLoc && !isMarkerClicked) {
              mapS2.invalidateSize();
              const currentZoom = mapS2.getZoom();
              const targetPoint = mapS2.project(activeLoc.pos, currentZoom);

              targetPoint.x -= window.innerWidth <= 768 ? 0 : 350;

              mapS2.panTo(mapS2.unproject(targetPoint, currentZoom), {
                animate: true,
                duration: 0.8,
              });
            }
          }
        });
      },
      { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" },
    );

    document
      .querySelectorAll(".sc2-scroll-step")
      .forEach((item) => markerObserver.observe(item));

    if (targetIds.length > 0) {
      const firstId = targetIds[0];
      updateCardContent(firstId);

      const firstLoc = locationsS2.find((l) => l.id === firstId);
      if (firstLoc) {
        const currentZoom = mapS2.getZoom();
        const targetPoint = mapS2.project(firstLoc.pos, currentZoom);

        targetPoint.x -= window.innerWidth <= 768 ? 0 : 350;
        mapS2.setView(mapS2.unproject(targetPoint, currentZoom), currentZoom, {
          animate: false,
        });
      }

      setTimeout(() => {
        if (markers[firstId]) {
          markers[firstId].marker.openPopup();
          const firstContainer = document.getElementById(
            `map-marker-container-${firstId}`,
          );
          if (firstContainer) {
            firstContainer.classList.remove("sc2-marker-dimmed");
            firstContainer.classList.add("sc2-marker-active");
          }
        }
      }, 300);
    }
  } catch (error) {
    console.error("Section 2 에러:", error);
  }
}
