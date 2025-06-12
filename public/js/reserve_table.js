// public/js/reserve_table.js
let selectedSlotId = null;
let coachSelect, courseSelect, locationSelect, startDate;

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

document.addEventListener("DOMContentLoaded", () => {
 
  const tableContainer = document.getElementById("timeslot-table-container");
  const prevWeekBtn = document.getElementById("prev-week");
  const nextWeekBtn = document.getElementById("next-week");



  const selectedSlotInput = document.getElementById("selected-slot-id");

  startDate = new Date();

  nextWeekBtn.addEventListener("click", () => {
    startDate.setDate(startDate.getDate() + 7);
    loadTimeslotTable();
  });
  
  prevWeekBtn.addEventListener("click", () => {
    startDate.setDate(startDate.getDate() - 7);
    loadTimeslotTable();
  });

  function resetSelections() {
    selectedSlotId = null;
    selectedSlotInput.value = "";
  
  }
  

  function loadTimeslotTable() {
    const selectedCoach = document.querySelector('input[name="coach"]:checked')?.value;
  const selectedCourse = document.querySelector('input[name="course"]:checked')?.value;
  const selectedLocation = document.querySelector('input[name="location"]:checked')?.value;

  if (!selectedCoach || !selectedCourse || !selectedLocation) return;

  const startStr = formatDate(startDate);
  fetch(`/api/timeslots_table?coach_id=${selectedCoach}&course_id=${selectedCourse}&location_id=${selectedLocation}&start=${startStr}`)
    .then(res => res.json())
    .then(data => {
      renderTable(data);
    });
  }

  fetch("/api/coaches")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("coach-container");
    container.innerHTML = '';
    data.forEach(coach => {
      const label = document.createElement('label');
      label.className = 'staff-card';
      label.innerHTML = `
        <input type="radio" name="coach" value="${coach.id}">
        <img src="${coach.image || '/images/default.jpg'}" alt="${coach.name}">
        <div><strong>${coach.name}</strong></div>
        <div style="font-size: 0.9em; color: #666;">${coach.profile || ''}</div>
      `;
      container.appendChild(label);
    });
  });

  function renderTable(data) {
    const tableContainer = document.getElementById("timeslot-table-container");
    tableContainer.innerHTML = "";
    resetSelections();
  
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
  
    headRow.innerHTML = '<th>時間 \\ 日付</th>' + data.dates.map(d => `<th>${d}</th>`).join("");
    thead.appendChild(headRow);
    table.appendChild(thead);
  
    const tbody = document.createElement("tbody");
  
    data.timeslots.forEach(time => {
      const row = document.createElement("tr");
      const timeCell = document.createElement("td");
      timeCell.textContent = time;
      row.appendChild(timeCell);
    
      data.dates.forEach(date => {
        const slot = data.table[time]?.[date];
        const cell = document.createElement("td");
    
        if (!slot || slot.status === "unavailable") {
          cell.className = "status-unavailable";
          cell.textContent = "✖︎";
        } else if (slot.status === "waitlist") {
          cell.className = "status-waitlist";
          cell.textContent = "▲";
        } else {
          cell.className = "status-available";
          cell.innerHTML = '<div class="circle-dot"></div>';
          cell.addEventListener("click", () => {
            console.log("✅ ●がクリックされました:", slot);
            document.querySelectorAll("td").forEach(td => td.classList.remove("selected"));
            cell.classList.add("selected");
            selectedSlotId = slot.id;
            document.getElementById("selected-slot-id").value = slot.id;
    
            const submitBtn = document.querySelector("button[type='submit']");
            if (submitBtn) {
              if (window.CURRENT_USER_ID !== null && window.CURRENT_USER_ID !== 'null') {
                submitBtn.disabled = false;
              }
            }
          });
        }
    
        // ✅ ここに入れ忘れるとセルが表示されなくなる
        row.appendChild(cell);
      });
    
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody); // ✅ 忘れずに
    tableContainer.appendChild(table); // ✅ 表を画面に追加
  
  }
  
  document.getElementById("reservation-form").addEventListener("submit", e => {
   
  
    if (!selectedSlotId) {
      alert("日時を選択してください");
      return;
    }
  
    // ✅ ログインチェック
    if (window.CURRENT_USER_ID === null || window.CURRENT_USER_ID === 'null') {
      alert("予約にはログインが必要です");
      window.location.href = "/login";
      return;
    }
    e.preventDefault();
    // ✅ ログインしてたらモーダル表示
    const coachName = document.querySelector('input[name="coach"]:checked')?.parentElement?.textContent.trim();
    const courseName = document.querySelector('input[name="course"]:checked')?.parentElement?.textContent.trim();
    const locationName = document.querySelector('input[name="location"]:checked')?.parentElement?.textContent.trim();
  
    const date = formatDate(startDate);
    const selectedCell = document.querySelector("td.selected");
    const selectedTime = selectedCell ? selectedCell.parentElement.firstChild.textContent : "不明";
  
    const message = `
      コーチ：${coachName}<br>
      コース：${courseName}<br>
      場所：${locationName}<br>
      日時：${date} ${selectedTime}
    `;
   
    document.getElementById("confirm-details").innerHTML = message;
    document.getElementById("confirm-modal").style.display = "block";
    document.getElementById("modal-overlay").style.display = "block";
  });
  
document.getElementById("confirm-submit").addEventListener("click", () => {
  const userId = window.CURRENT_USER_ID;
  const note = document.querySelector('textarea[name="note"]').value;

  fetch("/api/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      slot_id: selectedSlotId,
      notes: note
    }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        window.location.href = "/thanks";
      } else {
        alert("予約に失敗しました");
      }
    });

  closeModal();
});


document.addEventListener("change", e => {
  if (e.target.name === "coach") {
    resetSelections();
    const coachId = e.target.value;
    fetch(`/api/courses?coach_id=${coachId}`)
      .then(res => res.json())
      .then(courses => {
        const container = document.getElementById("course-container");
        container.innerHTML = '';
        courses.forEach(course => {
          const label = document.createElement('label');
          label.className = 'select-box';
          
          label.innerHTML = `
<input type="radio" name="course" value="${course.id}">
<div class="course-main">
  <div class="course-header">
    <strong>${course.name}</strong>
    <button type="button" class="toggle-desc">詳細</button>
  </div>
  <div class="course-desc" style="display: none;">
    ${course.description || ''}
  </div>
</div>
`;

        
          // 詳細ボタンの開閉処理を追加
          setTimeout(() => {
            const toggle = label.querySelector('.toggle-desc');
            const desc = label.querySelector('.course-desc');
            toggle.addEventListener('click', (e) => {
              e.preventDefault();
              desc.style.display = desc.style.display === 'none' ? 'block' : 'none';
            });
          });
        
          container.appendChild(label);
        });
        
      });
  }

  if (e.target.name === "course") {
    resetSelections();
    const courseId = e.target.value;
    fetch(`/api/locations?course_id=${courseId}`)
      .then(res => res.json())
      .then(locations => {
        const container = document.getElementById("location-container");
        container.innerHTML = '';
        locations.forEach(location => {
          const label = document.createElement('label');
          label.className = 'select-box';
          label.innerHTML = `
            <input type="radio" name="location" value="${location.id}">
            ${location.name}
          `;
          container.appendChild(label);
        });
      });
  }

  if (e.target.name === "location") {
    loadTimeslotTable();
  }
});
// デバッグ：ボタン制御
console.log("👀 USER:", window.CURRENT_USER_ID);
const submitBtn = document.querySelector("button[type='submit']");

if (submitBtn) {
  if (window.CURRENT_USER_ID !== null && window.CURRENT_USER_ID !== 'null') {
    console.log("✅ ログイン中なのでボタン有効化");
    submitBtn.disabled = false;
    submitBtn.removeAttribute('disabled');
  } else {
    console.log("❌ 未ログインなのでボタン無効化");
    submitBtn.disabled = false;
  }
}

});

