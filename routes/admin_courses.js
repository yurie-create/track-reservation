const express = require('express');
const router = express.Router();
const db = require('../db');

// コース一覧表示
router.get('/courses', async (req, res) => {
  db.all('SELECT courses.*, coaches.name AS coach_name FROM courses LEFT JOIN coaches ON courses.coach_id = coaches.id', (err, courses) => {
    if (err) {
      return res.status(500).send("DBエラー");
    }
    res.render('admin/courses', { courses });
  });
});

// コース登録フォーム表示
router.get('/courses/new', (req, res) => {
  // コーチ一覧も渡してフォームで選べるようにする
  db.all('SELECT * FROM coaches', (err, coaches) => {
    if (err) {
      return res.status(500).send("DBエラー");
    }
    res.render('admin/new_course', { coaches });
  });
});

// コース登録処理
router.post('/courses', (req, res) => {
  const { name, description, coach_id } = req.body;
  db.run('INSERT INTO courses (name, description, coach_id) VALUES (?, ?, ?)', [name, description, coach_id], (err) => {
    if (err) {
      return res.status(500).send("DBエラー");
    }
    res.redirect('/admin/courses');
  });
});

module.exports = router;
