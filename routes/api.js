const express = require('express');
const db = require('../db');
const router = express.Router();

// 固定時間帯（必要に応じて拡張）
const allTimeslots = [
  "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"
];

router.get("/timeslots_table", (req, res) => {
  const { coach_id, course_id, location_id, start } = req.query;
  if (!coach_id || !course_id || !location_id || !start) {
    return res.status(400).json({ error: "全てのパラメータが必要です" });
  }

  const dates = [];
  const base = new Date(start);
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const sql = `
    SELECT ls.id, ls.date, ls.timeslot, ls.max_capacity,
           COUNT(r.id) AS reserved_count,
           SUM(CASE WHEN r.status = 'waitlist' THEN 1 ELSE 0 END) AS waitlist_count
    FROM lesson_slots ls
    LEFT JOIN reservations_v2 r ON r.slot_id = ls.id AND r.status IN ('reserved', 'waitlist')
    WHERE ls.coach_id = ?
      AND ls.course_id = ?
      AND ls.location_id = ?
      AND ls.date BETWEEN ? AND ?
    GROUP BY ls.id
  `;

  const params = [coach_id, course_id, location_id, dates[0], dates[6]];

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "データベースエラー" });
    }

    const table = {};
    allTimeslots.forEach(t => {
      table[t] = {};
      dates.forEach(d => {
        table[t][d] = { status: "unavailable" }; // 初期値 ✖︎
      });
    });

    rows.forEach(row => {
        // 安全チェックを追加
        if (!table[row.timeslot]) {
          console.warn(`未定義の時間帯が存在: ${row.timeslot}`);
          return; // スキップ
        }
      
        let status = "available";
        if (row.reserved_count >= row.max_capacity) {
          status =  "waitlist";
        } else {
            status = "available"; // ← 修正済みであればOK
          }
      
        table[row.timeslot][row.date] = {
          id: row.id,
          status
        };
      });
      

    res.json({ dates, timeslots: allTimeslots, table });
  });
});

module.exports = router;
