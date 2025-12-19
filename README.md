# Firefly FastAPI Test App

Clone the repository and follow the instructions in this README.md file.

## Backend .env file
Create a .env file in the /backend directory with the following content:

FIREFLY_SERVICES_CLIENT_ID=<your_client_id>

FIREFLY_SERVICES_CLIENT_SECRET=<your_client_secret>

SCOPES=openid, AdobeID, session, additional_info, firefly_api, ff_apis, read_organizations, creative_cloud, gnav, additional_info.projectedProductContext, additional_info.roles, additional_info.company, additional_info.ownerOrg, org.read, substance3d_api.jobs.create, profile, substance3d_api.spaces.create, email, creative_sdk

AWS_ACCESS_KEY_ID=<your_access_key_id>

AWS_SECRET_ACCESS_KEY=<your_secret_access_key>

AWS_DEFAULT_REGION=<your_default_region>


## Running the application
This application is using Docker Compose to manage the backend and frontend services. Therefore to run to run the application, execute the following command:

```bash
docker-compose up --build
```

Executing this command will start the backend and frontend services.

After the application has booted and is fully running, in your browser you can navigate to the frontend and backend at the following URLs.

Frontend: http://localhost:5173 

Backend: http://localhost:8000/docs


## Running the backend only
Requires uv to be installed.  You can install via instructions at https://docs.astral.sh/uv/getting-started/installation/

```bash
uv sync
source .venv/bin/activate
fastapi dev main.py
```
