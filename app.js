const express = require('express');
const app = express();
const { Pool } = require('pg');
const session = require('express-session');

// we need session for storing login information
app.use(session(
{
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));

// we use ejs to render views
app.set('view engine', 'ejs');

// this parses incoming request bodies (for form data)
app.use(express.urlencoded({ extended: true }));

// serve static files from "public" folder
app.use(express.static('public'));

// connect to PostgreSQL database
const pool = new Pool(
{
    user: 'postgres',
    host: 'localhost',
    database: 'BlogDB',
    password: 'Munchie4478!',
    port: 5432,
});

// this checks if user is logged in or not
function isAuthenticated(req, res, next) 
{
    if (req.session.user_id) 
    {
        return next();
    }
    res.redirect('/signin');
}

// route for homepage, show all posts
app.get('/', async (req, res) => 
{
    try 
    {
        const result = await pool.query('SELECT * FROM blogs ORDER BY date_created DESC');
        res.render('index', { posts: result.rows, user_id: req.session.user_id });
    } 
    catch (err) 
    {
        console.error('Error fetching posts from database:', err.stack);
        res.send('Error fetching posts from database.');
    }
});

// handle post creation, need to be logged in
app.post('/', isAuthenticated, async (req, res) => 
{
    const { title, message } = req.body;
    const user_id = req.session.user_id;

    if (!title || !message || !user_id) 
    {
        return res.send('All fields are required!');
    }

    try 
    {
        const user = await pool.query('SELECT name FROM users WHERE user_id = $1', [user_id]);
        await pool.query(
            'INSERT INTO blogs (title, body, creator_name, creator_user_id, date_created) VALUES ($1, $2, $3, $4, NOW())',
            [title, message, user.rows[0].name, user_id]
        );
        res.redirect('/');
    } 
    catch (err) 
    {
        console.error('Error creating a new blog post:', err.stack);
        res.send('Error creating a new blog post.');
    }
});

// render the sign up page
app.get('/signup', (req, res) => 
{
    res.render('signup');
});

// handle sign-up form submission
app.post('/signup', async (req, res) => 
{
    const { user_id, name, password } = req.body;

    if (!user_id || !name || !password) 
    {
        return res.send('All fields are required for signup!');
    }

    try 
    {
        const userCheck = await pool.query('SELECT * FROM users WHERE user_id = $1', [user_id]);

        if (userCheck.rows.length > 0) 
        {
            res.send('User ID already taken. Please choose a different one.');
        } 
        else 
        {
            await pool.query(
                'INSERT INTO users (user_id, name, password) VALUES ($1, $2, $3)',
                [user_id, name, password]
            );
            res.redirect('/signin');
        }
    } 
    catch (err) 
    {
        console.error('Error during sign-up:', err.stack);
        res.send('Error during sign-up.');
    }
});

// render the sign in page
app.get('/signin', (req, res) => 
{
    res.render('signin');
});

// handle sign-in form submission
app.post('/signin', async (req, res) => 
{
    const { user_id, password } = req.body;

    if (!user_id || !password) 
    {
        return res.send('User ID and password are required to sign in!');
    }

    try 
    {
        const userCheck = await pool.query(
            'SELECT * FROM users WHERE user_id = $1 AND password = $2',
            [user_id, password]
        );

        if (userCheck.rows.length > 0) 
        {
            req.session.user_id = user_id;
            res.redirect('/');
        } 
        else 
        {
            res.send('Incorrect user ID or password.');
        }
    } 
    catch (err) 
    {
        console.error('Error during sign-in:', err.stack);
        res.send('Error during sign-in.');
    }
});

// render edit page for specific post
app.get('/edit/:id', isAuthenticated, async (req, res) => 
{
    const postId = req.params.id;
    const user_id = req.session.user_id;

    try 
    {
        const post = await pool.query('SELECT * FROM blogs WHERE blog_id = $1 AND creator_user_id = $2', [postId, user_id]);

        if (post.rows.length === 0) 
        {
            return res.send('Post not found or you are not authorized to edit this post.');
        }

        res.render('edit', { post: post.rows[0], postId: postId });
    } 
    catch (err) 
    {
        console.error('Error fetching post for edit:', err.stack);
        res.send('Error fetching post for edit.');
    }
});

// handle the post update after editing
app.post('/edit/:id', isAuthenticated, async (req, res) => 
{
    const postId = req.params.id;
    const { title, message } = req.body;
    const user_id = req.session.user_id;

    if (!title || !message) 
    {
        return res.send('All fields are required for editing!');
    }

    try 
    {
        await pool.query(
            'UPDATE blogs SET title = $1, body = $2 WHERE blog_id = $3 AND creator_user_id = $4',
            [title, message, postId, user_id]
        );
        res.redirect('/');
    } 
    catch (err) 
    {
        console.error('Error updating post:', err.stack);
        res.send('Error updating post.');
    }
});

// handle post deletion
app.post('/delete/:id', isAuthenticated, async (req, res) => 
{
    const postId = req.params.id;
    const user_id = req.session.user_id;

    try 
    {
        await pool.query('DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2', [postId, user_id]);
        res.redirect('/');
    } 
    catch (err) 
    {
        console.error('Error deleting post:', err.stack);
        res.send('Error deleting post.');
    }
});

// handle logout, destroy session
app.get('/logout', (req, res) => 
{
    req.session.destroy();
    res.redirect('/');
});

// start the server on port 3000
app.listen(3000, () => 
{
    console.log('Server started on http://localhost:3000');
});
