const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const axios = require('axios');
const cors = require('cors');
const User = require('./models/user'); // Adjust the path as needed

const app = express();
const TMDB_API_KEY = '7291f8044be5ad65999db4f9de941375';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/authdb', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'abcdefgh',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.set('view engine', 'ejs');
app.set('views', './views');

// Error Handler
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message });
}

// Home Route
app.get('/', (req, res) => {
  if (req.session.isLoggedIn) {
    res.render('Home', {
      query: req.query.query || '',
      genre: req.query.genre || '',
      year: req.query.year || '',
      includeAdult: req.query.includeAdult || '',
      language: req.query.language || '',
      region: req.query.region || ''
    });
  } else {
    res.render('Authentication');
  }
});

// Search API
app.get('/getMovies', async (req, res, next) => {
  const { query, genre, year, includeAdult, language, region } = req.query;

  try {
    const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
      params: {
        api_key: TMDB_API_KEY,
        query,
        with_genres: genre,
        year,
        include_adult: includeAdult === 'yes',
        language,
        region
      }
    });

    const movies = response.data.results.map(movie => ({
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null
    }));

    res.render('MovieList' , {movies});
  } catch (err) {
    next(err);
  }
});

// Movie Details API
app.get('/movie/:movieId', async (req, res, next) => {
  const { movieId } = req.params;

  try {
    const response = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
      params: {
        api_key: TMDB_API_KEY,
        append_to_response: 'credits,reviews'
      }
    });

    const movieData = response.data;
    const movieDetails = {
      title: movieData.title,
      overview: movieData.overview,
      release_date: movieData.release_date,
      runtime: `${movieData.runtime} minutes`,
      genres: movieData.genres.map(genre => genre.name).join(', '),
      budget: movieData.budget,
      revenue: movieData.revenue,
      poster_url: movieData.poster_path ? `${TMDB_IMAGE_BASE_URL}${movieData.poster_path}` : null,
      mainCast: movieData.credits.cast.map(({ name, character, profile_path }) => ({
        name,
        character,
        profileImageUrl: profile_path ? `${TMDB_IMAGE_BASE_URL}${profile_path}` : null
      })),
      mainCrew: movieData.credits.crew.map(({ name, job }) => ({ name, job })),
      reviews: movieData.reviews.results
    };

    console.log(movieDetails);
    res.render('MovieDetails', { movieDetails });
  } catch (err) {
    next(err);
  }
});


// Authentication Routes
app.post('/signin', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword
    });

    await newUser.save();
    req.session.isLoggedIn = true;
    req.session.user = { firstName, lastName, email };
    res.redirect('/');
  } catch (err) {
    res.send({ error: 'Error creating user. Please try again.' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.isLoggedIn = true;
      req.session.user = { firstName: user.firstName, lastName: user.lastName, email: user.email };
      res.redirect('/');
    } else {
      res.render('Authentication', { error: 'Invalid email or password' });
    }
  } catch (err) {
    res.render('Authentication', { error: 'Error logging in. Please try again.' });
  }
});

// Error Handling Middleware
app.use(errorHandler);

// Start the Server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));

module.exports = app;
