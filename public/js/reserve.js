document.addEventListener("DOMContentLoaded", () => {
    const coachSelect = document.getElementById("coach-select");
    const courseSelect = document.getElementById("course-select");
    const locationSelect = document.getElementById("location-select");
    const dateList = document.getElementById("date-list");
    const timeGrid = document.getElementById("time-grid");
    const submitButton = document.querySelector("button");
    const selectedSlotInput = document.getElementById("selected-slot-id");
  
    let selectedDate = null;
    let selectedSlotId = null;
  
    function resetAfterCoach() {
      courseSelect.disabled = true;
      locationSelect.disabled = true;
      dateList.innerHTML = "";
      timeGrid.innerHTML = "";
      submitButton.disabled = true;
      selectedSlotInput.value = "";
      selectedSlotId = null;
      selectedDate = null;
    }
  
    function resetAfterCourse() {
      locationSelect.disabled = true;
      dateList.innerHTML = "";
      timeGrid.innerHTML = "";
      submitButton.disabled = true;
      selectedSlotInput.value = "";
      selectedSlotId = null;
      selectedDate = null;
    }
  
    function resetAfterLocation() {
      dateList.innerHTML = "";
      timeGrid.innerHTML = "";
      submitButton.disabled = true;
      selectedSlotInput.value = "";
      selectedSlotId = null;
      selectedDate = null;
    }
  
    // ① コーチ一覧取得
    fetch("/api/coaches")
      .then(res => res.json())
      .then(data => {
        coachSelect.innerHTML = '<option value="">選択してください</option>';
        data.forEach(coach => {
          coachSelect.innerHTML += `<option value="${coach.id}">${coach.name}</option>`;
        });
      });
  
    // ② コーチ選択時
    coachSelect.addEventListener("change", () => {
      const coachId = coachSelect.value;
      resetAfterCoach();
      if (!coachId) return;
  
      fetch(`/api/courses?coach_id=${coachId}`)
        .then(res => res.json())
        .then(data => {
          courseSelect.innerHTML = '<option value="">選択してください</option>';
          data.forEach(course => {
            courseSelect.innerHTML += `<option value="${course.id}">${course.name}</option>`;
          });
          courseSelect.disabled = false;
        });
    });
  
    // ③ コース選択時
    courseSelect.addEventListener("change", () => {
        const courseId = courseSelect.value;
        resetAfterCourse();
        if (!courseId) return;
      
        // courseSelect.disabled = true;  ← 削除
        locationSelect.disabled = true;
        timeGrid.innerHTML = "";        // timeslotsDiv → timeGrid に修正
        submitButton.disabled = true;
      
        fetch(`/api/locations?course_id=${courseId}`)
          .then(res => res.json())
          .then(data => {
            console.log("locations", data);  // ログも適切に
            locationSelect.innerHTML = '<option value="">選択してください</option>';
            data.forEach(loc => {
              locationSelect.innerHTML += `<option value="${loc.id}">${loc.name}</option>`;
            });
            locationSelect.disabled = false;
          });
      });
      
  
    // ④ 場所選択時
    locationSelect.addEventListener("change", () => {
      const courseId = courseSelect.value;
      const locationId = locationSelect.value;
      resetAfterLocation();
      if (!locationId) return;
  
      // 日付リスト取得API呼び出し
      fetch(`/api/available_dates?coach_id=${coachSelect.value}&course_id=${courseId}&location_id=${locationId}`)
        .then(res => res.json())
        .then(dates => {
          dateList.innerHTML = "";
          dates.forEach(date => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = date; // yyyy-mm-dd想定
            btn.className = "date-button";
            btn.addEventListener("click", () => {
              // 選択状態の切り替え
              Array.from(dateList.children).forEach(b => b.classList.remove("selected"));
              btn.classList.add("selected");
              selectedDate = date;
              loadTimeGrid(selectedDate);
            });
            dateList.appendChild(btn);
          });
        });
    });
  
    function loadTimeGrid(date) {
      if (!date) return;
      const courseId = courseSelect.value;
      const locationId = locationSelect.value;
  
      timeGrid.innerHTML = "";
      submitButton.disabled = true;
      selectedSlotInput.value = "";
      selectedSlotId = null;
  
      fetch(`/api/timeslots?coach_id=${coachSelect.value}&course_id=${courseId}&location_id=${locationId}&date=${date}`)
        .then(res => res.json())
        .then(slots => {
          slots.forEach(slot => {
            const div = document.createElement("div");
            let mark, cursorStyle;
  
            if (slot.status === "available") {
              mark = document.createElement("span");
              mark.className = "status-available";
              cursorStyle = "pointer";
            } else if (slot.status === "waitlist") {
              mark = document.createElement("span");
              mark.className = "status-waitlist";
              cursorStyle = "default";
            } else {
              mark = document.createElement("span");
              mark.className = "status-unavailable";
              mark.textContent = "✖︎";
              cursorStyle = "not-allowed";
            }
  
            div.style.cursor = cursorStyle;
            div.style.marginBottom = "8px";
  
            div.appendChild(mark);
            div.insertAdjacentText("beforeend", ` ${slot.timeslot}`);
  
            if (slot.status === "available") {
              div.addEventListener("click", () => {
                // 選択解除＆選択
                if (selectedSlotId === slot.id) {
                  selectedSlotId = null;
                  selectedSlotInput.value = "";
                  div.style.backgroundColor = "";
                } else {
                  // 他の選択リセット
                  Array.from(timeGrid.children).forEach(child => child.style.backgroundColor = "");
                  selectedSlotId = slot.id;
                  selectedSlotInput.value = slot.id;
                  div.style.backgroundColor = "#bbdefb";
                }
                submitButton.disabled = !selectedSlotId;
              });
            }
  
            timeGrid.appendChild(div);
          });
        });
    }
  
    // ⑤ フォーム送信
    document.getElementById("reservation-form").addEventListener("submit", e => {
      e.preventDefault();
      if (!selectedSlotId) {
        alert("日時を選択してください");
        return;
      }
      console.log("予約スロットID:", selectedSlotId);
  
      // 実際はここで予約APIへPOSTなど処理をする
    });
  });
  