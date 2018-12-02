var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var clubSchema = new Schema({
   name: { type: String, default: 'Nameless' },
   description: { type: String, default: 'This club has no description :(' },
   events: { type: [ {start: Date, end: Date, posted: Date, title: String, content: String, hours: Number, maxPeople: Number, signedUp: [ ObjectId ], signInCode: String } ], default: [] }
});

var Club = mongoose.model('Club', clubSchema);

module.exports = Club;
