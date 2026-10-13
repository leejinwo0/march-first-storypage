/* =======================================================
   Mobile Card 5: 역사의 현장 장소 목록 + 상세 모달
   - 데이터·분류·필드 매핑: pc-sections/section4.js와 동일 (스마트서울맵 테마 API 11100550)
   - COT_THEME_SUB_ID '4': 중요 지점(hub) / '3': 시위 장소(site)
   - 상단 탭 전환 필터, 항목 탭 시 하단 시트 모달 표시
======================================================= */
import { fetchTimeTravelData } from "/api/mapService.js";

const CATEGORY_LABEL = { hub: "중요 지점", site: "시위 장소" };

export async function initMobileSection4() {
  const placeList = document.getElementById("mobile-s4-list");
  const tabs = document.querySelectorAll(".mobile-place-tab");
  if (!placeList) return;

  const modal = createPlaceModal();
  const modalBody = modal.querySelector(".mobile-modal-body");

  try {
    const geojsonData = await fetchTimeTravelData();

    // 1. 장소 데이터 분류 (PC section4와 동일 필드·기본 문구)
    const places = { hub: [], site: [] };

    geojsonData.features.forEach((feature) => {
      const props = feature.properties;
      const subId = String(props.COT_THEME_SUB_ID);
      const name = props.COT_CONTS_NAME || "알 수 없는 장소";
      const address =
        props.COT_ADDR_FULL_NEW || props.COT_ADDR_FULL_OLD || "주소 정보 없음";
      const desc =
        props.COT_VALUE_03 || props.COT_VALUE_01 || "상세 설명이 없습니다.";

      const poiId = props.COT_CONTS_ID;
      const mapLink = `https://map.seoul.go.kr/smgis2/poiViewMap?ti=11100550&pi=${poiId}&lang=ko`;

      if (!props.COT_COORD_Y || !props.COT_COORD_X) return;

      const place = { name, address, desc, mapLink };
      if (subId === "4") places.hub.push(place);
      else if (subId === "3") places.site.push(place);
    });

    // 2. 탭 라벨에 장소 수 표시
    tabs.forEach((tab) => {
      const count = tab.querySelector(".mobile-place-count");
      if (count) count.textContent = places[tab.dataset.filter].length;
    });

    // 3. 목록 렌더링
    const renderList = (key) => {
      placeList.innerHTML = "";
      placeList.dataset.category = key;

      if (places[key].length === 0) {
        placeList.innerHTML =
          '<li class="mobile-empty-msg">표시할 장소가 없습니다.</li>';
        return;
      }

      places[key].forEach((place, index) => {
        const li = document.createElement("li");
        li.className = "mobile-place-item";
        li.innerHTML = `
          <button type="button" class="mobile-place-btn">
            <span class="mobile-place-num">${String(index + 1).padStart(2, "0")}</span>
            <span class="mobile-place-text">
              <strong class="mobile-place-name">${place.name}</strong>
              <span class="mobile-place-addr">${place.address}</span>
            </span>
            <span class="mobile-place-arrow" aria-hidden="true">›</span>
          </button>
        `;
        li.querySelector("button").addEventListener("click", () =>
          openPlace(place, key),
        );
        placeList.appendChild(li);
      });
    };

    // 4. 상세 모달 (PC 팝업과 동일 구성: 이름·주소·설명·외부 링크)
    const openPlace = (place, key) => {
      modalBody.innerHTML = `
        <div class="mobile-place-detail" data-category="${key}">
          <span class="mobile-place-badge">${CATEGORY_LABEL[key]}</span>
          <h3 class="mobile-modal-title">${place.name}</h3>
          <p class="mobile-place-detail-addr">${place.address}</p>
          <div class="mobile-place-detail-desc">${place.desc.replace(/\n/g, "<br>")}</div>
          <div class="mobile-card-btns">
            <a href="${place.mapLink}" target="_blank" rel="noopener noreferrer" class="mobile-btn map-btn">스마트서울맵</a>
            <a href="https://history.seoul.go.kr/" target="_blank" rel="noopener noreferrer" class="mobile-btn history-btn">역사편찬원</a>
          </div>
        </div>
      `;
      modal.classList.add("active");
    };

    // 5. 탭 전환 (aria-selected 동기화)
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
        renderList(tab.dataset.filter);
        placeList.scrollTop = 0;
      });
    });

    renderList("hub");
  } catch (error) {
    console.error("모바일 Section 4 데이터를 불러오는 중 오류 발생:", error);
    placeList.innerHTML =
      '<li class="mobile-empty-msg">데이터를 불러올 수 없습니다.</li>';
  }
}

/* -------------------------------------------------------
   장소 상세 모달(하단 시트) 마크업 1회 생성
   - 스타일: index-mobile.css 공통 하단 시트 모달 클래스 재사용
------------------------------------------------------- */
function createPlaceModal() {
  let modal = document.getElementById("mobile-place-modal");
  if (modal) return modal;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div id="mobile-place-modal" class="mobile-modal-overlay">
      <div class="mobile-modal-container">
        <button type="button" class="mobile-modal-close" aria-label="닫기">&times;</button>
        <div class="mobile-modal-body"></div>
      </div>
    </div>
  `,
  );
  modal = document.getElementById("mobile-place-modal");

  const close = () => modal.classList.remove("active");
  modal.querySelector(".mobile-modal-close").addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  }); // 시트 바깥 탭 시 닫기

  return modal;
}