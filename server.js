const express = require('express')
const app = express()
const port = 3000

app.get('/', function (req, res) {
    res.send("This is a test!")
})

app.listen(port, function() {
    console.log(`Server is listening on port ${port}!`)
})
