const multiparty = require('multiparty')

let form = new multiparty.Form()

let saveImage = require('../utilities/save-image')
let Article = require('mongoose').model('Article')


function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n)
}


module.exports = {
  // display the page letting the user add an article
  add: (req, res) => {
    res.render('articles/add-article')
  },

  // add the article to the DB
  create: (req, res) => {
    form.parse(req, (err, fields, files) => {
      let author = {
        id: req.user._id,
        fullName: req.user.firstName + ' ' + req.user.lastName
      }

      let article = {
        author: author,
        title: fields.title[0],
        contents: fields.contents[0]
      }

      Article
        .find({ 'title': article.title })
        .then((articles) => {
          // make sure such an article does not exist
          if (articles.length !== 0) {
            // such an article exists
            article.globalError = 'There already is an article with the title ' + article.title
            res.render('articles/add-article', article)
            return
          } else {
            // try to save the picture only when we're sure we're creating the article
            let imgPath = ''
            let articlePicture = files.articlePicture[0]
            if (articlePicture.originalFilename) {
              // a picture has been uploaded
              imgPath = saveImage(article.title, articlePicture.path, articlePicture.originalFilename)
            }
            article.imgPath = imgPath

            // create the article
            Article
              .create(article)
              .then(() => {
                console.log('Saved article ' + article.title + ' successfully!')
                res.redirect('/articles')
              })
          }
        })
    })

  },

  list: (req, res) => {
    // the page we're currently on and the query strings for the pagination
    let page = isNumeric(req.query.page) ? parseInt(req.query.page) : 0
    let nextPageQueryString = '?page=' + (page + 1)
    let prevPageQueryString = page !== 0 ? '?page=' + (page - 1) : undefined
    let articlesPerPage = 5

    let requestUserID = undefined  // the DB ID of the user viewing the articles
    let requestUserIsAdmin = false
    if (req.user) {
      requestUserID = req.user._id
      if (req.user.roles.indexOf('Admin') !== -1) {
        requestUserIsAdmin = true
      }
    }

    // show the page that lists all the articles
    Article
      .find({})
      .sort('-_id')  // to sort them in newest-oldest
      .skip(articlesPerPage * page)
      .limit(articlesPerPage)
      .then((articles) => {
        if (articles.length === 0 && page !== 0) {
          // reset to the first page if we can't list anything on the requested page
          res.redirect('articles?page=0')
        } else {
          res.render('articles/list-articles', {
            articles: articles,
            prevPageQueryString: prevPageQueryString,
            nextPageQueryString: nextPageQueryString,
            viewerID: requestUserID,  // to check if he can edit the article
            viewerIsAdmin: requestUserIsAdmin  // for exclusive CRUD rights
          })
        }
      })
  },
  // display edit page
  editPage: (req, res) => {
    let articleTitle = req.params.articleTitle
    let requestUserID = undefined  // the DB ID of the user viewing the articles   
    if (req.user) {
      requestUserID = req.user._id
    }

    Article
      .findOne({ title: articleTitle })
      .then((article) => {
        if (!article) {
          res.render('home/index', { globalError: 'No such article with title ' + articleTitle + ' exists.' })
        } else {
          // render edit page
          if (req.user.roles.indexOf('Admin') === -1 && // if the user is not an admin
            String(article.author.id).valueOf() !== String(requestUserID).valueOf()) {  // and is not the creator of the article
            // the user that wants to edit the article is not the author
            res.render('home/index')
          } else {
            res.render('articles/edit-article', article)
          }
        }
      })
  },
  // edit the article in the DB
  editArticle: (req, res) => {
    let oldTitle = req.body.oldTitle
    let newTitle = req.body.title
    let newContent = req.body.contents

    Article
      .findOne({ title: oldTitle })
      .then((article) => {
        if (!article) {
          res.render('home/index', { globalError: 'No such article with title "' + oldTitle + '" exists.' })
        } else {
          // check if new title exists
          Article
            .findOne({ title: newTitle })
            .then((potentialArticle) => {
              if (potentialArticle && potentialArticle.title !== oldTitle) {
                // article with new title already exists and it's not the old one
                res.render('articles/edit-article', {
                  globalError: 'An article with the title "' + newTitle + '" exists.',
                  title: article.title,
                  contents: article.contents
                })
              } else {
                article.title = newTitle
                article.contents = newContent
                article.save()
                res.redirect('/articles')
              }
            })
        }
      })
  },

  // article details page
  detailsPage: (req, res) => {
    let articleTitle = req.params.articleTitle

    Article
      .findOne({ title: articleTitle })
      .then((article) => {
        if (!article) {
          // article with the requested title does not exist
          res.render('articles/list-articles', { globalError: 'An article with the title "' + articleTitle + '" does not exist!' })
        } else {
          // show details page
          let requestUserID = undefined  // the DB ID of the user viewing the articles
          let requestUserIsAdmin = false
          if (req.user) {
            requestUserID = req.user._id
            requestUserUsername = req.user.username
            if (req.user.roles.indexOf('Admin') !== -1) {
              requestUserIsAdmin = true
            }
          }
          res.render('articles/article-details', { article: article, viewerID: requestUserID, viewerIsAdmin: requestUserIsAdmin, viewerUsername: requestUserUsername })
        }
      })
  },

  // delete an article
  deleteArticle: (req, res) => {
    let articleTitle = req.params.articleTitle

    Article
      .findOne({ title: articleTitle })
      .then((article) => {
        if (!article) {
          res.render('articles', { globalError: 'An article with the title "' + articleTitle + '" does not exist!' })
        } else {
          if (req.user) {
            requestUserID = req.user._id
            if (req.user.roles.indexOf('Admin') !== -1) {
              requestUserIsAdmin = true
            }
          }

          if (requestUserIsAdmin) {
            // delete the article
            article.remove()
            res.redirect('/articles')
          }
        }
      })
  },

  // add a comment to the article
  addComment: (req, res) => {
    let articleTitle = req.params.articleTitle

    Article
      .findOne({ title: articleTitle })
      .then((article) => {
        if (!article) {
          // no such article exists
          res.render('/articles/list-articles', { globalError: 'An article with the title "' + articleTitle + '" does not exist!' })
        } else {
          if (!req.user) {
            // user is not logged in
            res.render('articles/list-articles', { globalError: 'You need to be logged in to add a comment!' })
          } else {
            let comment = req.body
            console.log(comment)
            article.comments.push(comment)
            console.log(article)
            article
              .save()
              .then(() => {
                res.redirect('/articles/details/' + escape(articleTitle))
              })
          }
        }
      })
  }
}
