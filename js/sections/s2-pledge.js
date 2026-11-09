/* 02 거사의 맹세: 스테퍼 · 진행 막대 · 상세 카드 + 지도 */
// 데이터: 스마트서울맵 테마 11100550 거점 (COT_CONTS_ID start_01부터 번호순 전체, 거점 추가 시 자동 반영)
// 상세 카드: 사진 슬라이드(1장씩 표시, 이전/다음 버튼 · 가로 넘김, 사진 설명 표시, 로드 실패 사진 제외) → 주소(현재주소 · 옛주소) → 역사적 의의 / 현재 상태 → '자세히 보기'(클릭 시 버튼 위로 나머지 상세 항목 펼침, 버튼은 링크 버튼 바로 위 유지) → 스마트서울맵 · 독립운동 사적지 링크
// 사진 클릭: 확대 모달에서 사진 넘김(좌우 버튼 · 방향키 · 밀어서 넘기기), 사진 아래 사진 설명 · 장소명 · 순서 표시
// 상세 API: 목록 API 미제공 항목(역사적 의의 · 참고 문헌 · 위치 고증 · 자료 출처 · 사진 등) 보완, 초기화 시 거점 전체 동시 호출 후 목록 속성과 병합 (실패 거점은 목록 속성만 사용)
// 단계 버튼·마커 클릭 → 카드 갱신, 해당 마커 중심 이동(현재 줌 유지), 연결선은 선택 단계 순번까지 표시
// 연결선: 준비 과정 1→6 곡선 점선 / 거사 당일 7→8 · 7→9 곡선 실선 (이종일 집 선언서 교부 → 태화관 · 탑골공원 분기), 구간 가운데 진행 방향 화살표
// 연결선 겹침 완화: 구간별 휘는 방향 · 정도 지정(선 교차 · 다른 마커 통과 회피), 선택 단계로 들어오는 구간만 진하게 · 지난 구간 흐리게
// 옛지도(근세 지형도) 전환 시 줌 보정: 옛지도 9.5 고정 (PC · 모바일 현재지도 9 → 0.5단계 확대)
// PC: 활성 마커 팝업(장소명) 고정 표시 (마커 재클릭·지도 클릭 시에도 유지), 우측 상단 X 클릭 시 닫힘
// 이전/다음 스테퍼(단계 번호·장소명) + 거점 수만큼 단계 버튼 진행 막대 표시 (PC·모바일 공통)
// 모바일(1024px 이하): 지도 팝업 미표시, 상세 카드 숨김 → 마커 클릭 또는 스테퍼 '더보기' 클릭 시 하단 시트로 상세 카드 표시
import { fetchTimeTravelData, MAP_ENDPOINTS } from "/services/mapService.js";
import { createStoryMap } from "/js/utils/mapUtils.js";
import { toSafeImageUrl, setStat, openSheet, closeSheet } from "/js/utils/uiUtils.js";

// 거점 콘텐츠 ID 형식: start_번호 (번호순 표시)
const STEP_ID = /^start_(\d+)$/;
// 상세 항목 번호 범위 (COT_NAME_xx · COT_VALUE_xx), 16~20번은 사진 설명
const DETAIL_FIELD_MAX = 15;
// 주소 상자로 표시하는 항목 (08 당시주소, 카드에는 '옛주소'로 표시)
const ADDR_FIELD = "08";
// 카드 기본 표시 항목 (05 역사적 의의 / 현재 상태), 나머지 항목은 '자세히 보기' 클릭 시 표시
const MAIN_FIELDS = ["05"];
// 확대 모달 밀어서 넘기기 최소 이동 거리 (px)
const SWIPE_MIN = 40;
// 사진 · 사진 설명 짝 (표시 순서): 대표 사진 COT_IMG_MAIN_URL(설명 COT_VALUE_16) → COT_IMG_MAIN_URL1~4(설명 COT_VALUE_17~20)
const PHOTO_FIELDS = [
    ["COT_IMG_MAIN_URL", "COT_VALUE_16"],
    ["COT_IMG_MAIN_URL1", "COT_VALUE_17"],
    ["COT_IMG_MAIN_URL2", "COT_VALUE_18"],
    ["COT_IMG_MAIN_URL3", "COT_VALUE_19"],
    ["COT_IMG_MAIN_URL4", "COT_VALUE_20"],
];

// 연결선 묶음: 화면 표시 순번(마커 번호 = start_번호 정렬 순서, 중간 번호 누락 시 start_번호와 다를 수 있음) 기준 연결, dashed true 점선 / false 실선
// bends: 구간별 휘는 정도 (진행 방향 기준 + 오른쪽 / − 왼쪽, 절댓값 클수록 크게 휨, 0 직선), 현재 거점 배치 기준 선 교차 · 다른 마커 통과 최소값
const PATH_GROUPS = [
    { nos: [1, 2, 3, 4, 5, 6], dashed: true, bends: [-0.3, 0.3, 0.2, -0.5, -0.3] },
    { nos: [7, 8], dashed: false, bends: [-0.4] },
    { nos: [7, 9], dashed: false, bends: [0.3] },
];
// 곡선 구간당 분할 수
const CURVE_POINTS = 20;
// 지난 구간 투명도 (선택 단계로 들어오는 구간은 1)
const PAST_PATH_OPACITY = 0.35;

// 기본 줌: PC 9 / 모바일 9, 장소 이동 시 줌 변경 없이 중심만 이동
const DEFAULT_ZOOM = 9;
const DEFAULT_ZOOM_MOBILE = 9;
// 옛지도(근세 지형도) 줌: PC·모바일 공통 (현재지도와의 차이를 zoomOffset으로 적용)
const HISTORICAL_ZOOM = 9.5;

// 모바일 기준: 상세 카드 → 하단 시트 표시
const MOBILE_QUERY = window.matchMedia("(max-width: 1024px)");

// API 텍스트 값 정리: 빈 값 · "null" 제외, 앞뒤 공백 · 따옴표 제거
const clean = (value) => {
    const text = String(value || "")
        .trim()
        .replace(/^"|"$/g, "");

    return text === "null" ? "" : text;
};

// 줄 단위 배열: 줄바꿈(\n) 기준 분리, 빈 줄 제외
const toLines = (value) =>
    clean(value)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

// 목록 항목 HTML: 앞 "- " 제거, "항목명: 내용" 형태면 항목명 강조 (내용 "-"도 그대로 표시)
const listHtml = (lines) =>
    lines
        .map((line) => line.replace(/^-\s*/, ""))
        .map((line) => {
            const match = line.match(/^([^:]{1,15}):\s*(.*)$/);

            return match ? `<li><b class="pledge-key">${match[1]}</b>${match[2] || "-"}</li>` : `<li>${line}</li>`;
        })
        .join("");

// 상세 항목 본문: 모든 줄이 "- "로 시작하면 목록, 그 외 문단(줄바꿈 유지)
const fieldBodyHtml = (lines) => (lines.every((line) => line.startsWith("-")) ? `<ul class="pledge-info">${listHtml(lines)}</ul>` : `<p class="pledge-body">${lines.join("<br>")}</p>`);

// 사적지 링크: API COT_EXTRA_DATA_02 주소(http/https), 없으면 장소명 검색 결과 페이지 (제목 " - " 앞부분)
const toSajeokLink = (step) => step.sajeokUrl || `http://sajeok.i815.or.kr/search/index/q/${encodeURIComponent(step.title.split(" - ")[0].trim())}`;

// 두 자리 번호 표기 (1 → "01")
const pad2 = (n) => String(n).padStart(2, "0");

// API 속성 → 카드 표시 데이터 (상세 항목 · 사진 · 주소 · 사적지 주소)
function parseProps(props) {
    // 상세 항목: COT_NAME_01~15 항목명 + COT_VALUE 내용 (항목명 · 내용 모두 있는 항목만, 주소 항목 제외)
    const fields = [];

    for (let i = 1; i <= DETAIL_FIELD_MAX; i++) {
        const no = pad2(i);
        const label = clean(props[`COT_NAME_${no}`]);
        const lines = toLines(props[`COT_VALUE_${no}`]);

        if (no !== ADDR_FIELD && label && lines.length) fields.push({ no, label, lines });
    }

    // 사진 후보: 주소 있는 사진만 (http 주소는 프록시 변환), 같은 주소 중복 제외
    const photos = [];

    PHOTO_FIELDS.forEach(([urlKey, captionKey]) => {
        const url = toSafeImageUrl(props[urlKey]);

        if (url && !photos.some((p) => p.url === url)) photos.push({ url, caption: clean(props[captionKey]) });
    });

    const sajeokUrl = clean(props.COT_EXTRA_DATA_02);

    return {
        title: clean(props.COT_CONTS_NAME) || "지명 없음",
        addrNew: clean(props.COT_ADDR_FULL_NEW),
        addrThen: clean(props[`COT_VALUE_${ADDR_FIELD}`]),
        fields,
        photos,
        sajeokUrl: /^https?:\/\//.test(sajeokUrl) ? sajeokUrl : "",
    };
}

// 상세 API 호출: 테마 목록 주소와 같은 기본 주소 사용, 실패 시 null (목록 속성만 사용)
async function fetchDetail(id) {
    try {
        const baseUrl = MAP_ENDPOINTS.themeData_11100550.split("/public/")[0];
        const res = await fetch(`${baseUrl}/public/themes/contents/detail?theme_id=11100550&conts_id=${id}`);
        const data = await res.json();

        return (data && Array.isArray(data.body) && data.body[0]) || null;
    } catch (error) {
        console.error(`상세 API 호출 실패 (${id}):`, error);
        return null;
    }
}

// 사진 확대 모달 넘김 상태: 장소명 · 표시 사진 목록 · 현재 순서 · 넘김 버튼 묶음 (첫 사용 시 생성)
const photoModal = { title: "", photos: [], index: 0, nav: null };

// 확대 모달 현재 사진 표시: 사진 아래 사진 설명(없으면 장소명) + 장소명, 넘김 버튼 · 순서 갱신 (1장이면 숨김)
function showModalPhoto() {
    const { title, photos, index, nav } = photoModal;
    const photo = photos[index];

    window.openGlobalModal(photo.url, photo.caption ? `${photo.caption}<br><small>${title}</small>` : title);
    document.getElementById("image-modal").classList.add("is-gallery");
    nav.hidden = photos.length < 2;
    nav.querySelector(".is-prev").disabled = index <= 0;
    nav.querySelector(".is-next").disabled = index >= photos.length - 1;
    nav.querySelector(".photo-modal-count").textContent = `${index + 1} / ${photos.length}`;
}

// 확대 모달 사진 넘김 (dir: -1 이전 / 1 다음, 처음 · 끝에서 멈춤)
function stepModalPhoto(dir) {
    const next = photoModal.index + dir;

    if (next < 0 || next >= photoModal.photos.length) return;

    photoModal.index = next;
    showModalPhoto();
}

// 확대 모달 넘김 버튼 · 방향키 · 밀어서 넘기기 등록 (1회), 모달 닫힘 시 넘김 표시 해제 (다른 섹션 모달 영향 방지)
function initPhotoModal() {
    const modal = document.getElementById("image-modal");

    if (photoModal.nav || !modal) return Boolean(photoModal.nav);

    const nav = document.createElement("div");

    nav.className = "photo-modal-nav";
    nav.innerHTML = `
      <button type="button" class="photo-modal-btn is-prev" aria-label="이전 사진">‹</button>
      <button type="button" class="photo-modal-btn is-next" aria-label="다음 사진">›</button>
      <span class="photo-modal-count"></span>`;
    modal.appendChild(nav);
    photoModal.nav = nav;

    nav.querySelector(".is-prev").addEventListener("click", () => stepModalPhoto(-1));
    nav.querySelector(".is-next").addEventListener("click", () => stepModalPhoto(1));

    const isGalleryOpen = () => modal.classList.contains("is-open") && modal.classList.contains("is-gallery");
    let touchX = null;

    document.addEventListener("keydown", (e) => {
        if (!isGalleryOpen() || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;

        stepModalPhoto(e.key === "ArrowRight" ? 1 : -1);
    });
    modal.addEventListener(
        "touchstart",
        (e) => {
            touchX = isGalleryOpen() ? e.touches[0].clientX : null;
        },
        { passive: true },
    );
    modal.addEventListener("touchend", (e) => {
        if (touchX === null) return;

        const dx = e.changedTouches[0].clientX - touchX;

        touchX = null;
        if (Math.abs(dx) >= SWIPE_MIN) stepModalPhoto(dx < 0 ? 1 : -1);
    });

    // is-gallery 없으면 종료: classList.remove는 클래스가 없어도 class 속성 변경 기록 발생 → 감시 콜백 무한 반복 방지
    new MutationObserver(() => {
        if (modal.classList.contains("is-open") || !modal.classList.contains("is-gallery")) return;

        modal.classList.remove("is-gallery");
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });

    return true;
}

// 사진 확대 모달 열기: 카드에 표시 중인 사진 목록 기준 넘김 (넘김 등록 실패 시 사진 1장만 표시)
function openPhotoModal(title, photos, index) {
    if (typeof window.openGlobalModal !== "function" || !photos.length) return;

    if (!initPhotoModal()) {
        window.openGlobalModal(photos[index].url, title);
        return;
    }

    Object.assign(photoModal, { title, photos, index });
    showModalPhoto();
}

export async function initPledge() {
    const nav = document.getElementById("s2-nav");
    const card = document.getElementById("s2-card");

    if (!nav || !card || !document.getElementById("map-s2")) return;

    // 기본 줌: 초기화 시점 화면 기준 (PC 9 / 모바일 9), 옛지도 보정값 = 기본 줌 - 옛지도 줌
    const baseZoom = MOBILE_QUERY.matches ? DEFAULT_ZOOM_MOBILE : DEFAULT_ZOOM;
    const { map } = createStoryMap("map-s2", {
        center: [37.5759, 126.985],
        zoom: baseZoom,
        zoomOffset: baseZoom - HISTORICAL_ZOOM,
        mapOptions: {
            closePopupOnClick: false,
            doubleClickZoom: false, // 더블클릭 확대 비활성: 기본 줌 외 레벨 진입 시 기본지도 타일 미표시(검은 화면) 방지
        },
    });

    // 거점 연결선 레이어 (단계 선택 시 다시 그림)
    const pathLayer = L.layerGroup().addTo(map);

    const geojson = await fetchTimeTravelData();

    // 거점 목록: start_번호 콘텐츠만 번호순 추출
    const features = geojson.features.filter((f) => STEP_ID.test(String(f.properties.COT_CONTS_ID))).sort((a, b) => Number(STEP_ID.exec(a.properties.COT_CONTS_ID)[1]) - Number(STEP_ID.exec(b.properties.COT_CONTS_ID)[1]));
    // 상세 API 거점 전체 동시 호출 → 목록 속성 + 상세 속성 병합 (좌표는 목록 GeoJSON 기준 [위도, 경도] 변환)
    const details = await Promise.all(features.map((f) => fetchDetail(f.properties.COT_CONTS_ID)));
    const steps = features.map((feature, i) => {
        const props = Object.assign({}, feature.properties, details[i] || {});
        const coords = feature.geometry.type === "Point" ? feature.geometry.coordinates : null;

        return Object.assign({ id: props.COT_CONTS_ID, pos: coords ? [coords[1], coords[0]] : null }, parseProps(props));
    });

    // 수치 띠 '3.1운동 준비과정' 갱신
    setStat("pledge", steps.length);

    if (steps.length === 0) {
        card.innerHTML = '<p class="status-text">거점 정보를 불러올 수 없습니다.</p>';
        return;
    }

    // 1. 단계 버튼 (CSS로 거점 수만큼 진행 막대 칸 표시)
    nav.innerHTML = steps.map((step, i) => `<button type="button" class="step-btn" data-index="${i}" aria-label="${i + 1}번째 장소: ${step.title}">${i + 1}</button>`).join("");
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
            closeButton: true, // X 버튼: 팝업만 닫기 (선택 단계·카드 유지, 마커 재클릭 시 다시 표시)
            autoClose: false,
            closeOnClick: false,
            autoPan: false, // 활성 마커가 지도 중앙 → 자동 이동 불필요, 이동 애니메이션 중 autoPan 충돌 방지
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

    // 웹폰트 로드 완료 후 열린 팝업 위치 재계산 (대체 글꼴 기준 폭으로 배치된 팝업 보정)
    if (document.fonts) {
        document.fonts.ready.then(() => {
            markers.forEach((m) => {
                if (m && m.isPopupOpen()) m.getPopup().update();
            });
        });
    }

    let currentIndex = -1;

    // 스테퍼 요소 (단계 번호 · 장소명 · 이전/다음)
    const stepNum = document.getElementById("s2-step-num");
    const stepTotal = document.getElementById("s2-step-total");
    const stepName = document.getElementById("s2-step-name");
    const prevBtn = document.getElementById("s2-prev");
    const nextBtn = document.getElementById("s2-next");

    if (stepTotal) stepTotal.textContent = pad2(steps.length);

    const updateStepper = (index) => {
        if (stepNum) stepNum.textContent = pad2(index + 1);
        if (stepName) stepName.textContent = steps[index].title;
        if (prevBtn) prevBtn.disabled = index === 0;
        if (nextBtn) nextBtn.disabled = index === steps.length - 1;
    };

    // 3. 상세 카드 렌더링
    function renderCard(step, index) {
        const mapLink = `https://map.seoul.go.kr/smgis2/poiViewMap?ti=11100550&pi=${step.id}&lang=ko`;
        // 사진 슬라이드: 1장씩 표시 + 이전/다음 버튼 · 순서 표시 (s2-pledge.css .pledge-gallery), 설명 있으면 사진 아래 표시
        const slidesHtml = step.photos.map((p, i) => `<figure class="pledge-slide"><button type="button" class="pledge-photo" data-photo="${i}"><img src="${p.url}" alt="${step.title} 사진 ${i + 1}"></button>${p.caption ? `<figcaption class="pledge-photo-cap">${p.caption}</figcaption>` : ""}</figure>`).join("");
        const photoHtml = step.photos.length ? `<div class="pledge-gallery"><div class="pledge-slides">${slidesHtml}</div><button type="button" class="pledge-slide-btn is-prev" aria-label="이전 사진">‹</button><button type="button" class="pledge-slide-btn is-next" aria-label="다음 사진">›</button><span class="pledge-slide-count"></span></div>` : "";
        // 주소 상자: 값 있는 항목만 표시 (rows: [항목명, 값] 목록)
        const addrHtml = (rows) => {
            const html = rows
                .filter(([, value]) => value)
                .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
                .join("");

            return html ? `<dl class="addr-box">${html}</dl>` : "";
        };
        const fieldHtml = (f) => `<section class="pledge-sec"><h4 class="pledge-sec-title">${f.label}</h4>${fieldBodyHtml(f.lines)}</section>`;
        // 카드 기본 항목(역사적 의의 / 현재 상태) / 자세히 보기 항목(나머지 상세 항목, COT_NAME_xx 번호순)
        const mainHtml = step.fields
            .filter((f) => MAIN_FIELDS.includes(f.no))
            .map(fieldHtml)
            .join("");
        const moreFields = step.fields.filter((f) => !MAIN_FIELDS.includes(f.no));
        // 펼침 영역을 버튼 앞에 배치: 펼쳐도 접기 버튼이 링크 버튼 바로 위 유지
        const moreHtml = moreFields.length ? `<div class="pledge-more-body" id="s2-more-body" hidden>${moreFields.map(fieldHtml).join("")}</div><button type="button" class="pledge-more-btn" aria-expanded="false" aria-controls="s2-more-body">자세히 보기</button>` : "";
        const emptyHtml = !step.fields.length ? '<p class="pledge-body">상세 설명이 없습니다.</p>' : "";
        // 카드 주소: 현재주소 · 옛주소 (지번 주소 미표시)
        const mainAddrHtml = addrHtml([
            ["현재주소", step.addrNew],
            ["옛주소", step.addrThen],
        ]);

        card.innerHTML = `
      <p class="pledge-step">STEP ${pad2(index + 1)} / ${pad2(steps.length)}</p>
      <h3 class="pledge-title">${step.title}</h3>
      ${photoHtml}
      ${mainAddrHtml}
      ${mainHtml}
      ${emptyHtml}
      ${moreHtml}
      <div class="btn-pair">
        <a class="line-btn line-btn-red" href="${mapLink}" target="_blank" rel="noopener noreferrer">스마트서울맵</a>
        <a class="line-btn line-btn-gold" href="${toSajeokLink(step)}" target="_blank" rel="noopener noreferrer">독립운동 사적지</a>
      </div>`;
        card.scrollTop = 0;

        initGallery(step, card.querySelector(".pledge-gallery"));

        // 자세히 보기: 나머지 상세 항목 펼침/접힘 (펼침 시 '접기' 표시)
        const moreBtn = card.querySelector(".pledge-more-btn");

        if (!moreBtn) return;

        moreBtn.addEventListener("click", () => {
            const body = card.querySelector(".pledge-more-body");
            const open = body.hidden;

            body.hidden = !open;
            moreBtn.textContent = open ? "접기" : "자세히 보기";
            moreBtn.setAttribute("aria-expanded", String(open));
        });
    }

    // 사진 슬라이드: 이전/다음 버튼 · 가로 넘김(스크롤 스냅), 순서 표시(현재 / 전체), 1장이면 버튼 · 순서 숨김 / 로드 실패(404 등) 사진 제거, 전체 실패 시 사진 영역 제거 / 클릭 시 확대 모달 (장소명 + 사진 설명)
    function initGallery(step, gallery) {
        if (!gallery) return;

        const track = gallery.querySelector(".pledge-slides");
        const prev = gallery.querySelector(".is-prev");
        const next = gallery.querySelector(".is-next");
        const count = gallery.querySelector(".pledge-slide-count");
        const slides = () => [...track.querySelectorAll(".pledge-slide")];
        const current = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        const update = () => {
            const total = slides().length;
            const index = Math.min(current(), total - 1);

            prev.hidden = next.hidden = count.hidden = total < 2;
            prev.disabled = index <= 0;
            next.disabled = index >= total - 1;
            count.textContent = `${index + 1} / ${total}`;
        };

        prev.addEventListener("click", () => track.scrollBy({ left: -track.clientWidth, behavior: "smooth" }));
        next.addEventListener("click", () => track.scrollBy({ left: track.clientWidth, behavior: "smooth" }));
        track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });

        slides().forEach((slide) => {
            const btn = slide.querySelector(".pledge-photo");
            const photo = step.photos[Number(btn.dataset.photo)];

            slide.querySelector("img").addEventListener("error", () => {
                slide.remove();
                if (!slides().length) gallery.remove();
                else update();
            });
            // 사진 클릭: 카드에 남아 있는 사진 목록(로드 실패 제외) 기준 확대 모달 + 넘김
            btn.addEventListener("click", () => {
                const shown = slides().map((s) => step.photos[Number(s.querySelector(".pledge-photo").dataset.photo)]);

                openPhotoModal(step.title, shown, shown.indexOf(photo));
            });
        });

        update();
    }

    // 곡선 구간: 지도 투영 좌표(줌 0) 기준 2차 베지어 → 화면 비율 그대로 휨, 가운데 좌표 · 진행 방향 각도(가운데 접선 = 두 거점 방향) 함께 반환
    function curveSegment(from, to, bend) {
        const p0 = map.project(from, 0);
        const p2 = map.project(to, 0);
        const d = p2.subtract(p0);
        const c = p0
            .add(p2)
            .divideBy(2)
            .add(L.point(-d.y * bend, d.x * bend));
        const at = (t) => map.unproject(L.point((1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p2.x, (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p2.y), 0);
        const latlngs = [];

        for (let i = 0; i <= CURVE_POINTS; i++) latlngs.push(at(i / CURVE_POINTS));

        return { latlngs, mid: at(0.5), angle: (Math.atan2(d.y, d.x) * 180) / Math.PI };
    }

    // 연결선 그리기: 묶음별로 선택 단계 순번 이하 구간만 곡선 연결, 구간 가운데 진행 방향 화살표 / 선택 단계로 들어오는 구간 진하게 · 지난 구간 흐리게
    function drawPaths(currentNo) {
        pathLayer.clearLayers();

        PATH_GROUPS.forEach((group) => {
            group.nos.slice(1).forEach((toNo, i) => {
                const from = steps[group.nos[i] - 1];
                const to = steps[toNo - 1];

                if (toNo > currentNo || !from || !to || !from.pos || !to.pos) return;

                const seg = curveSegment(from.pos, to.pos, group.bends[i] || 0);
                const opacity = toNo === currentNo ? 1 : PAST_PATH_OPACITY;

                L.polyline(seg.latlngs, { color: "#a83228", weight: 3, opacity, dashArray: group.dashed ? "8, 8" : null, lineJoin: "round", interactive: false }).addTo(pathLayer);
                L.marker(seg.mid, {
                    icon: L.divIcon({ className: "path-arrow-wrap", html: `<span class="path-arrow" style="--rot:${seg.angle}deg"></span>`, iconSize: [12, 12], iconAnchor: [6, 6] }),
                    opacity,
                    interactive: false,
                    keyboard: false,
                }).addTo(pathLayer);
            });
        });
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
            navBtns.forEach((btn, i) => btn.classList.toggle("active", i === index));
            updateStepper(index);
            document.querySelectorAll("#map-s2 .step-marker").forEach((el) => {
                el.classList.toggle("is-active", Number(el.dataset.index) === index);
            });

            drawPaths(index + 1);
        }

        syncPopups(index);

        if (!step.pos) return;

        // 선택 장소 중심 이동: 현재 줌 유지 (확대·축소 상태 그대로, 줌 변경 없는 이동만 애니메이션 적용)
        map.panTo(step.pos, { animate: true, duration: 0.8 });
    }

    // 5. 조작: 진행 막대 칸 · 이전/다음 · 방향키
    navBtns.forEach((btn) => btn.addEventListener("click", () => activate(Number(btn.dataset.index))));

    // 스테퍼: 이전/다음 장소 이동
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (currentIndex > 0) activate(currentIndex - 1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            if (currentIndex < steps.length - 1) activate(currentIndex + 1);
        });
    }

    // 키보드: 방향키로 단계 이동 (진행 막대 포커스 상태)
    nav.addEventListener("keydown", (e) => {
        if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;

        e.preventDefault();

        const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
        const next = Math.min(steps.length - 1, Math.max(0, currentIndex + dir));

        activate(next);
        navBtns[next].focus();
    });

    // 모바일 스테퍼 '더보기': 상세 카드 하단 시트 표시
    const moreBtn = document.getElementById("s2-more");

    if (moreBtn) moreBtn.addEventListener("click", () => openSheet(card));

    // PC·모바일 화면 전환: PC 전환 시 시트 닫기(상세 카드 원위치 복원), 팝업 표시 여부 재적용
    MOBILE_QUERY.addEventListener("change", (e) => {
        if (!e.matches) closeSheet();
        if (currentIndex >= 0) syncPopups(currentIndex);
    });

    activate(0);
}