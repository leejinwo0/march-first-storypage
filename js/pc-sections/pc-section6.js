/* =======================================================
   Section 6: 남겨진 유산 (의의 카드 + 상세 모달)
======================================================= */
export function initSection6() {
  // 1. 스크롤 등장 애니메이션 (.sc6-reveal → .active)
  const sc6RevealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("active");
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
  );

  document
    .querySelectorAll(".sc6-reveal")
    .forEach((el) => sc6RevealObserver.observe(el));

  // 2. 상세 모달 마크업 동적 생성 (body 하단 삽입)
  const modalHTML = `
    <div id="sc6-modal" class="sc6-modal-overlay">
      <div class="sc6-modal-container">
        <button id="sc6-modal-close" class="sc6-modal-close">&times;</button>
        <div class="sc6-modal-header">
          <span id="sc6-modal-num" class="sc6-modal-num">01</span>
          <h3 id="sc6-modal-title" class="sc6-modal-title">Title</h3>
          <p id="sc6-modal-en" class="sc6-modal-en">English subtitle</p>
        </div>
        <div class="sc6-modal-body">
          <p id="sc6-modal-desc">상세 내용이 들어갑니다.</p>
          
          <a href="https://encykorea.aks.ac.kr/Article/E0026772" target="_blank" class="sc6-modal-link">
            한국민족문화대백과사전 원문 보기 ↗
          </a>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const modal = document.getElementById("sc6-modal");
  const modalClose = document.getElementById("sc6-modal-close");
  const modalNum = document.getElementById("sc6-modal-num");
  const modalTitle = document.getElementById("sc6-modal-title");
  const modalEn = document.getElementById("sc6-modal-en");
  const modalDesc = document.getElementById("sc6-modal-desc");

  // 3. 카드별 상세 내용 (출처: 한국민족문화대백과사전, 카드 순서와 인덱스 일치)
  const expandedDetails = [
    // 01. 통치방식의 전환
    "일본은 군사력에 의한 무단통치로는 이 운동의 뿌리를 뽑을 수도 없고, 국제 외교상의 비난을 면하기 위해서라도 어떤 조처가 필요함을 느꼈습니다. 그리하여 이른바 '문화통치'로 한국인을 기만하여 식민통치의 목적을 달성하고자, 총독의 자격을 무관에서 문관으로 바꾸고 제복과 패검 폐지, 보통경찰제 도입, 태형제도 폐지 등을 단행하였습니다.",

    // 02. 임시정부의 수립
    "민족사적 의의로 3·1운동은 세계의 이목을 집중시켜 한국민에 대한 인식을 새롭게 하였고, 이로 인해 중국 상하이에 대한민국임시정부가 수립되었습니다. 또한 이민족에 대한 끈질기고 강렬한 독립투쟁정신을 고취하였으며, 민족의식에 새로운 자각과 힘을 주어 교육의 진흥과 신문예·산업운동이 활성화되어 민족 자립의 기초를 다지게 하였습니다.",

    // 03. 자주정신의 확산
    "사상사적 측면에서 독립선언서 등에 자주독립의 사상을 명시하였고, 자유평등·민주주의·애국·애족·인도주의를 곁들인 신사상의 출현을 가져왔습니다. 경제사적으로도 물산장려운동, 국산품애용운동 등 경제적 자립을 꾀하는 운동이 계속되어 민족기업을 건설하려는 운동으로까지 확대되었으며, 이는 전국적으로 확대되어 한국경제사의 내재적 발전의 원동력이 되었습니다.",
  ];

  // 4. 카드 클릭 → 카드 텍스트 + 상세 내용 모달 표시
  const cards = document.querySelectorAll(".sc6-card");
  cards.forEach((card, index) => {
    card.style.cursor = "pointer";

    card.addEventListener("click", () => {
      const num = card.querySelector(".sc6-card-num").textContent;
      const title = card.querySelector(".sc6-card-title").textContent;
      const en = card.querySelector(".sc6-card-en").textContent;

      modalNum.textContent = num;
      modalTitle.textContent = title;
      modalEn.textContent = en;
      modalDesc.textContent = expandedDetails[index] || "상세 내용이 없습니다.";

      // 모달 열림 동안 배경 스크롤 잠금
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    });
  });

  // 5. 모달 닫기 (닫기 버튼 / 배경 클릭)
  const closeModal = () => {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  };

  modalClose.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}
