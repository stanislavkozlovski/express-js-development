const mongoose = require('mongoose')

let threadSchema = mongoose.Schema({
  author: {
    type: String,
    required: true
  },

  title: {
    type: String,
    required: true
  },

  content: {
    type: String,
    required: true
  },

  id: {
    type: Number,
    required: true
  }
})

mongoose.model('Thread', threadSchema)
