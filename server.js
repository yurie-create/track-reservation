const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const allSlots = [
  { course: '短距離', timeslot: '10:00〜11:00' },
  { course: '短距離', timeslot: '11:00〜12:00' },
  { course: '長距離', timeslot: '10:00〜11:00' },
  { course: '長距離', timeslot: '11:00〜12:00' }
];
const moment = require('moment'); // moment.jsを使って日付操作を簡単に
const MAX_RESERVATIONS_PER_SLOT = 5;
const flash = require('connect-flash');
const { createObjectCsvStringifier } = require('csv-writer');
const adminRoutes = require('./routes/admin');
const adminCoursesRouter = require('./routes/admin_courses');
const apiRoutes = require('./routes/api');
const sendMail = require('./utils/sendMail');
require('dotenv').config();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});









// サーバー起動時にテーブルの作成とカラムの追加を確認
// SQLite3データベースの設定
const db = new sqlite3.Database('./users.db');

// サーバー起動時にテーブルの作成とカラムの追加を確認
db.serialize(() => {
  // users テーブル作成（なければ作る）
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lastName TEXT,
      firstName TEXT,
      lastNameKana TEXT,
      firstNameKana TEXT,
      birthDate TEXT,
      phone TEXT,
      gender TEXT,
      postal TEXT,
      address1 TEXT,
      sports TEXT,
      email TEXT UNIQUE,
      password TEXT,
      agree INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0  -- 0=一般ユーザー, 1=管理者
    )
  `);
  // users テーブルにis_adminカラムが無ければ追加
  db.all('PRAGMA table_info(users);', (err, columns) => {
    if (err) {
      console.error('usersテーブルのカラム情報取得エラー:', err);
      return;
    }
    const hasIsAdmin = columns.some(col => col.name === 'is_admin');
    if (!hasIsAdmin) {
      db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER `, (err) => {
        if (err) {
          console.error('is_adminカラム追加エラー:', err);
        } else {
          console.log('usersテーブルに is_admin カラムを追加しました');
        }
      });
    }
  });

  // reservationsテーブルを作成（もし存在しない場合）
  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      course TEXT NOT NULL,
      timeslot TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('reservationsテーブル作成エラー:', err);
    } else {
      console.log('reservations テーブルが作成されました。');
    }
  });

  // nameカラムがなければ追加
  db.all('PRAGMA table_info(reservations);', (err, columns) => {
    if (err) {
      console.error('カラム情報の取得エラー:', err);
      return;
    }
    const hasNameColumn = columns.some(col => col.name === 'name');
    if (!hasNameColumn) {
      db.run(`ALTER TABLE reservations ADD COLUMN name TEXT DEFAULT '未設定'`, (err) => {
        if (err) console.error('nameカラム追加エラー:', err);
        else console.log('reservationsテーブルにnameカラムを追加しました。');
      });
    }
    const hasNoteColumn = columns.some(col => col.name === 'note');
    if (!hasNoteColumn) {
      db.run(`ALTER TABLE reservations ADD COLUMN note TEXT`, (err) => {
        if (err) console.error('noteカラム追加エラー:', err);
        else console.log('reservationsテーブルにnoteカラムを追加しました。');
      });
    }
  });

  // disabled_slots テーブル作成（なければ作る）
  db.run(`
    CREATE TABLE IF NOT EXISTS disabled_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      course TEXT NOT NULL,
      timeslot TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('disabled_slotsテーブル作成エラー:', err);
    } else {
      console.log('disabled_slotsテーブルを作成しました。');
    }
  });
});

// ミドルウェア設定
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// セッション設定
app.use(session({
  secret: 'secret_key',
  resave: false,
  saveUninitialized: true
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const publicPaths = ['/login', '/register'];
  if (!req.session.user && !publicPaths.includes(req.originalUrl)) {
    return res.redirect('/login');
  }
  next();
});

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

app.use(flash());
app.use('/admin', adminRoutes);
app.use('/admin', adminCoursesRouter);
// ルーティング
app.use('/api', apiRoutes);
app.use(express.static(path.join(__dirname, 'public')));

// ビューエンジンの設定 (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));



// ログインフォームを表示
app.get('/login', (req, res) => {
  const successMessages = req.flash('success');
  res.render('login', { successMessages });
  });
  app.get('/register', (req, res) => {
    res.render('register');
  });
  
  // ログイン処理
  app.post('/login', (req, res) => {
    const { email, password } = req.body;
  
    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, user) => {
        if (err) return res.status(500).send('ログイン失敗');
        if (!user) return res.status(401).send('メールまたはパスワードが間違っています');
  
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).send('メールまたはパスワードが間違っています');
  
        // セッション保存
        req.session.user = {
          id: user.id,
          name: `${user.lastName} ${user.firstName}`,
          is_admin: Number(user.is_admin)
        };
        console.log('ログインユーザーのセッション情報:', req.session.user);
        res.redirect('/');
      }
    );
  });
// ルーティング
app.get('/', (req, res) => {
  const user = req.session.user;
  res.render('index', {user});
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});
  
app.get('/register', (req, res) => {
  res.render('register');
});

  // ユーザー登録フォーム表示
  app.post('/register', async (req, res) => {
    const {
      lastName,
      firstName,
      lastNameKana,
      firstNameKana,
      birthday,
      phone,
      gender,
      email,
      password,
      postal,
      address1,
      courses,
      terms
    } = req.body;
  
    // 利用規約チェック
    if (!terms) {
      return res.status(400).send('利用規約への同意が必要です');
    }
  
    // パスワード一致チェック（念のため）
    if (!password || !req.body.confirmPassword || password !== req.body.confirmPassword) {
      return res.status(400).send('パスワードが一致しません');
    }
  
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const fullName = `${lastName} ${firstName}`;
      const fullKana = `${lastNameKana} ${firstNameKana}`;
      const coursesStr = Array.isArray(courses) ? courses.join(',') : courses;
  
      db.run(
        `INSERT INTO users 
          (lastName, firstName, lastNameKana, firstNameKana, birthDate, phone, gender, postal, address1, sports, email, password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [lastName, firstName, lastNameKana, firstNameKana, birthday, phone, gender, postal, address1, coursesStr, email, hashedPassword],
        function (err) {
          if (err) {
            console.error(err);
            return res.status(500).send('登録失敗：メールアドレスが既に使われている可能性があります');
          }
          req.flash('success', '登録が完了しました。ログインしてください。');
    
          res.redirect('/login');
        }
      );
    } catch (err) {
      console.error(err);
      res.status(500).send('登録時にエラーが発生しました');
    }
  });
  
  
app.get('/admin', (req, res) => {
  console.log('req.session.user:', req.session.user);
  const user = req.session.user;

  if (!user || Number(user.is_admin) !== 1) {
    return res.status(403).send('アクセス拒否');
  }

  const reservationSql = `
    SELECT r.id, u.lastName || ' ' || u.firstName AS name, u.email, r.date, r.timeslot, r.course, r.note
    FROM reservations r
    JOIN users u ON r.user_id = u.id
    ORDER BY r.date ASC
  `;

  const disabledSql = `
    SELECT date, course, timeslot FROM disabled_slots ORDER BY date ASC
  `;
  db.all(reservationSql, [], (err, reservations) => {
    if (err) if (err) {
      console.error('予約の取得エラー:', err);
      return res.status(500).send('データベースエラー');
    }

    db.all(disabledSql, [], (err2, disabledSlots) => {
      if (err2) return res.status(500).send('データベースエラー (disabled_slots)');

      res.render('admin', {
        reservations,
        disabledSlots,
        successMessage: req.flash('success'),
        errorMessage: req.flash('error')
      });
    });
  });
});

// 管理者用ユーザー一覧（検索付き）
app.get('/admin/users', (req, res) => {
  const user = req.session.user;

  if (!user || user.is_admin !== 1) {
    return res.status(403).send('アクセス拒否');
  }

  const search = req.query.search || '';
  let sql = 'SELECT * FROM users';
  const params = [];

  if (search) {
    sql += ' WHERE email LIKE ?';
    params.push(`%${search}%`);
  }

  db.all(sql, params, (err, users) => {
    if (err) {
      console.error('ユーザー一覧の取得に失敗:', err);
      return res.status(500).send('ユーザー一覧の取得に失敗しました');
    }

    res.render('admin_users', { users, search });
  });
});


app.get('/admin/users/:id/reservations', (req, res) => {
  const user = req.session.user;
  const userId = req.params.id;

  if (!user || user.is_admin !== 1) {
    return res.status(403).send('アクセス拒否');
  }

  const userSql = 'SELECT id, lastName, firstName, email FROM users WHERE id = ?';
  const reservationsSql = `
  SELECT
  r.id AS reservation_id,
      r.notes,
      s.date,
      s.timeslot,
      c.name AS coach_name,
      co.name AS course_name,
      l.name AS location_name
    FROM reservations_v2 r
    JOIN lesson_slots s ON r.slot_id = s.id
    LEFT JOIN coaches c ON s.coach_id = c.id
    LEFT JOIN courses co ON s.course_id = co.id
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE r.user_id = ?
    ORDER BY s.date ASC, s.timeslot ASC
  `;

  db.get(userSql, [userId], (err, userInfo) => {
    if (err || !userInfo) {
      return res.status(404).send('ユーザーが見つかりません');
    }

    db.all(reservationsSql, [userId], (err2, reservations) => {
      if (err2) {
        return res.status(500).send('予約の取得に失敗しました');
      }

      res.render('user_reservations', {
        user: userInfo,
        reservations
      });
    });
  });
});


 
app.post('/admin/disable-slot', (req, res) => {
  const { date, course, timeslot } = req.body;

  const sql = `
    INSERT INTO disabled_slots (date, course, timeslot)
    VALUES (?, ?, ?)
  `;
  db.run(sql, [date, course, timeslot], function(err) {
    if (err) {
      console.error('エラー:', err);
      req.flash('error', 'エラーが発生しました');
    } else {
      req.flash('success', '予約枠を無効化しました');
    }
    res.redirect('/admin');
  });
});

app.get('/admin/export-reservations-csv', (req, res) => {
  const user = req.session.user;
  if (!user || user.is_admin !== 1) {
    return res.status(403).send('アクセス拒否');
  }

  const sql = `
    SELECT 
      r.id AS reservation_id,
      u.lastName || ' ' || u.firstName AS user_name,
      u.email,
      ls.date,
      ls.timeslot,
      c.name AS coach_name,
      co.name AS course_name,
      l.name AS location_name,
      r.status AS reservation_status,
      r.notes
    FROM reservations_v2 r
    JOIN users u ON r.user_id = u.id
    JOIN lesson_slots ls ON r.slot_id = ls.id
    LEFT JOIN coaches c ON ls.coach_id = c.id
    LEFT JOIN courses co ON ls.course_id = co.id
    LEFT JOIN locations l ON ls.location_id = l.id
    ORDER BY ls.date ASC, ls.timeslot ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('CSV出力用データ取得エラー:', err);
      return res.status(500).send('エクスポートに失敗しました');
    }

    const csvWriter = createObjectCsvStringifier({
      header: [
        { id: 'reservation_id', title: '予約ID' },
        { id: 'user_name', title: '氏名' },
        { id: 'email', title: 'メールアドレス' },
        { id: 'date', title: '日付' },
        { id: 'timeslot', title: '時間帯' },
        { id: 'coach_name', title: 'コーチ' },
        { id: 'course_name', title: 'コース' },
        { id: 'location_name', title: '場所' },
        { id: 'reservation_status', title: 'ステータス' },
        { id: 'note', title: '備考' }
      ]
    });

    const csv = csvWriter.getHeaderString() + csvWriter.stringifyRecords(rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=reservations.csv');
    res.send('\uFEFF' + csv); // Excelで文字化けしないようにBOM付き
  });
});


app.get('/my-reservations', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const userId = req.session.user.id;

  const sql = `
    SELECT
      r.id AS reservation_id,
      r.notes,
      s.date,
      s.timeslot,
      c.name AS coach_name,
      co.name AS course_name,
      l.name AS location_name
    FROM reservations_v2 r
    JOIN lesson_slots s ON r.slot_id = s.id
    LEFT JOIN coaches c ON s.coach_id = c.id
    LEFT JOIN courses co ON s.course_id = co.id
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE r.user_id = ?
    ORDER BY s.date ASC, s.timeslot ASC
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error("予約取得エラー:", err);
      return res.status(500).send("予約データ取得に失敗しました");
    }
    res.render("my-reservations", { reservations: rows });
  });
});



app.post('/cancel/:id', (req, res) => {
  const userId = req.session.user.id;
  const reservationId = req.params.id;

  // 自分の予約だけ削除できるようにチェック
  db.run(
    'DELETE FROM reservations_v2 WHERE id = ? AND user_id = ?',
    [reservationId, userId],
    function (err) {
      if (err) return res.status(500).send('キャンセルに失敗しました');
      if (this.changes === 0) return res.status(403).send('許可されていない操作です');
      res.redirect('/my-reservations');
    }
  );
});

app.get('/calendar', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('calendar');
});



// 月単位の予約状況（FullCalendar用）
// カレンダー表示用（範囲指定のイベント取得）
function getAllDatesInRange(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const dates = [];

  while (start <= end) {
    const yyyy = start.getFullYear();
    const mm = String(start.getMonth() + 1).padStart(2, '0');
    const dd = String(start.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    start.setDate(start.getDate() + 1);
  }

  return dates;
}

app.get('/api/reservations/range', (req, res) => {
  const { start, end } = req.query;

  // 日付だけに整形（例: 2025-04-27T00:00:00+09:00 → 2025-04-27）
  const startDate = start?.split('T')[0];
  const endDate = end?.split('T')[0];
  const today = new Date().toISOString().split('T')[0]; // 今日の日付（例: '2025-05-14'）


  console.log('🗓️ API受信 start:', startDate, 'end:', endDate);

  const sql = `
    SELECT date, course, timeslot, COUNT(*) as count
    FROM reservations
    WHERE date BETWEEN ? AND ?
    GROUP BY date, course, timeslot
  `;

  db.all(sql, [startDate, endDate], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
  
    // 無効スロット取得
    const disabledSql = `
      SELECT date, course, timeslot FROM disabled_slots
      WHERE date BETWEEN ? AND ?
    `;
  
    db.all(disabledSql, [startDate, endDate], (err2, disabledRows) => {
      if (err2) return res.status(500).json({ error: 'DB error (disabled_slots)' });
  
      const disabledKeys = new Set(disabledRows.map(d => `${d.date}-${d.course}-${d.timeslot}`));
      
      const eventMap = {};
      rows.forEach(row => {
        const key = row.date;
        if (!eventMap[key]) eventMap[key] = [];
        eventMap[key].push(row);
      });
  
      const dateList = [];
      let current = new Date(startDate);
      const endObj = new Date(endDate);
      while (current <= endObj) {
        const d = current.toISOString().split('T')[0];
        dateList.push(d);
        current.setDate(current.getDate() + 1);
      }
  
      const events = [];
      const filteredDateList = dateList.filter(date => date >= today);
  
      // 無効スロットを表示
      disabledRows.forEach(disabled => {
        const title = `${disabled.course} - ${disabled.timeslot || '時間未定'}：無効`;
        events.push({
          title,
          start: disabled.date,
          allDay: true,
          backgroundColor: '#ccc', // グレー表示など
          borderColor: '#999',
          extendedProps: {
            course: disabled.course,
            timeslot: disabled.timeslot || '時間未定',
            disabled: true
          }
        });
      });

      filteredDateList.forEach(date => {
        const rowsForDate = eventMap[date] || [];
  
        const bookedKeys = rowsForDate.map(r => `${date}-${r.course}-${r.timeslot}`);
  
        rowsForDate.forEach(row => {
          const key = `${row.date}-${row.course}-${row.timeslot}`;
          if (disabledKeys.has(key)) return;
  
          const remaining = 5 - row.count;
          const displayText = remaining <= 0 ? '空きなし' : `残り ${remaining} 枠`;
          events.push({
            title: `${row.course} - ${row.timeslot || '時間未定'}：${displayText}`,
            start: date,
            allDay: true,
            extendedProps: {
              course: row.course,
              timeslot: row.timeslot || '時間未定',
              remaining: 5 - row.count
            }
          });
        });
  
        allSlots.forEach(slot => {
          const fullKey = `${date}-${slot.course}-${slot.timeslot}`;
        
          if (!bookedKeys.includes(fullKey) && !disabledKeys.has(fullKey)) {
            events.push({
              title: `${slot.course} - ${slot.timeslot}：残り 5 枠`,
              start: date,
              allDay: true,
              extendedProps: {
                course: slot.course,
                timeslot: slot.timeslot,
                remaining: 5
              }
            });
          }
        });
      });
  
      res.json(events);
    });
  });
});  

app.post('/admin/enable-slot', (req, res) => {
  const { date, course, timeslot } = req.body;

  const sql = `
    DELETE FROM disabled_slots
    WHERE date = ? AND course = ? AND timeslot = ?
  `;
  db.run(sql, [date, course, timeslot], function(err) {
    if (err) {
      console.error('エラー:', err);
      return res.status(500).json({ error: '有効化に失敗しました' });
    } else {
      return res.json({ success: true });
    }
  });
});



app.get('/reserve', (req, res) => {
  const date = req.query.date;
  const user = req.session.user;  // ← セッションから user を取得
  if (!user) return res.redirect('/login');  // ログインしていない場合はログインへ
  res.render('reserve', { date, user });
});

app.post('/reserve', (req, res) => {
  const user = req.session.user;
  const { slot_id, note = '' } = req.body;

  if (!user) return res.status(403).send('ログインしてください');
  if (!slot_id) return res.status(400).send('スロットが未選択です');

  // 予約重複チェック
  const checkDuplicateSql = `
    SELECT 1 FROM reservations_v2 WHERE user_id = ? AND slot_id = ?
  `;
  db.get(checkDuplicateSql, [user.id, slot_id], (err, existing) => {
    if (err) return res.status(500).send('DBエラー（重複チェック）');
    if (existing) return res.send('このスロットはすでに予約済みです');

    // 定員チェックと登録処理
    const checkSql = `
      SELECT max_capacity,
             (SELECT COUNT(*) FROM reservations_v2 WHERE slot_id = ? AND status = 'reserved') AS reserved_count
      FROM lesson_slots
      WHERE id = ?
    `;

    db.get(checkSql, [slot_id, slot_id], (err, row) => {
      if (err) return res.status(500).send('DBエラー（定員チェック）');
      if (!row) return res.status(404).send('スロットが見つかりません');

      const status = row.reserved_count >= row.max_capacity ? 'waitlist' : 'reserved';

      const insertSql = `
        INSERT INTO reservations_v2 (user_id, slot_id, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      db.run(insertSql, [user.id, slot_id, status, note], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send('予約に失敗しました');
        }

        if (status === 'waitlist') {
          return res.send('定員に達していたため、キャンセル待ちとして登録されました');
        } else {
          return res.redirect('/thanks');
        }
      });
    });
  });
});


app.get("/api/coaches", (req, res) => {
  db.all("SELECT id, name, profile, image FROM coaches", (err, rows) => {
    if (err) return res.status(500).json({ error: "DBエラー" });
    res.json(rows);
  });
});

app.get("/api/courses", (req, res) => {
  const coachId = req.query.coach_id;
  if (!coachId) {
    return res.status(400).json({ error: "coach_id パラメータが必要です" });
  }

  const sql = `
    SELECT DISTINCT courses.id, courses.name, courses.description
    FROM courses
    JOIN lesson_slots ON lesson_slots.course_id = courses.id
    WHERE lesson_slots.coach_id = ?
  `;

  db.all(sql, [coachId], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "データベースエラー" });
    } else {
      res.json(rows);
    }
  });
});


app.get("/api/locations", (req, res) => {
  db.all("SELECT id, name, address FROM locations", [], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "データベースエラー" });
    } else {
      res.json(rows);
    }
  });
});

app.get("/api/lesson_slots", (req, res) => {
  const courseId = req.query.course_id;
  const locationId = req.query.location_id;

  if (!courseId || !locationId) {
    return res.status(400).json({ error: "course_id と location_id の両方が必要です" });
  }

  const sql = `
    SELECT id, date, timeslot, status, note
    FROM lesson_slots
    WHERE course_id = ? AND location_id = ?
    ORDER BY date, timeslot
  `;

  db.all(sql, [courseId, locationId], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "データベースエラー" });
    }
    res.json(rows);
  });
});


app.get("/api/reservations", (req, res) => {
  const slotId = req.query.slot_id;
  if (!slotId) {
    return res.status(400).json({ error: "slot_id パラメータが必要です" });
  }

  const sql = `
    SELECT status, COUNT(*) as count
    FROM reservations_v2
    WHERE slot_id = ?
    GROUP BY status
  `;

  db.all(sql, [slotId], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "データベースエラー" });
    }

    // 結果をオブジェクトに変換
    const result = {
      reserved: 0,
      canceled: 0,
      waitlist: 0
    };
    rows.forEach(row => {
      result[row.status] = row.count;
    });

    res.json(result);
  });
});

app.post("/api/reservations", (req, res) => {
  const { user_id, slot_id, status = 'reserved', notes = '' } = req.body;

  if (!user_id || !slot_id) {
    return res.status(400).json({ error: "user_id と slot_id は必須です" });
  }

  const sql = `
    INSERT INTO reservations_v2 (user_id, slot_id, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  db.run(sql, [user_id, slot_id, status, notes], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "予約登録に失敗しました" });
    }
  
    const reservationId = this.lastID;
  
    db.get(`SELECT email, lastName || ' ' || firstName AS name FROM users WHERE id = ?`, [user_id], (err, user) => {
      db.get(`
        SELECT ls.date, ls.timeslot, c.name AS coach_name, co.name AS course_name, l.name AS location_name
        FROM lesson_slots ls
        JOIN coaches c ON ls.coach_id = c.id
        JOIN courses co ON ls.course_id = co.id
        JOIN locations l ON ls.location_id = l.id
        WHERE ls.id = ?
      `, [slot_id], async (err2, slot) => {
        if (err2 || !user || !slot) {
          console.error(err2 || 'ユーザー or スロット情報取得失敗');
          return res.status(500).json({ error: "予約情報の取得に失敗しました" });
        }
  
        const userText = `
  ${user.name}様
  
  以下の内容で予約が完了しました。
  
  日時：${slot.date} ${slot.timeslot}
  コーチ：${slot.coach_name}
  コース：${slot.course_name}
  場所：${slot.location_name}
  
  このメールは自動送信です。
  `;
  
        const adminText = `
  新しい予約が入りました。
  
  予約者：${user.name}（${user.email}）
  日時：${slot.date} ${slot.timeslot}
  コース：${slot.course_name}
  場所：${slot.location_name}
  `;
  
        try {
          await sendMail(user.email, '【予約確認】レッスン予約完了のお知らせ', userText);
          await sendMail(process.env.ADMIN_EMAIL, '【通知】新しいレッスン予約', adminText);
          return res.json({ success: true, reservation_id: reservationId });
        } catch (e) {
          console.error("メール送信に失敗:", e);
          return res.status(500).json({ error: "予約は成功しましたが、メール送信に失敗しました" });
        }
      });
    });
  });
});
  
app.get("/api/available_dates", (req, res) => {
  const { coach_id, course_id, location_id } = req.query;
  console.log("coach_id:", coach_id, "course_id:", course_id, "location_id:", location_id);  // ←ここを追加
  const location = location_id; 
  if (!coach_id || !course_id || !location_id) {
    return res.status(400).json({ error: "coach_id, course_id, location_id は必須です" });
  }

  const sql = `
    SELECT ls.date
    FROM lesson_slots ls
    LEFT JOIN reservations_v2 r ON r.slot_id = ls.id AND r.status = 'reserved'
    WHERE ls.coach_id = ?
      AND ls.course_id = ?
      AND ls.location_id = ?
    GROUP BY ls.id
    HAVING ls.max_capacity > COUNT(r.id)
    ORDER BY ls.date ASC
    LIMIT 30
  `;

  db.all(sql, [coach_id, course_id, location_id], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "データベースエラー" });
    }
    console.log("SQL結果:", rows); // ←追加
    const dates = [...new Set(rows.map(row => row.date))]; // 重複除外
    console.log("抽出した日付リスト:", dates); // ←追加

    res.json(dates);
  });
});




app.get('/thanks', (req, res) => {
  res.render('thanks'); // views/thanks.ejs が必要
});

// 管理者予約確認（accordion UI 対応）
app.get('/admin/reservations', (req, res) => {
  const user = req.session.user;
  if (!user || user.is_admin !== 1) {
    return res.status(403).send('アクセス拒否');
  }

  const sql = `
    SELECT r.id, u.lastName || ' ' || u.firstName AS name, u.email,
           ls.date, ls.timeslot, ls.note, ls.status,
           c.name AS course_name, l.name AS location_name, co.name AS coach_name
    FROM reservations_v2 r
    JOIN users u ON r.user_id = u.id
    JOIN lesson_slots ls ON r.slot_id = ls.id
    LEFT JOIN courses c ON ls.course_id = c.id
    LEFT JOIN locations l ON ls.location_id = l.id
    LEFT JOIN coaches co ON ls.coach_id = co.id
    ORDER BY ls.date ASC, ls.timeslot ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('予約取得エラー:', err);
      return res.status(500).send('データベースエラー');
    }
    res.render('admin/reservations', { reservations: rows });
  });
});


app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
