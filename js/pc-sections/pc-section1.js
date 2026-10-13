import { MAP_ENDPOINTS, HISTORICAL_MAPS } from "/api/mapService.js";
import { addMapToggleControl } from "/js/utils/mapUtils.js";

/* =======================================================
   Section 1: 시대의 부름 (지도 4개 + 자동 슬라이더)
   - region 'seoul': 스마트서울맵(EPSG:5179) + 경성대지도 WMS
   - region 'global': OpenStreetMap(EPSG:3857) + ArcGIS 위성
======================================================= */
export function initSection1() {
  const mapConfigsS1 = [
    {
      id: "map-s1-1",
      center: [37.5562, 126.985],
      zoom: 9,
      title: "남산 통감관저 터",
      region: "seoul",
      address: "서울특별시 중구 예장동 2-1",
      desc: "1910년 <한일강제병합조약>을 조인했던 뼈아픈 역사의 현장입니다.",
      imgUrl:
        "/assets/images/history/march-first-movement/201-namsan-residence-past.jpg",
      caption: "남산 총독관저(옛 통감관저)",
    },
    {
      id: "map-s1-2",
      center: [37.5650416322942, 126.976542945622],
      zoom: 9,
      title: "덕수궁 대한문",
      region: "seoul",
      address: "서울특별시 중구 세종대로 99",
      desc: "고종 황제의 장례일에 대한문 앞에 모인 사람들의 모습이다. 대한문은 고종 황제가 기거하던 덕수궁의 정문이다.",
      imgUrl:
        "/assets/images/history/march-first-movement/202-daehanmun-funeral.jpg",
      caption: "고종황제 장례식에 대한문 앞에 모인 사람들",
    },
    {
      id: "map-s1-3",
      center: [35.6989, 139.7544],
      zoom: 15,
      title: "도쿄 YMCA",
      region: "global",
      address: "일본 도쿄도 지요다구 간다사루가쿠초 2-5-5",
      desc: "1919년 2월 8일 일본 도쿄의 기독교청년회관에서 조선인 유학생들이 발표한 독립선언서이다.<br>한일 병합조약 폐지와 조선의 독립 선언, 민족대회 소집과 만국평화회의에 민족대표 파견을 요구했다.",
      imgUrl:
        "/assets/images/history/march-first-movement/203-declaration-feb-8.jpg",
      caption: "2.8독립선언서",
    },
    {
      id: "map-s1-4",
      center: [48.8566, 2.3522],
      zoom: 8,
      title: "파리 강화 회의장",
      region: "global",
      address: "프랑스 일드프랑스 파리 7구 케도르세 37",
      desc: "파리강화회의 한국대표 특사 김규식이 미국대통령 윌슨에게 보낸 편지이다.<br>일제의 주권 찬탈을 폭로하고, 한국 독립의 정당성과 당위성을 주장했다.",
      imgUrl:
        "/assets/images/history/march-first-movement/204-kim-kyusik-letter.jpg",
      caption: "김규식이 윌슨에게 보낸 편지",
    },
  ];

  const mapInstances = [];

  // 1. 지도 4개 생성 (getCrsEx: 스마트서울맵 API 전역 함수, EPSG:5179 좌표계)
  mapConfigsS1.forEach((config) => {
    const mapElement = document.getElementById(config.id);
    if (!mapElement) return;

    const map = L.map(config.id, {
      center: config.center,
      zoom: config.zoom,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: config.region !== "seoul",
      crs: config.region === "seoul" ? getCrsEx() : L.CRS.EPSG3857,
    });
    let baseMapLayer, secondaryMapLayer;

    if (config.region === "seoul") {
      baseMapLayer = new L.TileLayer.DAWULGIS_EX(
        MAP_ENDPOINTS.seoulBaseMap_kor,
        { minZoom: 1, maxZoom: 15 },
      );

      // 서울: 보조 레이어로 경성대지도 WMS 사용
      secondaryMapLayer = L.tileLayer.wms(HISTORICAL_MAPS.wmsUrl, {
        layers: HISTORICAL_MAPS.gyeongseong,
        format: "image/png",
        transparent: true,
        maxZoom: 12,
        attribution: "경성대지도",
      });
    } else {
      baseMapLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
        },
      );
      secondaryMapLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 },
      );
    }

    baseMapLayer.addTo(map);
    const toggleLabel = config.region === "seoul" ? "경성대지도" : "위성지도";
    addMapToggleControl(map, baseMapLayer, secondaryMapLayer, toggleLabel);

    const icon = L.divIcon({
      className: "custom-marker-wrapper",
      html: '<div class="map-pulse"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    // 팝업: 제목 + 주소 + 사진(호버 오버레이), 상시 노출(autoClose: false)
    const popupContent = `
    <div class="sc1-popup-inner">
      <h3>${config.title}</h3>
      <span class="sc1-pop-addr">${config.address}</span><br>
      <div class="sc1-pop-img-wrapper">
        <img src="${config.imgUrl}" alt="${config.title}" class="sc1-pop-img">
        <div class="sc1-img-overlay"><span>클릭하여 상세 정보 보기</span></div>
      </div>
    </div>
    `;

    const marker = L.marker(config.center, { icon: icon })
      .addTo(map)
      .bindPopup(popupContent, {
        offset: [0, -10],
        className: "sc1-leaflet-popup",
        closeButton: false,
        autoClose: false,
        closeOnClick: false,
        autoPan: false,
      });

    // 팝업 사진 클릭 시 전역 모달 호출 (캡션: 제목 + 설명)
    map.on("popupopen", function (e) {
      const popupNode = e.popup._contentNode;
      const popupImg = popupNode.querySelector(".sc1-pop-img");

      if (popupImg && config.imgUrl) {
        popupImg.style.cursor = "pointer";
        popupImg.addEventListener("click", function () {
          const richCaption = `
            <div class="sc1-modal-caption">
              <strong class="sc1-modal-title">${config.caption ? config.caption : config.title}</strong>
              <p class="sc1-modal-desc">${config.desc}</p>
            </div>
          `;

          if (window.openGlobalModal) {
            window.openGlobalModal(config.imgUrl, richCaption);
          }
        });
      }
    });

    marker.openPopup();
    mapInstances.push(map);

    const targetZoom = config.zoom;
    const targetPoint = map.project(config.center, targetZoom);
    targetPoint.y -= 70;
    map.setView(map.unproject(targetPoint, targetZoom), targetZoom, {
      animate: false,
    });
  });

  // 2. 슬라이드 및 타이머 제어
  const slides = document.querySelectorAll(".sc1-slide");
  const dots = document.querySelectorAll(".sc1-dot");
  const playPauseBtn = document.getElementById("sc1-play-pause");
  const playPauseIcon = playPauseBtn.querySelector(
    ".material-symbols-outlined",
  );

  let currentIdx = 0;
  let slideInterval;
  let isPlaying = true;

  function goToSlide(index) {
    slides[currentIdx].classList.remove("active");
    dots[currentIdx].classList.remove("active");
    currentIdx = index;
    slides[currentIdx].classList.add("active");
    dots[currentIdx].classList.add("active");

    setTimeout(() => {
      if (mapInstances[currentIdx]) {
        mapInstances[currentIdx].invalidateSize();
      }
    }, 1000);
  }

  function startAutoSlide() {
    slideInterval = setInterval(() => {
      let nextIdx = (currentIdx + 1) % slides.length;
      goToSlide(nextIdx);
    }, 5000);
    isPlaying = true;
    playPauseIcon.textContent = "||";
  }

  function stopAutoSlide() {
    clearInterval(slideInterval);
    isPlaying = false;
    playPauseIcon.textContent = "▶";
  }

  playPauseBtn.addEventListener("click", () => {
    if (isPlaying) stopAutoSlide();
    else startAutoSlide();
  });

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      goToSlide(index);
      if (isPlaying) {
        clearInterval(slideInterval);
        startAutoSlide();
      }
    });
  });

  startAutoSlide();
}
