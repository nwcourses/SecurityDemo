import express from 'express';
import Database from 'better-sqlite3';
import expressSession from 'express-session';
import betterSqlite3Session from 'express-session-better-sqlite3';
import db from './db.mjs';

const app = express();

// TODO fix to protect against XSS


// Create sqlite database to store sessions 
const sessDb = new Database('session.db');

// create on object for creating the session store
// SqliteStore is similar in concept to a class
const SqliteStore = betterSqlite3Session(expressSession, sessDb);

app.use(expressSession({
    store: new SqliteStore(), 
    secret: 'BinnieAndClyde', 
    resave: true, 
    saveUninitialized: false, 
    rolling: true, 
    unset: 'destroy', 
    proxy: true, 
    cookie: { 
        maxAge: 600000, // 600000 ms = 10 mins expiry time
        httpOnly: false // allow client-side code to access the cookie, otherwise it's kept to the HTTP messages
    }
}));

app.use(express.static('public'));
app.use(express.urlencoded({extended: false}));

app.set('view engine' , 'ejs');


app.post('/login', (req, res) => {
    let msg = "";
    try {
        // TODO 1. replace with secure version using placeholders
        // TODO 2. change to use passwords encrypted with bcrypt
        const stmt = db.prepare(`SELECT * FROM ht_users WHERE password='${req.body.password}' AND username='${req.body.username}'`);
        const results = stmt.all();

        if(results.length > 0) {
            req.session.username = results[0].username;
            res.redirect('/');
            return;
        } else {
            msg = "Invalid login";
        }
    } catch(e) {
        msg = `Internal error: ${e}`;
    }
    res.render('main', { msg: msg, username: req.session.username } );
});

app.post('/signup', (req, res) => {
    let msg = "";
    try {
        // TODO 1. replace with secure version using placeholders
        // TODO 2. change to use passwords encrypted with bcrypt
        const stmt = db.prepare(`INSERT INTO ht_users (username, password, balance, creditcard) VALUES ('${req.body.username}', '${req.body.password}', 100.0, '1234567890123456')`);
        const info = stmt.run();
        msg = `Signed up with ID ${info.lastInsertRowid}`;
    } catch(e) {
        msg = `Internal error: ${e}`;
    }
    res.render('main', { msg: msg });    
});


// Middleware to add login message to all requests
app.use((req, res, next) => {
    if(req.session.username) {
        const stmt = db.prepare('SELECT * FROM ht_users WHERE username=?');
        const row = stmt.get(req.session.username);
        req.userStatus = `Your credit card is ${row.creditcard} and your balance is ${row.balance.toFixed(2)}, please spend away...`;
    } 
    next();
});


app.use('/buy', (req, res, next) => {
    console.log('buy middleware');
    if(req.session.username) {
        next();
    } else {
        res.render('main', { msg: 'Cannot buy song as you are not logged in' } );
    }
});

app.get('/', (req, res) => {
    res.render('main', { msg: req.userStatus, username: req.session.username } );
});

app.get(['/search','/artist/:artist'], (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM wadsongs WHERE artist=?');
        const results = stmt.all(req.params.artist || req.query.artist);
        res.render('main', { results: results, msg: req.userStatus, username: req.session.username } );
    } catch(e) {
        res.render('main', {  msg: e.message, username: req.session.username } );
    }
});

app.post('/buy', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM wadsongs WHERE id=?');
        const result = stmt.get(req.body.id);
        if(result) {
            const stmt2 = db.prepare('UPDATE wadsongs SET quantity=quantity+1 WHERE id=?');
            stmt2.run(req.body.id);
            const stmt3 = db.prepare('UPDATE ht_users SET balance=balance-? WHERE username=?');
            stmt3.run(result.price, req.session.username);
        }
        res.render('main', { msg : `${req.userStatus}<br />You are buying the song with ID ${req.body.id}`, username: req.session.username});
    } catch(e) {    
        res.render('main', {  msg: e.message, username: req.session.username } );
    } 
});

app.post('/song/new', (req, res) => {
    try {
        const stmt = db.prepare("INSERT INTO wadsongs(title, artist, year) VALUES (?,?,?)");
        const info = stmt.run(req.body.title, req.body.artist, req.body.year);
        res.render('main', { msg : `Song added with ID ${info.lastInsertRowid}`, username: req.session.username});
    } catch(e) {    
        res.render('main', {  msg: e.message, username: req.session.username } );
    } 
});

app.post('/setcookie', (req, res) => {
    res.set('Set-Cookie', req.body.cookie);
    res.send(`Cookie set: ${req.body.cookie}`);
});

app.all('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

app.listen(3000);
