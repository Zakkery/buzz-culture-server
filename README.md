# CultureChat server side
This application acts as a server for the CultureChat Android App.

## Installation
To install this application first install node (version 8.10.0) and npm (version 3.5.2). It is also necessary to install MongoDB and setup SendGrid account with the API key

## Run
To run the application you need to specify following environmental variables:
  *PORT=port to run the server on
  *MONGODB_URI=url for mongodb to contain application data
  *SECRET=secret to encode passwords with
  *SENDGRID_API_KEY=sendgrid api key to send emails with

Application starts by executing the following command:
```PORT=8080 MONGODB_URI=URL SECRET=SECRET_CODE SENDGRID_API_KEY=API_KEY node server.js```

It can also be deployed on Heroku
