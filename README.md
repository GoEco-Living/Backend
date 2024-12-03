## Backend!
1. [Getting Started](#getting-started)
2. [Endpoints](#endpoints)
   - [Register]
   - [Login]
   - [Meals (Add)]
   - [Transport (Add)]
   - [Meals Recommendation]
   - [Transport Recommendation]
   - [Meals Prediction]
   - [Transport Prediction]
   - [Dashboard]
3. [Testing with Postman](#testing-with-postman)
4. [Deployment](#deployment)

# Getting Started
Prerequisites
Google Cloud SDK installed
Docker installed
Access to Google Cloud Run
Postman for API testing

# Endpoints
** 1. Register
URL: /register
Method: POST
Description: Creates a new user account, 200 if created successfully, 400 if already registered. **

** 2. Login
URL: /login
Method: POST
Description: Authenticates a user and provides a token. 200 if login succesfully, 400 if login unsuccessfully. **

** 3. Meals (Add)
URL: /meals
Method: POST
Description: Adds a new meal to the database. 201 if added successfully, 400 if unsuccessful. **

** 4. Transport (Add)
URL: /transport
Method: POST
Description: Adds a new transport method to the database. 201 if added successfully, 400 if unsuccessful. **

** 5. Meals Recommendation
URL: /meals/recommendation
Method: GET
Description: Provides meal recommendations based on user data. 201 if successfully recommendating, 400 if unsuccessful. **

** 6. Transport Recommendation
URL: /transport/recommendation
Method: GET
Description: Provides transport recommendations based on user preferences. 201 if successfully recommendating, 400 if unsuccessful. **

** 7. Meals Prediction
URL: /meals/predict
Method: POST
Description: Predicts meal outcomes using an ML model. 201 if successfully predicted, 400 if unsuccessful. **

** 8. Transport Prediction
URL: /transport/predict
Method: POST
Description: Predicts transport outcomes using an ML model. 201 if successfully predicted, 400 if unsuccessful. **

** 9. Dashboard
URL: /dashboard
Method: GET
Description: Fetches dashboard data for visualization. 201 if successfully get the user's input, 400 if unsuccessful. **

# Testing with Postman
Import the API collection into Postman. Use the provided API.postman_collection.json.
Configure environment variables for base URL and tokens.
Test each endpoint using the collection.

# Deployment
1. Build the Container Image
  gcloud builds submit --tag gcr.io/<PROJECT-ID>/<SERVICE-NAME>
2. Deploy the Container Image to Cloud Run
  gcloud run deploy <SERVICE-NAME> --image gcr.io/<PROJECT-ID>/<SERVICE-NAME> --platform managed
