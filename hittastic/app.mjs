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
         // TODO replace with secure version using placeholders
        const stmt = db.prepare(`SELECT * FROM ht_users WHERE password='${req.body.password}' AND username='${req.body.username}'`);
        const results = stmt.all();

        if(results.length > 0) {
            req.session.username = results[0].username;
            msg = `Logged in as ${results[0].username}. Your credit card is ${results[0].creditcard}, please spend away... <a href='logout'>Log out</a>`;
        } else {
            msg = "Invalid login";
        }
    } catch(e) {
        msg = `Internal error: ${e}`;
    }
    res.render('main', { msg: msg } );
});

app.use((req, res, next) => {
    req.loginMsg = req.session && req.session.username ? `Logged in as ${req.session.username}. <a href='logout'>Logout</a>` : "Not logged in. <a href='login.html'>Login</a>";
    next();
});

app.get('/', (req, res) => {
    res.render('main', { msg: req.loginMsg } );
});

app.get(['/search','/artist/:artist'], (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM wadsongs WHERE artist=?');
        const results = stmt.all(req.params.artist || req.query.artist);
        res.render('main', { results: results, msg: req.loginMsg } );
    } catch(e) {
        res.status(500).json({error: e});
    }
});

app.post('/buy', (req, res) => {
    res.render('main', { msg : `${req.loginMsg}<br />You are buying the song with ID ${req.body.id}`});
});


app.all('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

app.listen(3000);
