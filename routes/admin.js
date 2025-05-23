const express = require('express');
const router = express.Router();
const db = require('../db'); // SQLite 接続インスタンス
const multer = require('multer');
const path = require('path');

const upload = multer({
  dest: path.join(__dirname, '../public/uploads')
});

// GET: 場所一覧＋登録フォーム表示
router.get('/locations', async (req, res) => {
  const locations = await db.allAsync('SELECT * FROM locations');
  console.log('locations:', locations); // ← ここで確認
  res.render('admin/locations', { locations });
});

// POST: 場所を追加
router.post('/locations', async (req, res) => {
  const { name, address } = req.body;
  await db.runAsync('INSERT INTO locations (name, address) VALUES (?, ?)', [name, address]);
  res.redirect('/admin/locations');
});

//場所削除
router.post('/locations/:id/delete', async (req, res) => {
  await db.runAsync('DELETE FROM locations WHERE id = ?', [req.params.id]);
  res.redirect('/admin/locations');
});

//コース編集表示
router.get('/courses/:id/edit', async (req, res) => {
  const course = await db.getAsync('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  const coaches = await db.allAsync('SELECT * FROM coaches');
  res.render('admin/edit_course', { course, coaches });
});

//コース編集処理
router.post('/courses/:id/edit', async (req, res) => {
  const { name, description, coach_id } = req.body;
  await db.runAsync('UPDATE courses SET name = ?, description = ?, coach_id = ? WHERE id = ?', [name, description, coach_id, req.params.id]);
  res.redirect('/admin/courses');
});

//コース削除処理
router.post('/courses/:id/delete', async (req, res) => {
  await db.runAsync('DELETE FROM courses WHERE id = ?', [req.params.id]);
  res.redirect('/admin/courses');
});


// コーチ一覧表示
router.get('/coaches', async (req, res) => {
    try {
      const coaches = await db.allAsync('SELECT * FROM coaches');
      res.render('admin/coaches', { coaches });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });
  
  // コーチ登録フォーム表示
  router.get('/coaches/new', (req, res) => {
    res.render('admin/new_coach');
  });
  
  // コーチ登録処理
  router.post('/coaches', upload.single('photo'), (req, res) => {
    const name = req.body.name;
    const profile = req.body.profile;
    const photo = req.file ? `/uploads/${req.file.filename}` : null;
  
    const sql = 'INSERT INTO coaches (name, profile, image) VALUES (?, ?, ?)';
    db.run(sql, [name, profile, photo], function (err) {
      if (err) return res.status(500).send('DBエラー');
      res.redirect('/admin/coaches');
    });
  });

  //コーチ編集
  router.get('/coaches/:id/edit', async (req, res) => {
    const coach = await db.getAsync('SELECT * FROM coaches WHERE id = ?', [req.params.id]);
    if (!coach) return res.status(404).send('コーチが見つかりません');
    res.render('admin/edit_coach', { coach });
  });

  router.post('/coaches/:id/edit', upload.single('photo'), async (req, res) => {
    const id = req.params.id;
    const { name, profile } = req.body;
  
    // 新しい画像があれば更新、なければそのまま
    let coach = await db.getAsync('SELECT * FROM coaches WHERE id = ?', [id]);
    if (!coach) return res.status(404).send('コーチが見つかりません');
  
    const image = req.file ? `/uploads/${req.file.filename}` : coach.image;
  
    await db.runAsync(
      'UPDATE coaches SET name = ?, profile = ?, image = ? WHERE id = ?',
      [name, profile, image, id]
    );
  
    res.redirect('/admin/coaches');
  });

  //コーチ削除
  router.post('/coaches/:id/delete', async (req, res) => {
    await db.runAsync('DELETE FROM coaches WHERE id = ?', [req.params.id]);
    res.redirect('/admin/coaches');
  });
  

  // スロット登録フォーム表示
router.get('/slots/new', async (req, res) => {
    const coaches = await db.allAsync('SELECT * FROM coaches');
    const courses = await db.allAsync('SELECT * FROM courses');
    const locations = await db.allAsync('SELECT * FROM locations');
    res.render('admin/new_slot', { coaches, courses, locations });
  });
  
  // スロット登録処理
  router.post('/slots', async (req, res) => {
    const { coach_id, course_id, location_id, date, timeslot, note, max_capacity } = req.body;
    await db.runAsync(
      `INSERT INTO lesson_slots (coach_id, course_id, location_id, date, timeslot, status, note, max_capacity)
       VALUES (?, ?, ?, ?, ?, 'available', ?, ?)`,
      [coach_id, course_id, location_id, date, timeslot, note, max_capacity]
    );
    res.redirect('/admin/slots');
  });
  
  // スロット一覧表示
  router.get('/slots', async (req, res) => {
    const slots = await db.allAsync(`
      SELECT 
        ls.*, 
        c.name AS coach_name, 
        co.name AS course_name, 
        l.name AS location
      FROM lesson_slots ls
      LEFT JOIN coaches c ON ls.coach_id = c.id
      LEFT JOIN courses co ON ls.course_id = co.id
      LEFT JOIN locations l ON ls.location_id = l.id
      ORDER BY ls.date ASC, ls.timeslot ASC
    `);
    res.render('admin/slots', { slots });
  });
  
  
// スロット編集フォーム表示
router.get('/slots/:id/edit', async (req, res) => {
    const slot = await db.getAsync('SELECT * FROM lesson_slots WHERE id = ?', [req.params.id]);
    const coaches = await db.allAsync('SELECT * FROM coaches');
    const courses = await db.allAsync('SELECT * FROM courses');
    const locations = await db.allAsync('SELECT * FROM locations');
    res.render('admin/edit_slot', { slot, coaches, courses, locations });
  });
  
  // スロット編集処理
  router.post('/slots/:id/edit', async (req, res) => {
    const { coach_id, course_id, location_id, date, timeslot, note, max_capacity, } = req.body;
    await db.runAsync(
      `UPDATE lesson_slots
       SET coach_id = ?, course_id = ?, location_id = ?, date = ?, timeslot = ?, note = ?, max_capacity = ?
       WHERE id = ?`,
      [coach_id, course_id, location_id, date, timeslot, note, max_capacity, req.params.id]
    );
    res.redirect('/admin/slots');
  });
  
  // スロット削除処理
  router.post('/slots/:id/delete', async (req, res) => {
    await db.runAsync('DELETE FROM lesson_slots WHERE id = ?', [req.params.id]);
    res.redirect('/admin/slots');
  });
  

module.exports = router;
