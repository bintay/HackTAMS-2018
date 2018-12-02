var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var userSchema = new Schema({
   username: {type: String, unique: true},
   name: String,
   password: String,
   clubsOwned: { type: [ ObjectId ], default: [] },
   clubsFollowed: { type: [ ObjectId ], default: [] },
   email: {type: String, unique: true},
   bio: {type: String, default: 'This user is  CS student. As in, they don\'t have a bio.'},
   volunteering: [ { club: String, eventId: ObjectId, recieved: { type: Boolean, default: false } } ],
   picture: { type: String, default: 'default-1.png' }
});

var User = mongoose.model('User', userSchema);

module.exports = User;
