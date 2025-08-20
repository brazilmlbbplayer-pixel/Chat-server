const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String },
  displayName: { type: String },
  avatarUrl: { type: String },
  backgroundUrl: { type: String },
});

module.exports = mongoose.model('User', UserSchema);
