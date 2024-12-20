**# Backend!**

**Getting Started** 

Before diving in, ensure you have the following:

* **Google Cloud SDK:** [https://cloud.google.com/sdk](https://cloud.google.com/sdk)
* **Docker:** [https://docs.docker.com/engine/install/](https://docs.docker.com/engine/install/)
* **Google Cloud Run access**
* **Node.js 18**
* **Postman for API testing:** [https://www.postman.com/downloads/](https://www.postman.com/downloads/)

**Endpoints**

Our backend exposes a range of functionalities:

| Endpoint         | Method | Description                                     | Status Code |
|-----------------|--------|-------------------------------------------------|--------------|
| Register        | POST   | Creates a new user account.                   | 200 (OK)     |
| Login           | POST   | Authenticates a user and provides a token.     | 200 (OK)     |
|                 |        |                                               | 401 (Unauthorized) |
| Meals (Add)      | POST   | Adds a new meal to the database.                 | 201 (Created) |
|                 |        |                                               | 400 (Bad Request) |
| Transport (Add)  | POST   | Adds a new transport method to the database.      | 201 (Created) |
|                 |        |                                               | 400 (Bad Request) |
| Meals Recommendation | GET   | Provides personalized meal recommendations.         | 200 (OK)     |
|                 |        |                                               | 400 (Bad Request) |
| Transport Recommendation | GET   | Provides recommended transportation based on user preferences. | 200 (OK)     |
|                 |        |                                               | 400 (Bad Request) |
| Dashboard       | GET   | Fetches data for user dashboard visualization.  | 200 (OK)     |
|                 |        |                                               | 400 (Bad Request) |

**Testing with Postman**

1. Import the provided `API.postman_collection.json` into Postman. (Available in the folder!)
2. Configure environment variables for base URL and tokens.
3. Unleash your inner tester! Each endpoint is ready for exploration.

**Deployment**

Ready to unleash this backend to the world? Here's how to deploy it to Google Cloud Run:

1. **Build the Container Image:**
   ```bash
   gcloud builds submit --tag gcr.io/<PROJECT-ID>/<SERVICE-NAME>
   ```
2. **Deploy the Container Image to Cloud Run:**
   ```bash
   gcloud run deploy <SERVICE-NAME> --image gcr.io/<PROJECT-ID>/<SERVICE-NAME> --platform managed
   ```

**Remember to replace`<PROJECT-ID>` and `<SERVICE-NAME>` with your own project and service details!**
