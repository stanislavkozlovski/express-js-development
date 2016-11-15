// this module holds the functions for the routes that are associated with forum threads
const mongoose = require('mongoose')
const User = mongoose.model('User')
const Thread = mongoose.model('Thread')
const Answer = mongoose.model('Answer')


function showThreadPage (req, res, threadID) {
  let nonFatalError = ''
  if (req.session.nonFatalError) {
    nonFatalError = req.session.nonFatalError
    delete req.session.nonFatalError
  }
  Thread
    .findOne({ 'id': threadID })
    .populate('answers')
    .then((thread) => {
      if (!thread) {
        // ERROR
        req.session.nonFatalError = `No thread with ID: ${threadID} exists!`
        console.log('No thread found!')
        res.redirect('/')
        return
      }
      Thread.populate(thread, { path: 'answers.author', model: User }, (err, te) => {
        if (err) {
          console.log('ERROR IN POPULATING AUTHORS IN THREAD-CONTROLLER.JS')
        } else {
          
          res.render('thread/thread', { thread: thread, answers: thread.answers, nonFatalError: nonFatalError })
        }
      })
    })
}

module.exports = {
  showCreate: (req, res) => {
    res.render('thread/register')
  },

  showList: (req, res) => {
    // 20 threads sorted by their last answer's date
    Thread
      .find()
      .populate(['answers', 'author'])
      .then((threads) => {
        // order by the latest answer in the thread
        threads.sort((x, y) => {
          if (x.answers.length === 0 || y.answers.length === 0) {
            // if one of them does not have any answers, list the one with answers in front
            return x.answers.length < y.answers.length
          }
          return x.answers[x.answers.length - 1].creationDate < y.answers[y.answers.length - 1].creationDate
        })
        // take the first 20
        let orderedThreads = threads.slice(0, Math.min(threads.length, 20))

        res.render('thread/list', { threads: orderedThreads })
      })
  },

  showEditPage: (req, res) => {
    let threadId = req.params.id

    Thread
      .findOne({ id: threadId })
      .then((thread) => {
        if (!thread) {
          // ERROR!
          req.session.nonFatalError = `No such thread with ID ${threadId} exists!`
          res.redirect('/')
          return
        } else if ((!req.user.isAdmin() || req.user.isAuthor(thread))) {
          // unauthorized access
          req.session.nonFatalError = 'You do not have permission for that action!'
          res.redirect(`/post/${thread.id}/${thread.title}`)
          return
        }

        res.render('thread/edit', { thread: thread })
        return
      })
  },

  showThread: (req, res) => {
    let threadID = req.params.id === 'js' ? 0 : req.params.id
    showThreadPage(req, res, threadID)
  },

  editThread: (req, res) => {
    let threadId = req.params.id

    Thread
      .findOne({ id: threadId })
      .then((thread) => {
        if (!thread) {
          // ERROR
          req.session.nonFatalError = `No such thread with ID ${threadId} exists!`
          res.redirect('/')
          return
        } else if (!(req.user.isAuthor(thread) || req.user.isAdmin())) {
          // unauthorized access!
          res.redirect('/')
          return
        }
        // update the thread
        thread.title = req.body.title
        thread.content = req.body.content

        thread.save()
        let threadUrl = '/post/' + thread.id + '/' + thread.title
        res.redirect(threadUrl)
      })
  },

  create: (req, res) => {
    // get the max ID and increment it on the new thread
    Thread
      .findOne()
      .sort('-id')
      .exec((err, item) => {
        if (err) {
          console.log(err)
        } else {
          let incrementedID = 1

          if (item) {
            incrementedID = parseInt(item.id) + 1
          }

          let thread = req.body

          thread.author = req.user._id
          thread.id = incrementedID
          Thread
            .create(thread)
            .then((thread) => {
              // add the thread to the user's threads array
              User.findById(thread.author).then((user) => {
                user.threads.push(thread._id)
                user.save()
              })
              console.log('Created a new thread with title ' + thread.title)
              res.redirect('/')
            })
        }
      })
  },

  addAnswer: (req, res) => {
    let threadId = req.params.id  // from the URL /answer/:id/:title
    let answer = req.body

    // validate the thread
    Thread
      .findOne({ id: threadId })
      .then((thread) => {
        if (!thread) {
          req.session.nonFatalError = `No thread with ID ${threadId} exists!`
          res.redirect('/')
          return
        }

        answer.thread = thread._id
        answer.author = req.user._id  // attach the user to the article
        answer.creationDate = new Date()
        Answer
          .findOne()
          .sort('-id')  // get the latest ID
          .then((newestAnswer) => {
            let incrementedID = 1

            if (newestAnswer) incrementedID = parseInt(newestAnswer.id) + 1

            answer.id = incrementedID
            Answer
              .create(answer)  // save the answer to the db
              .then((answer) => {
                console.log(thread.answers)
                thread.answers.push(answer._id)  // save it to the thread's answers too
                console.log(thread.answers)
                thread.save()
                User
                  .findById(answer.author)
                  .then((user) => {
                    if (!user) {
                      console.log('No user when trying to add a answer, this shouldnt be happening! :O')
                      throw Error
                    }

                    user.answers.push(answer._id)  // save the answer to the user's answers too
                    user.save()
                    res.redirect('/post/' + threadId + '/' + req.params.title)
                  })
              })
          })
      })
  },

  deleteAnswer: (req, res) => {
    let answerId = req.params.id

    Answer
      .findOne({ id: answerId })
      .populate(['thread', 'author'])
      .then((answer) => {
        if (!answer) {
          // ERROR
          req.session.nonFatalError = `Could not delete answer with id ${answerId} simply because it doesnt exist!`
          res.redirect('/')
          return
        }
        // remove from the threads' answers
        Thread
          .findById(answer.thread._id)
          .then((thread) => {
            if (!thread) {
              req.session.nonFatalError = 'The thread saved in the answer does not exist!'
              res.redirect('/')
              return
            } else if (!req.user.isAdmin()) {
              // unauthorized access!
              req.session.nonFatalError = 'You do not have permission for that action'
              res.redirect('/')
              return
            }
            let answerIndex = thread.answers.indexOf(answer._id)
            if (answerIndex === -1) {
              // error!
              req.session.nonFatalError = "The answer you're trying to delete is not in the thread's answers array"
              res.redirect(`/post/${thread.id}/${thread.title}`)
              return
            }
            thread.answers.splice(answerIndex, 1)  // remove it
            thread.save()
            // remove from the user's answers
            User
              .findById(answer.author._id)
              .then((user) => {
                if (!user) {
                  req.session.nonFatalError = "The answer you're deleting does not have an author"
                  res.redirect(`/post/${thread.id}/${thread.title}`)
                  return
                }

                let answerIndex = user.answers.indexOf(answer._id)
                if (answerIndex === -1) {
                  // error
                  req.session.nonFatalError = 'An answer were deleting from the users answers array is not there'
                  res.redirect(`/post/${thread.id}/${thread.title}`)
                  return
                }
                user.answers.splice(answerIndex, 1)  // remove it
                user.save()

                // delete it
                answer.remove()
                // redirect to the answer's thread page
                showThreadPage(req, res, answer.thread.id)
              })
          })
      })
  },

  deleteThread: (req, res) => {
    let threadId = req.params.id

    Thread
      .findOne({ id: threadId })
      .then((thread) => {
        if (!thread) {
          // ERROR
          req.session.nonFatalError = `Unsuccessful delete request. Thread with id ${threadId} does not exist.`
          res.redirect('/')
          return
        } else if (!req.user.isAdmin()) {
          // Unauthorized deletion
          res.redirect('/')
          return
        }
        // remove all the thread's answers
        for (let answerId of thread.answers) {
          Answer.findById(answerId).then((answer) => { answer.remove() })
        }
        thread.remove()
        res.redirect('/')
      })
  }
}
