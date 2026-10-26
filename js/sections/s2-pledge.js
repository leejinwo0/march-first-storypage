/* =======================================================
   02 거사의 맹세: 스테퍼 · 진행 막대 · 상세 카드 + 지도
   - 데이터: 스마트서울맵 테마 11100550 (start_xx 거점 9곳)
   - 단계 버튼·마커 클릭 → 카드 갱신, 해당 마커 중심 이동(기본 줌 유지), 경로선 해당 단계까지 표시
   - 경성대지도 전환 시 줌 1.5단계 보정
   - PC: 활성 마커 팝업(장소명) 고정 표시 (마커 재클릭·지도 클릭 시에도 유지), 우측 상단 X 클릭 시 닫힘
   - 이전/다음 스테퍼(단계 번호·장소명) + 단계 버튼 9칸 진행 막대 표시 (PC·모바일 공통)
   - 모바일(1024px 이하): 지도 팝업 미표시, 상세 카드 숨김 → 마커 클릭 또는 스테퍼 '더보기' 클릭 시 하단 시트로 상세 카드 표시
======================================================= */
import { fetchTimeTravelData } from "/services/mapService.js";
import { createStoryMap, generateCurvedPath } from "/js/utils/mapUtils.js";
import {
    getImageCandidates,
    attachImageFallback,
    setStat,
    openSheet,
    closeSheet,
} from "/js/utils/uiUtils.js";

// 타임라인 표시 순서 (테마 콘텐츠 ID)
const TARGET_IDS = [
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

// 기본 줌 및 장소 이동 줌 (동일 값, 장소 이동 시 줌 변경 없이 중심만 이동)
const DEFAULT_ZOOM = 10;
// 모바일 기준: 상세 카드 → 하단 시트 표시
const MOBILE_QUERY = window.matchMedia("(max-width: 1024px)");

// COT_VALUE 텍스트 정리: 앞뒤 따옴표 제거, " - " 항목 구분 → 줄 단위 배열
const toLines = (value) =>
    String(value || "")
        .trim()
        .replace(/^"|"$/g, "")
        .replace(/ - /g, "\n- ")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

// 사적지 검색어 직접 지정 (장소 ID → 검색어), 자동 추출로 검색 결과가 없는 장소만 등록
const SAJEOK_KEYWORDS = {
    // start_02: "3·1운동 단일화 합의 장소",
};

// 사적지 검색어: 제목이 "사적지 명칭 - 부가 설명" 형태이면 " - " 앞부분만 사용
const toSajeokKeyword = (step) =>
    SAJEOK_KEYWORDS[step.id] || step.title.split(" - ")[0].trim();

export async function initPledge() {
    const nav = document.getElementById("s2-nav");
    const card = document.getElementById("s2-card");
    if (!nav || !card || !document.getElementById("map-s2")) return;

    const { map, zoomFor } = createStoryMap("map-s2", {
        center: [37.5759, 126.985],
        zoom: DEFAULT_ZOOM,
        zoomOffset: 1.5,
        mapOptions: {
            closePopupOnClick: false,
            // 더블클릭 확대 비활성: 기본 줌 외 레벨 진입 시 기본지도 타일 미표시(검은 화면) 방지
            doubleClickZoom: false,
        },
    });

    // 거점 연결 점선 (선택 단계까지 곡선으로 표시)
    const pathLine = L.polyline([], {
        color: "#a83228",
        weight: 3,
        dashArray: "8, 8",
        lineJoin: "round",
    }).addTo(map);

    const geojson = await fetchTimeTravelData();

    // 거점 데이터: TARGET_IDS 순서대로 추출 (좌표 [위도, 경도] 변환)
    const steps = TARGET_IDS.map((id) => {
        const feature = geojson.features.find(
            (f) => f.properties.COT_CONTS_ID === id,
        );
        if (!feature) return null;
        const props = feature.properties;
        const coords =
            feature.geometry.type === "Point"
                ? feature.geometry.coordinates
                : null;
        return {
            id,
            title: props.COT_CONTS_NAME || "지명 없음",
            infoLines: toLines(props.COT_VALUE_01),
            bodyLines: toLines(props.COT_VALUE_03),
            addrNew: props.COT_ADDR_FULL_NEW || "현재 주소 정보 없음",
            addrOld: props.COT_ADDR_FULL_OLD || "옛 주소 정보 없음",
            images: getImageCandidates(props),
            pos: coords ? [coords[1], coords[0]] : null,
        };
    }).filter(Boolean);

    // 수치 띠 '3.1운동 준비' 갱신
    setStat("pledge", steps.length);

    if (steps.length === 0) {
        card.innerHTML =
            '<p class="status-text">거점 정보를 불러올 수 없습니다.</p>';
        return;
    }

    // 1. 단계 버튼 (CSS로 9칸 진행 막대 표시)
    nav.innerHTML = steps
        .map(
            (step, i) =>
                `<button type="button" class="step-btn" data-index="${i}" aria-label="${i + 1}번째 장소: ${step.title}">${i + 1}</button>`,
        )
        .join("");
    const navBtns = [...nav.querySelectorAll(".step-btn")];

    // 2. 지도 마커 (번호 원형)
    const markers = steps.map((step, i) => {
        if (!step.pos) return null;
        const icon = L.divIcon({
            className: "step-marker-wrap",
            html: `<span class="step-marker" data-index="${i}">${i + 1}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });
        const marker = L.marker(step.pos, { icon }).addTo(map);
        const popupEl = document.createElement("p");
        popupEl.className = "popup-mini-title";
        popupEl.textContent = step.title;
        marker.bindPopup(popupEl, {
            className: "story-popup story-popup-mini",
            offset: [0, -14],
            // X 버튼: 팝업만 닫기 (선택 단계·카드 유지, 마커 재클릭 시 다시 표시)
            closeButton: true,
            autoClose: false,
            closeOnClick: false,
            // 활성 마커가 지도 중앙 → 자동 이동 불필요, 이동 애니메이션 중 autoPan 충돌 방지
            autoPan: false,
        });
        // 마커 클릭: Leaflet 기본 팝업 토글 해제 → activate에서 PC만 팝업 표시
        marker.off("click", marker._openPopup, marker);
        marker.on("click", () => {
            activate(i);
            // 모바일: 마커 클릭 시 상세 카드 하단 시트 표시
            if (MOBILE_QUERY.matches) openSheet(card);
        });
        return marker;
    });

    // 웹폰트(나눔고딕) 로드 완료 후 열린 팝업 위치 재계산 (대체 글꼴 기준 폭으로 배치된 팝업 보정)
    document.fonts?.ready.then(() =>
        markers.forEach((m) => m?.isPopupOpen() && m.getPopup().update()),
    );

    let currentIndex = -1;

    // 스테퍼 요소 (단계 번호 · 장소명 · 이전/다음)
    const stepNum = document.getElementById("s2-step-num");
    const stepTotal = document.getElementById("s2-step-total");
    const stepName = document.getElementById("s2-step-name");
    const prevBtn = document.getElementById("s2-prev");
    const nextBtn = document.getElementById("s2-next");
    if (stepTotal)
        stepTotal.textContent = String(steps.length).padStart(2, "0");

    const updateStepper = (index) => {
        if (stepNum) stepNum.textContent = String(index + 1).padStart(2, "0");
        if (stepName) stepName.textContent = steps[index].title;
        if (prevBtn) prevBtn.disabled = index === 0;
        if (nextBtn) nextBtn.disabled = index === steps.length - 1;
    };

    // 3. 상세 카드 렌더링
    function renderCard(step, index) {
        const mapLink = `https://map.seoul.go.kr/smgis2/poiViewMap?ti=11100550&pi=${step.id}&lang=ko`;
        // 국내 독립운동·국가수호 사적지 통합검색 결과 페이지 (경로형 검색 주소: /search/index/q/검색어)
        const sajeokLink = `http://sajeok.i815.or.kr/search/index/q/${encodeURIComponent(toSajeokKeyword(step))}`;
        const info = step.infoLines.length
            ? `<ul class="pledge-info">${step.infoLines.map((l) => `<li>${l.replace(/^-\s*/, "")}</li>`).join("")}</ul>`
            : "";
        const body = step.bodyLines.length
            ? `<p class="pledge-body">${step.bodyLines.join("<br>")}</p>`
            : "";

        card.innerHTML = `
      <p class="pledge-step">STEP ${String(index + 1).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")}</p>
      <h3 class="pledge-title">${step.title}</h3>
      ${step.images.length ? `<button type="button" class="pledge-photo"><img src="${step.images[0]}" alt="${step.title}"></button>` : ""}
      <dl class="addr-box">
        <div><dt>현재</dt><dd>${step.addrNew}</dd></div>
        <div><dt>옛지명</dt><dd>${step.addrOld}</dd></div>
      </dl>
      ${info}
      ${body}
      ${!info && !body ? '<p class="pledge-body">상세 설명이 없습니다.</p>' : ""}
      <div class="btn-pair">
        <a class="line-btn line-btn-red" href="${mapLink}" target="_blank" rel="noopener noreferrer">스마트서울맵</a>
        <a class="line-btn line-btn-gold" href="${sajeokLink}" target="_blank" rel="noopener noreferrer">독립운동 사적지</a>
      </div>
    `;
        card.scrollTop = 0;

        // 이미지: 후보 URL 순차 시도, 전체 실패 시 사진 영역 제거 / 클릭 시 확대 모달
        const photo = card.querySelector(".pledge-photo");
        if (photo) {
            const img = photo.querySelector("img");
            attachImageFallback(img, step.images, () => photo.remove());
            photo.addEventListener("click", () =>
                window.openGlobalModal?.(img.src, step.title),
            );
        }
    }

    // 팝업 동기화: PC는 활성 마커 팝업 표시, 모바일은 팝업 미표시 (장소명·더보기는 상단 스테퍼에 표시)
    function syncPopups(index) {
        markers.forEach((m, i) => {
            if (!m) return;
            if (i === index && !MOBILE_QUERY.matches) m.openPopup();
            else m.closePopup();
        });
    }

    // 4. 단계 활성화: 카드·버튼·마커·경로선·지도 위치 갱신
    function activate(index) {
        const step = steps[index];

        if (index !== currentIndex) {
            currentIndex = index;
            renderCard(step, index);
            navBtns.forEach((btn, i) =>
                btn.classList.toggle("active", i === index),
            );
            updateStepper(index);
            document.querySelectorAll("#map-s2 .step-marker").forEach((el) => {
                el.classList.toggle(
                    "is-active",
                    Number(el.dataset.index) === index,
                );
            });
            const visible = steps
                .slice(0, index + 1)
                .map((s) => s.pos)
                .filter(Boolean);
            pathLine.setLatLngs(generateCurvedPath(visible));
        }

        syncPopups(index);

        if (!step.pos) return;
        // 선택 장소 중심 이동 (기본 줌 유지, 경성대지도 표시 중이면 보정 줌)
        map.setView(step.pos, zoomFor(DEFAULT_ZOOM), {
            animate: true,
            duration: 0.8,
        });
    }

    // 5. 조작: 진행 막대 칸 · 이전/다음 · 방향키
    navBtns.forEach((btn) =>
        btn.addEventListener("click", () =>
            activate(Number(btn.dataset.index)),
        ),
    );

    // 스테퍼: 이전/다음 장소 이동
    prevBtn?.addEventListener("click", () => {
        if (currentIndex > 0) activate(currentIndex - 1);
    });
    nextBtn?.addEventListener("click", () => {
        if (currentIndex < steps.length - 1) activate(currentIndex + 1);
    });

    // 키보드: 방향키로 단계 이동 (진행 막대 포커스 상태)
    nav.addEventListener("keydown", (e) => {
        if (
            !["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)
        )
            return;
        e.preventDefault();
        const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
        const next = Math.min(
            steps.length - 1,
            Math.max(0, currentIndex + dir),
        );
        activate(next);
        navBtns[next].focus();
    });

    // 모바일 스테퍼 '더보기': 상세 카드 하단 시트 표시
    document
        .getElementById("s2-more")
        ?.addEventListener("click", () => openSheet(card));

    // PC·모바일 화면 전환: PC 전환 시 시트 닫기(상세 카드 원위치 복원), 팝업 표시 여부 재적용
    MOBILE_QUERY.addEventListener("change", (e) => {
        if (!e.matches) closeSheet();
        if (currentIndex >= 0) syncPopups(currentIndex);
    });

    activate(0);
}
