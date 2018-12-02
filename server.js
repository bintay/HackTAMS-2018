// Set up the databse
const mongoose = require('mongoose');

const User = require('./models/User.js');
const Club = require('./models/Club.js');

mongoose.connect('mongodb://localhost:27017/tamsclub');

// Set up express
const express = require('express');
const app = express();
const port = process.argv[2] || 17142;
app.set('view engine', 'pug');

// Other libs
const path = require('path');
const bcrypt = require('bcrypt-nodejs');
const bodyParser = require('body-parser');
const session = require('express-session');
const helmet = require('helmet');

// csurf
const csurf = require('csurf');
csrfProtection = csurf();

// ***
// Middleware
// ***

// profile picture uploads
var multer = require('multer');

var uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './public/profile-pictures');
    },
    filename: function (req, file, cb) {
      var fileExtentions = {
        'image/jpeg': 'jpeg',
        'image/png': 'png'
      };
      cb(null, file.fieldname + '-' + Date.now() + '-' + Math.floor(Math.random() * 100000) + '.' + fileExtentions[file.mimetype]);
    }
  }),
  fileFilter: (req, file, cb) => {
    req.hadFile = true;
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});
app.use(uploadAvatar.single('avatar'));

var Jimp = require('jimp');

// Set up automatic SCSS compiler
const sassMiddleware = require('node-sass-middleware')
app.use(sassMiddleware({
   src: path.join(__dirname, 'scss'),
   dest: path.join(__dirname, 'public/css'),
   debug: true,
   outputStyle: 'compressed',
   prefix: '/css'
}));

// Public files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Sessions
app.use(session({
   name: 'server-session-cookie-id',
   secret: 'angel fish sunshine shooting star',
   saveUninitialized: false,
   resave: false,
   cookie: {
      maxAge: 3600000 * 24 * 7 * 2 // 2 weeks
   }
}));

// Helmet
app.use(helmet());

// Get user data
app.use(function (req, res, next) {
   if (req.session.userid) {
      User.find({ _id: req.session.userid }, function (err, users) {
         var user = users[0];
         user.password = null;
         delete user.password;
         req.user = user;
         next();
      });
   } else {
      next();
   }
});

// ***
// Get Requests
// ***

// Homepage
app.get('/', function (req, res) {
   if (req.session.userid) {
      res.redirect('/feed/')
      //res.render('home', { title: 'Home', user: req.user });
   } else {
      res.render('index', { title: 'Home' });
   }
});

// User pages
app.get('/user/:profile', redirectIfLoggedOut, function (req, res) {
   User.find({ username: req.params.profile }, function (err, users) {
      if (err) {
         console.log(err);
      }
      var user = users[0];
      if (user == null) {
         res.render('status', { title: 'Oops!', text: 'User ' + req.params.profile + ' not found.', user: req.user });
      } else {
         user.password = null;
         delete user.password;
         res.render('profile', { title: req.params.profile + 's Profile', profile: user, user: req.user });
      }
   });
});

// Club page
app.get('/club/:club', redirectIfLoggedOut, function (req, res) {
   Club.find({ name: req.params.club }, function (err, clubs) {
      if (err) {
         console.log(err);
      }

      var club = clubs[0];

      if (club == null) {
            res.render('status', { title: 'Oops!', text: 'No club with name "' + req.params.club + '" found.', user: req.user, backURL: '/clubs/', backText: 'Back to clubs page' });
      } else {
         var owns = req.user.clubsOwned && req.user.clubsOwned.indexOf(club._id) != -1;
         var hasJoined = req.user.clubsFollowed && req.user.clubsFollowed.indexOf(club._id) != -1 || owns;

         club.events = club.events.reverse();

         res.render('club', { title: club.name, user: req.user, club: club, hasJoined: hasJoined, owns: owns });
      }
   });
});

app.get('/new/post/:club', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ name: req.params.club }, function (err, club) {
      if (!club) {
         res.render('status', { title: 'Oops!', text: 'No club with name "' + req.params.club + '" found.', user: req.user, backURL: '/clubs/', backText: 'Back to clubs page' });
      } else if (req.user.clubsOwned.indexOf(club._id) == -1) {
         res.render('status', { title: 'Oops!', text: 'You don\'t own this club!', user: req.user, backURL: '/clubs/', backText: 'Back to clubs page' });
      } else {
         res.render('post', { title: 'Post', user: req.user, club: club });
      }
   });
});

// Login page
app.get('/login/', redirectIfLoggedIn, csrfProtection, function (req, res) {
   res.render('login', { title: 'Login', csrfToken: req.csrfToken() });
});

// Sign up page
app.get('/signup/', redirectIfLoggedIn, csrfProtection, function (req, res) {
   res.render('signup', { title: 'Sign Up', csrfToken: req.csrfToken() });
});

// Club list page
app.get('/clubs/', redirectIfLoggedOut, function (req, res) {
   Club.find({ _id: { $in: req.user.clubsOwned } }, function (err, clubsOwned) {
      if (err) {
         console.log(err);
      }

      Club.find({ _id: { $in: req.user.clubsFollowed } }, function (err, clubsFollowed) {
         if (err) {
            console.log(err);
         }

         res.render('clubs', { title: 'Club List', user: req.user, clubsOwned: clubsOwned, clubsFollowed: clubsFollowed });
      });
   });
});

// Search
app.get('/search/', function (req, res) {
   res.redirect('/clubs/');
});

// Logout
app.get('/logout/', redirectIfLoggedOut, function (req, res) {
   if (req.session) {
      req.session.destroy(function (err) {
         if (err) {
            console.log(err);
         }
         res.redirect('/');
      });
   } else {
      res.redirect('/');
   }
});

// Settings
app.get('/settings/', redirectIfLoggedOut, csrfProtection, function (req, res) {
   res.render('settings', { title: 'Settings', csrfToken: req.csrfToken(), user: req.user });
});

// Settings
app.get('/add/', redirectIfLoggedOut, csrfProtection, function (req, res) {
   console.log(req.query);
   res.render('add', { title: 'New Club', csrfToken: req.csrfToken(), user: req.user, clubName: req.query.clubName });
});

app.get('/feed/', redirectIfLoggedOut, function (req, res) {
   Club.find({ _id: { $in: req.user.clubsOwned } }, function (err, clubsOwned) {
      if (err) {
         console.log(err);
      }

      Club.find({ _id: { $in: req.user.clubsFollowed } }, function (err, clubsFollowed) {
         if (err) {
            console.log(err);
         }

         var posts = [];
         for (var club of clubsOwned) {
            for (var event of club.events) {
               event.club = club.name;
               posts.push(event);
            }
         }

         for (var club of clubsFollowed) {
            for (var event of club.events) {
               event.club = club.name;
               posts.push(event);
            }
         }

         posts = posts.sort((a, b) => b.posted - a.posted);

         res.render('feed', { title: 'Feed', user: req.user, posts: posts });
      });
   });
   
});

app.get('/confirm-hours/:club/:eventid', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ name: req.params.club }, function (err, club) {
      if (err) {
         console.log(err);
      }

      if (!club) {
         res.render('status', { title: 'Oops!', text: 'Club not found.', user: req.user, backURL: '/feed/', backText: 'Back to feed' });
      } else if (req.user.clubsOwned.indexOf(club._id) == -1) {
         res.render('status', { title: 'Oops!', text: 'You don\'t own this club.', user: req.user, backURL: '/club/' + club.name + '/', backText: 'Back to club page' });
      } else {
         var event;
         for (var i in club.events) {
            if (club.events[i]._id == req.params.eventid) {
               event = club.events[i];
            }
         }
         if (!event) {
            res.render('status', { title: 'Oops!', text: 'Volunteering not found.', user: req.user, backURL: '/club/' + club.name, backText: 'Back to club page' });
         } else {
            User.find({_id: { $in: event.signedUp }}, function (err, users) {
               var idToUser = {};
               var hasHours = {};
               for (var user of users) {
                  user.password = null;
                  delete user.password;
                  idToUser[user._id] = user;
                  console.log(user);
                  hasHours[user._id] = user.volunteering.filter(v => v.eventId == req.params.eventid)[0].recieved;
               }
               console.log(idToUser);
               res.render('hours', { title: 'Confirm Hours', user: req.user, event: event, idToUser: idToUser, club: club, hasHours: hasHours });
            });
         }
      }
   });
});

app.get('/edit-post/:club/:eventid', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ name: req.params.club }, function (err, club) {
      if (err) {
         console.log(err);
      }

      if (!club) {
         res.render('status', { title: 'Oops!', text: 'Club not found.', user: req.user, backURL: '/feed/', backText: 'Back to feed' });
      } else if (req.user.clubsOwned.indexOf(club._id) == -1) {
         res.render('status', { title: 'Oops!', text: 'You don\'t own this club.', user: req.user, backURL: '/club/' + club.name + '/', backText: 'Back to club page' });
      } else {
         var event;
         for (var i in club.events) {
            if (club.events[i]._id == req.params.eventid) {
               event = club.events[i];
            }
         }
         if (!event) {
            res.render('status', { title: 'Oops!', text: 'Event not found.', user: req.user, backURL: '/club/' + club.name, backText: 'Back to club page' });
         } else {
            res.render('editpost', { title: 'Edit', user: req.user, club: club, event: event });
         }
      }
   });
});

app.get('/calendar/', redirectIfLoggedOut, function (req, res) {
   Club.find({ _id: { $in: req.user.clubsOwned } }, function (err, clubsOwned) {
      if (err) {
         console.log(err);
      }

      Club.find({ _id: { $in: req.user.clubsFollowed } }, function (err, clubsFollowed) {
         if (err) {
            console.log(err);
         }

         var posts = [];
         for (var club of clubsOwned) {
            for (var event of club.events) {
               event.club = club.name;
               posts.push(event);
            }
         }

         for (var club of clubsFollowed) {
            for (var event of club.events) {
               event.club = club.name;
               posts.push(event);
            }
         }

         posts = posts.sort((a, b) => b.posted - a.posted);

         var currentDate = new Date();
         var lastSunday = currentDate - (currentDate.getMilliseconds() + 1000 * (currentDate.getSeconds() + 60 * (currentDate.getMinutes() + 60 * (currentDate.getHours() + 24 * (currentDate.getDay())))));

         var week = [];
         for (var i = 0; i < 7; ++i) {
            week.push([]);
         }

         for (var i = 0; i < posts.length; ++i) {
            if (posts[i].start > lastSunday + 1000 * 60 * 60 * 24 * 7 || posts[i].start < lastSunday) continue;
            if (posts[i].hours > 0 && posts[i].signedUp.indexOf(req.user._id) == -1) continue;
            week[posts[i].start.getDay()].push(posts[i]);
         }

         res.render('calendar', { title: 'Calendar', user: req.user, daysOfTheWeek: ['Sun.', 'Mon.', 'Tues.', 'Wed.', 'Thur.', 'Fri.', 'Sat.'], week: week });
      });
   });
});

app.get('/view-signins/:club/:eventid', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ name: req.params.club }, function (err, club) {
      if (err) {
         console.log(err);
      }

      if (!club) {
         res.render('status', { title: 'Oops!', text: 'Club not found.', user: req.user, backURL: '/feed/', backText: 'Back to feed' });
      } else if (req.user.clubsOwned.indexOf(club._id) == -1) {
         res.render('status', { title: 'Oops!', text: 'You don\'t own this club.', user: req.user, backURL: '/club/' + club.name + '/', backText: 'Back to club page' });
      } else {
         var event;
         for (var i in club.events) {
            if (club.events[i]._id == req.params.eventid) {
               event = club.events[i];
            }
         }
         if (!event) {
            res.render('status', { title: 'Oops!', text: 'Event not found.', user: req.user, backURL: '/club/' + club.name, backText: 'Back to club page' });
         } else {
            var code = event.signInCode;
            
            User.find({ _id: { $in: event.signedUp }}, function (err, users) {
               for (var i in users) {
                  users[i].password = null;
                  delete users[i].password;
               }
               res.render('signins', { title: 'Sign Ins', user: req.user, code: code, club: club, event: event, people: users });
            });
         }
      }
   });
});

app.get('/signin/', redirectIfLoggedOut, function (req, res) {
   res.render('signin', { title: 'Sign In', user: req.user });
});

// ***
// Post Requests
// ***

// login
app.post('/login/', redirectIfLoggedIn, csrfProtection, function (req, res) {
   User.find({ 'username': req.body.username }, function (err, users) {
      if (err) {
         console.log(err);
      }
      
      var user = users[0];

      if (user == null) {
         res.render('login', { title: 'Login', errors: ['Incorrect username.'], csrfToken: req.csrfToken() })
      } else {
         bcrypt.compare(req.body.password, user.password, function (err, match) {
            if (err) {
               console.log(err);
            }
            if (match) {
               req.session.userid = user._id;
               res.redirect('/');
            } else {
               res.render('login', { title: 'Login', errors: ['Incorrect password.'], csrfToken: req.csrfToken() });
            }
         });
      }
   });
});

// sign up
app.post('/signup/', redirectIfLoggedIn, csrfProtection, function (req, res) {
   var signupErrors = [];

   if (!validateEmail(req.body.email)) {
      signupErrors.push('Email invalid.');
   }

   if (!validateUsername(req.body.username)) {
      signupErrors.push('Username invalid: please use only letters, numbers, underscores, and periods.');
   }

   if (req.body.username.length > 20) {
      signupErrors.push('Username invalid: please limit yourself to 15 characters.');
   }

   if (req.body.password.length < 8) {
      signupErrors.push('Password too short: please use at least 8 characters.');
   }

   User.find({ 'username': req.body.username }, function (err, users1) {
      if (err) {
         console.log(err);
      }

      if (users1.length != 0) {
         signupErrors.push('That username is already taken.');
      }

      User.find({ 'email': req.body.email }, function (err, users2) {
         if (err) {
            console.log(err);
         }

         if (users2.length != 0) {
            signupErrors.push('That email is already in use.');
         }

         if (signupErrors.length > 0) {
            res.render('signup', { title: 'Sign Up', errors: signupErrors, csrfToken: req.csrfToken() });
         } else {
            bcrypt.hash(req.body.password, null, null, function (err, hash) {
               User.create({ username: req.body.username, password: hash, email: req.body.email, clubsOwned: [], clubsFollowed: [], name: req.body.name }, function (err, user) {
                  if (err) {
                     console.log(err);
                  }

                  req.session.userid = user._id;
                  res.redirect('/');
               });
            });
         }
      });
   });
});

app.post('/settings/', redirectIfLoggedOut, csrfProtection, function (req, res) {
   var update = {};
   var signupErrors = [];

   console.log(req.body);

   if (req.user.username != req.body.username) {
      var usernameOk = true;
      if (!validateUsername(req.body.username)) {
         signupErrors.push('Username invalid: please use only letters, numbers, underscores, and periods.');
         usernameOk = false;
      }

      if (req.body.username.length > 20) {
         signupErrors.push('Username invalid: please limit yourself to 15 characters.');
         usernameOk = false;
      }

      if (usernameOk) {
         update.username = req.body.username;
      }
   }

   if (req.user.name != req.body.name) {
      update.name = req.body.name;
   }

   if (req.user.email != req.body.email) {
      if (!validateEmail(req.body.email)) {
         signupErrors.push('Email invalid.');
      } else {
         update.email = req.body.email;
      }
   }

   if (req.body.password.length != 0) {
      if (req.body.password.length < 8) {
         signupErrors.push('Password too short: please use at least 8 characters.');
      } else {
         update.password = true;
      }
   }

   if (req.body.bio != req.user.bio) {
      if (req.body.bio.length > 1000) {
         signupErrors.push('Invalid bio: please limit yourself to 1000 characters');
      } else {
         update.bio = req.body.bio;
      }
   }

   User.find({ 'username': req.body.username }, function (err, users1) {
      if (err) {
         console.log(err);
      }

      if (users1.length != 0 && update.username) {
         signupErrors.push('That username is already taken.');
         delete update.username;
      }

      User.find({ 'email': req.body.email }, function (err, users2) {
         if (err) {
            console.log(err);
         }

         if (users2.length != 0 && update.email) {
            signupErrors.push('That email is already in use.');
            delete update.email;
         }

         if (update.password) {
            bcrypt.hash(req.body.password, null, null, function (err, hash) {
               if (err) {
                  console.log(err);
               }

               update.password = hash;

               if (req.file) {
                  Jimp.read(req.file.path, function (err, image) {
                     image.resize(200, 200).quality(80).write(req.file.path);

                     var path = req.file.path.split('/');
                     update.picture = path[path.length - 1];

                     User.update({ _id: req.user._id }, update, function (err, raw) {
                        if (err) {
                           console.log(err);
                        }
                        if (update.username) {
                           req.user.username = update.username;
                        }
                        if (update.email) {
                           req.user.email = update.email;
                        }
                        if (update.bio) {
                           req.user.bio = update.bio;
                        }
                        if (update.name) {
                           req.user.name = update.name;
                        }
                        req.user.picture = update.picture;

                        res.render('settings', { title: 'Settings', errors: signupErrors, user: req.user, csrfToken: req.csrfToken() });
                     });
                  });
               } else {
                  User.update({ _id: req.user._id }, update, function (err, raw) {
                     if (err) {
                        console.log(err);
                     }
                     if (update.username) {
                        req.user.username = update.username;
                     }
                     if (update.email) {
                        req.user.email = update.email;
                     }
                     if (update.bio) {
                        req.user.bio = update.bio;
                     }
                     if (update.name) {
                        req.user.name = update.name;
                     }

                     res.render('settings', { title: 'Settings', errors: signupErrors, user: req.user, csrfToken: req.csrfToken() });
                  });
               }
            });
         } else {
            if (req.file) {
               Jimp.read(req.file.path, function (err, image) {
                  image.resize(200, 200).quality(80).write(req.file.path);
                  var path = req.file.path.split('/');
                  update.picture = path[path.length - 1];

                  User.update({ _id: req.user._id }, update, function (err, raw) {
                     if (err) {
                        console.log(err);
                     }
                     if (update.username) {
                        req.user.username = update.username;
                     }
                     if (update.email) {
                        req.user.email = update.email;
                     }
                     if (update.bio) {
                        req.user.bio = update.bio;
                     }
                     if (update.name) {
                        req.user.name = update.name;
                     }
                     req.user.picture = update.picture;
                     res.render('settings', { title: 'Settings', errors: signupErrors, user: req.user, csrfToken: req.csrfToken() });
                  });
               });
            } else {
               User.update({ _id: req.user._id }, update, function (err, raw) {
                  if (err) {
                     console.log(err);
                  }
                  if (update.username) {
                     req.user.username = update.username;
                  }
                  if (update.email) {
                     req.user.email = update.email;
                  }
                  if (update.bio) {
                     req.user.bio = update.bio;
                  }
                  if (update.name) {
                     req.user.name = update.name;
                  }
                  res.render('settings', { title: 'Settings', errors: signupErrors, user: req.user, csrfToken: req.csrfToken() });
               });
            }
         }
      });
   });
});

app.post('/add/', redirectIfLoggedOut, csrfProtection, function (req, res) {
   Club.create({ name: req.body.clubName, description: req.body.description }, function (err, club) {
      if (err) {
         console.log(err);
      }

      User.findByIdAndUpdate(req.user._id, {$push: { "clubsOwned": club._id }}, function (err, user) {
         if (err) {
            console.log(err);
         }

         res.redirect('/club/' + club.name);
      });
   });
});

app.post('/search/', redirectIfLoggedOut, function (req, res) {
   Club.find({ $or: [{name: { $regex: new RegExp(req.body.clubName.replace(/[\[\]\*\.\?\(\)\^\$\\]/g, '\\$&')), $options: 'i' } }, {description: { $regex: new RegExp(req.body.clubName.replace(/[\[\]\*\.\?\(\)\^\$\\]/g, '\\$&')), $options: 'i' } } ] }, function (err, clubs) {
      if (err) {
         console.log(err);
      }

      res.render('clubs', { title: 'Search results', user: req.user, clubsFound: clubs });
   });
});

app.post('/join/:name', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ name: req.params.name }, function (err, club) {
      User.findByIdAndUpdate(req.user._id, {$push: { "clubsFollowed": club._id }}, function (err, user) {
         if (err) {
            console.log(err);
         }
 
         res.redirect('/club/' + club.name);
      });
   });
});

app.post('/unjoin/:name', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ name: req.params.name }, function (err, club) {
      User.findByIdAndUpdate(req.user._id, {$pull: { "clubsFollowed": club._id }}, function (err, user) {
         if (err) {
            console.log(err);
         }
 
         res.redirect('/club/' + club.name);
      });
   });
});

app.post('/new/post/:club', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ name: req.params.club }, function (err, club) {
      if (!club) {
         res.render('status', { title: 'Oops!', text: 'Club not found.', user: req.user, backURL: '/clubs/', backText: 'Back to clubs page' });
      } else if (req.user.clubsOwned.indexOf(club._id) == -1) {
         res.render('status', { title: 'Oops!', text: 'You don\'t own this club!.', user: req.user, backURL: '/club/' + club.name + '/', backText: 'Back to club page' });
      } else {
         var startDate = null, endDate = null;
         if (req.body.hastime == 'on') {
            startDate = new Date(Date.parse(req.body.startdate + ' ' + req.body.starttime));
            endDate = new Date(Date.parse(req.body.enddate + ' ' + req.body.endtime));
         }
         Club.findByIdAndUpdate(club._id, { $push: { "events": { start: startDate, end: endDate, posted: new Date() - 6 * 60 * 60 * 1000, title: req.body.title, content: req.body.content, hours: (req.body.hasvolunteer ? req.body.hours : 0), maxPeople: req.body.people, signedUp: [] } } }, function (err, club) {
            if (err) {
               console.log(err);
            }

            res.redirect('/club/' + club.name);
         });
      }
   });
});

app.post('/volunteer/:club/:eventid', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ name: req.params.club }, function (err, club) {
      if (!club) {
         res.render('status', { title: 'Oops!', text: 'Club not found.', user: req.user, backURL: '/feed/', backText: 'Back to feed' });
      } else {
         var event;
         var index = -1;
         for (var i in club.events) {
            if (club.events[i]._id == req.params.eventid) {
               event = club.events[i];
               index = i;
            }
         }
         if (!event || index == -1) {
            res.render('status', { title: 'Oops!', text: 'Volunteering not found.', user: req.user, backURL: '/club/' + club.name, backText: 'Back to club page' });
         } else if (event.signedUp.indexOf(req.user._id) != -1) {
            res.render('status', { title: 'Oops!', text: 'You already signed up for this volunteering.', user: req.user, backURL: '/club/' + club.name, backText: 'Back to club page' });
         } else if (event.signedUp.length < event.maxPeople) {
            var update = {};
            update.$push = {};
            update.$push['events.' + index + '.signedUp'] = req.user._id;
            Club.update({ _id: club._id }, update, function (err, club2) {
               if (err) {
                  console.log(err);
               }

               User.findByIdAndUpdate(req.user._id, {$push: { volunteering: { club: club.name, eventId: req.params.eventid, recieved: false, hours: event.hours } } }, function (err, user) {
                  if (err) {
                     console.log(err);
                  }

                  res.redirect('/club/' + club.name);
               });
            });
         } else {
            res.render('status', { title: 'Too slow!', text: 'This volunteering is full.', user: req.user, backURL: '/club/' + club.name, backText: 'Back to club page' });
         }
      }
   });
});

app.post('/confirm-hours/:club/:eventid', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ name: req.params.club }, function (err, club) {
      if (!club) {
         res.render('status', { title: 'Oops!', text: 'Club not found.', user: req.user, backURL: '/feed/', backText: 'Back to feed' });
      } else if (req.user.clubsOwned.indexOf(club._id) == -1) {
         res.render('status', { title: 'Oops!', text: 'You don\'t own this club!', user: req.user, backURL: '/club/' + club.name + '/', backText: 'Back to club page' });
      } else {
         var event;
         var index = -1;
         for (var i in club.events) {
            if (club.events[i]._id == req.params.eventid) {
               event = club.events[i];
               index = i;
            }
         }
         if (!event || index == -1) {
            res.render('status', { title: 'Oops!', text: 'Volunteering not found.', user: req.user, backURL: '/club/' + club.name, backText: 'Back to club page' });
         } else {
            (async function () {
               for (var userId of event.signedUp) {
                  var query = User.update({_id: userId, 'volunteering.eventId': req.params.eventid}, { 'volunteering.$.recieved': req.body[userId + '-confirmed'] != null }, null);
                  var result = await query.exec();
               }
               res.redirect('/confirm-hours/' + club.name + '/' + req.params.eventid + '/');
            })();
         }
      }
   });
});

app.post('/edit-post/:club/:eventid', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ name: req.params.club }, function (err, club) {
      if (err) {
         console.log(err);
      }

      if (!club) {
         res.render('status', { title: 'Oops!', text: 'Club not found.', user: req.user, backURL: '/feed/', backText: 'Back to feed' });
      } else if (req.user.clubsOwned.indexOf(club._id) == -1) {
         res.render('status', { title: 'Oops!', text: 'You don\'t own this club!', user: req.user, backURL: '/club/' + club.name + '/', backText: 'Back to club page' });
      } else {
         var event;
         for (var i in club.events) {
            if (club.events[i]._id == req.params.eventid) {
               event = club.events[i];
            }
         }
         if (!event) {
            res.render('status', { title: 'Oops!', text: 'Event not found.', user: req.user, backURL: '/club/' + club.name, backText: 'Back to club page' });
         } else {
            Club.update({ _id: club._id, 'events._id': event._id }, { 'events.$.title': req.body.title, 'events.$.content': req.body.content }, function (err, club2) {
               if (err) {
                  console.log(err);
               }

               res.redirect('/edit-post/' + req.params.club + '/' + req.params.eventid + '/');
            });
         }
      }
   });
});

app.post('/delete-post/:club/:eventid', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ name: req.params.club }, function (err, club) {
      if (err) {
         console.log(err);
      }

      if (!club) {
         res.render('status', { title: 'Oops!', text: 'Club not found.', user: req.user, backURL: '/feed/', backText: 'Back to feed' });
      } else if (req.user.clubsOwned.indexOf(club._id) == -1) {
         res.render('status', { title: 'Oops!', text: 'You don\'t own this club!', user: req.user, backURL: '/club/' + club.name + '/', backText: 'Back to club page' });
      } else {
         var event;
         for (var i in club.events) {
            if (club.events[i]._id == req.params.eventid) {
               event = club.events[i];
            }
         }
         if (!event) {
            res.render('status', { title: 'Oops!', text: 'Event not found.', user: req.user, backURL: '/club/' + club.name, backText: 'Back to club page' });
         } else {
            Club.update({ _id: club._id }, { $pull: { events: { _id: event._id } } }, function (err, club2) {
               if (err) {
                  console.log(err);
               }

               res.redirect('/club/' + req.params.club + '/');
            });
         }
      }
   });
});

app.post('/create-signins/:club/:eventid', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ name: req.params.club }, function (err, club) {
      if (err) {
         console.log(err);
      }

      if (!club) {
         res.render('status', { title: 'Oops!', text: 'Club not found.', user: req.user, backURL: '/feed/', backText: 'Back to feed' });
      } else if (req.user.clubsOwned.indexOf(club._id) == -1) {
         res.render('status', { title: 'Oops!', text: 'You don\'t own this club.', user: req.user, backURL: '/club/' + club.name + '/', backText: 'Back to club page' });
      } else {
         var event;
         for (var i in club.events) {
            if (club.events[i]._id == req.params.eventid) {
               event = club.events[i];
            }
         }
         if (!event) {
            res.render('status', { title: 'Oops!', text: 'Event not found.', user: req.user, backURL: '/club/' + club.name, backText: 'Back to club page' });
         } else {
            var code = "";
            
            for (var i = 0; i < 6; ++i) {
               code += String.fromCharCode(Math.floor(Math.random() * 26 + 65));
            }

            Club.update({ _id: club._id, 'events._id': event._id }, { 'events.$.signInCode': code }, function (err, club2) {
               if (err) {
                  console.log(err);
               }

               res.redirect('/view-signins/' + req.params.club + '/' + req.params.eventid + '/');
            });
         }
      }
   });
});

app.post('/signin/', redirectIfLoggedOut, function (req, res) {
   Club.findOne({ 'events.signInCode': req.body.code }, function (err, club) {
      if (err) {
         console.log(err);
      }

      if (!club) {
         res.render('status', { title: 'Oops!', text: 'Club not found.', user: req.user, backURL: '/feed/', backText: 'Back to feed' });
      } else {
         var event;
         for (var i in club.events) {
            if (club.events[i].signInCode == req.body.code) {
               event = club.events[i];
            }
         }
         if (!event) {
            res.render('status', { title: 'Oops!', text: 'Event not found.', user: req.user, backURL: '/club/' + club.name, backText: 'Back to club page' });
         } else {
            var code = "";
            
            for (var i = 0; i < 6; ++i) {
               code += String.fromCharCode(Math.floor(Math.random() * 26 + 65));
            }

            Club.update({ _id: club._id, 'events._id': event._id }, { $push: {'events.$.signedUp': req.user._id} }, function (err, club2) {
               if (err) {
                  console.log(err);
               }

               res.redirect('/signin/');
            });
         }
      }
   });
});

// ***
// Start the app
// ***

// Start the app
app.listen(port, function () {
   console.log(`App listening on port ${port}.`);
});

// ***
// Helpers
// ***

function validateEmail (email) {
   var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
   return re.test(email.toLowerCase());
}

function validateUsername (username) {
   var re = /^[A-Za-z0-9._]+$/
   return re.test(username);
}

function redirectIfLoggedIn (req, res, next) {
   if (req.session.userid) {
      res.redirect('/');
   } else {
      next();
   }
}

function redirectIfLoggedOut (req, res, next) {
   if (!req.session.userid) {
      res.redirect('/');
   } else {
      next();;
   }
}
