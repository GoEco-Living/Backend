const http = require('http');
const https = require('https');
const url = require('url');
const { google } = require('googleapis');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

const app = express();
const PORT = 5000;

app.use (express.json())

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:5000/auth/google/callback'
);

const scopes = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

let userCredential = null;

async function main() {
  const app = express();

  app.use(session({
    secret: 'GO324752HDBF', 
    resave: false,
    saveUninitialized: false,
  }));

  app.get('/', async (req, res) => {
    const state = crypto.randomBytes(32).toString('hex');
    // Store state in the session
    req.session.state = state;

    const authorizationUrl = oauth2Client.generateAuthUrl({
      // 'online' (default) or 'offline' (gets refresh_token)
      access_type: 'offline',
      /** Pass in the scopes array defined above.
        * Alternatively, if only one scope is needed, you can pass a scope URL as a string */
      scope: scopes,
      // Enable incremental authorization. Recommended as a best practice.
      include_granted_scopes: true,
      // Include the state parameter to reduce the risk of CSRF attacks.
      state: state
    });

    res.redirect(authorizationUrl);
  });

  // Receive the callback from Google's OAuth 2.0 server.
  app.get('/oauth2callback', async (req, res) => {
    // Handle the OAuth 2.0 server response
    let q = url.parse(req.url, true).query;

    if (q.error) { // An error response e.g. error=access_denied
      console.log('Error:' + q.error);
    } else if (q.state !== req.session.state) { //check state value
      console.log('State mismatch. Possible CSRF attack');
      res.end('State mismatch. Possible CSRF attack');
    } else { // Get access and refresh tokens (if access_type is offline)
      let { tokens } = await oauth2Client.getToken(q.code);
      oauth2Client.setCredentials(tokens);

      userCredential = tokens;
      
      // User authorized the request. Now, check which scopes were granted.
      if (tokens.scope.includes('https://www.googleapis.com/auth/userinfo.email'))
      {
        // User authorized read-only Drive activity permission.
        // Example of using Google Drive API to list filenames in user's Drive.
        const drive = google.drive('v3');
        drive.files.list({
          auth: oauth2Client,
          pageSize: 10,
          fields: 'nextPageToken, files(id, name)',
        }, (err1, res1) => {
          if (err1) return console.log('The API returned an error: ' + err1);
          const files = res1.data.files;
          if (files.length) {
            console.log('Files:');
            files.map((file) => {
              console.log(`${file.name} (${file.id})`);
            });
          } else {
            console.log('No files found.');
          }
        });
      }
      else
      {
      }

      // Check if user authorized Calendar read permission.
      if (tokens.scope.includes('https://www.googleapis.com/auth/userinfo.profile'))
      {
        // User authorized Calendar read permission.
        // Calling the APIs, etc.
      }
      else
      {
        // User didn't authorize Calendar read permission.
        // Update UX and application accordingly
      }
    }
  });

  // Example on revoking a token
  app.get('/revoke', async (req, res) => {
    // Build the string for the POST request
    let postData = "token=" + userCredential.access_token;

    // Options for POST request to Google's OAuth 2.0 server to revoke a token
    let postOptions = {
      host: 'oauth2.googleapis.com',
      port: '443',
      path: '/revoke',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    // Set up the request
    const postReq = https.request(postOptions, function (res) {
      res.setEncoding('utf8');
      res.on('data', d => {
        console.log('Response: ' + d);
      });
    });

    postReq.on('error', error => {
      console.log(error)
    });

    // Post the request with data
    postReq.write(postData);
    postReq.end();
  });


  const server = http.createServer(app);
  server.listen(8080);
}
main().catch(console.error);

  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      // store the refresh_token in your secure persistent database
      console.log(tokens.refresh_token);
    }
    console.log(tokens.access_token);
  });

  oauth2Client.setCredentials({
    refresh_token: `STORED_REFRESH_TOKEN`
  });

  const https = require('https');

// Build the string for the POST request
let postData = "token=" + userCredential.access_token;

// Options for POST request to Google's OAuth 2.0 server to revoke a token
let postOptions = {
  host: 'oauth2.googleapis.com',
  port: '443',
  path: '/revoke',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

// Set up the request
const postReq = https.request(postOptions, function (res) {
  res.setEncoding('utf8');
  res.on('data', d => {
    console.log('Response: ' + d);
  });
});

postReq.on('error', error => {
  console.log(error)
});

// Post the request with data
postReq.write(postData);
postReq.end();