var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var userSchema = new Schema({
   username: {type: String, unique: true},
   password: String,
   clubsOwned: { type: [ ObjectId ], default: [] },
   clubsFollowed: { type: [ ObjectId ], default: [] },
   email: {type: String, unique: true},
   bio: {type: String, default: 'This user is  CS student. As in, they don\'t have a bio.'}
});

var User = mongoose.model('User', userSchema);

module.exports = User;
