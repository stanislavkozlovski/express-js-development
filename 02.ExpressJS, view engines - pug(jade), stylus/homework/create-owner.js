/* this module creates the schema for a car owner */
let mongoose = require('mongoose')

let ownerSchema = new mongoose.Schema({
  firstName: {type: String, required: true},
  lastName: {type: String, required: true},
  imagePath: {type: String, requiredD: true},
  cars: Array
})
let Owner = mongoose.model('Model', ownerSchema)
module.exports = Owner
