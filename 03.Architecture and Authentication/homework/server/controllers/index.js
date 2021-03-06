/**
 * this module exports an object holding ANOTHER OBJECT holding functions for each of the pages the controllers manages
 * ex: homeControllers returns an object holding as key the page and as value a functions
 * {
    index: (req, res) => {
      res.render('home/index')
    },
    about: (req, res) => {
      res.render('home/about')
    }
   }
 */
const homeController = require('./home-controller')
const usersController = require('./users-controller')
const articlesController = require('./articles-controller')

module.exports = {
  home: homeController,
  users: usersController,
  articles: articlesController
}
