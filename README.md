Store Monitoring Report System
This project is a backend service designed to monitor restaurant store statuses and generate uptime/downtime reports. It provides a REST API to trigger asynchronous report generation and poll for the results.

Features
Asynchronous Report Generation: API calls return instantly while report generation is handled in the background using a job queue.

REST API: Simple endpoints to trigger reports and retrieve their status or final CSV output.

Timezone-Aware Calculations: Accurately calculates uptime/downtime by converting local business hours to UTC.

Data Extrapolation: Intelligently fills in the gaps between hourly status polls to estimate uptime for the entire business day.

Containerized Services: Uses Docker to manage PostgreSQL and Redis for a consistent development environment.

Tech Stack
Backend: Node.js, Express.js, TypeScript

Database: PostgreSQL

ORM: Prisma

Job Queue: BullMQ

Message Broker: Redis

Containerization: Docker

Setup and Installation
Follow these steps to get the project up and running on your local machine.

Prerequisites
Node.js (v18 or later)

pnpm (or npm/yarn)

Docker and Docker Compose

1. Clone & Install Dependencies
Clone the repository and install the necessary packages.

git clone <your-repo-url>
cd <your-repo-name>
pnpm install

2. Start Services
This command will start the PostgreSQL database and Redis server in the background.

docker-compose up -d

3. Setup Database Schema
Apply the database schema to create all the necessary tables.

npx prisma migrate dev

4. Seed the Database
Populate the database with the initial data from the provided CSV files. Make sure the CSVs are located in the /data directory.

npm run db:seed

Running the Application
The application consists of two main processes that need to be run in separate terminals.

Terminal 1: Start the Worker
The worker is responsible for processing jobs from the queue.

node --loader ts-node/esm src/workers/reportWorker.ts

Terminal 2: Start the API Server
The server handles incoming HTTP requests.

npm start

The API will be available at http://localhost:3000.

API Usage
Trigger a Report
Sends a request to start generating a new report.

Endpoint: POST /trigger_report

Response: A JSON object with the report_id.

Example curl command:

curl -X POST http://localhost:3000/trigger_report

Get a Report
Polls for the status of a report. If complete, it returns the CSV file.

Endpoint: GET /get_report

Query Parameter: report_id

Response:

If pending/running: {"status": "RUNNING"}

If complete: The CSV file as a download.

Example curl command:

# Replace YOUR_REPORT_ID with the ID from the trigger response
curl "http://localhost:3000/get_report?report_id=YOUR_REPORT_ID" --output generated_report.csv

Ideas for Improvement
Scalability: The current worker processes the report for all stores in a single job. For a larger dataset, this could be slow. A better approach would be for the main job to spawn child jobs for each store (or batches of stores), allowing for parallel processing across multiple worker instances.

Data Aggregation: For very large historical datasets, querying the raw status log table would become a bottleneck. A materialized view or a nightly aggregation job could pre-calculate daily uptime/downtime, making report generation nearly instantaneous.

Error Handling & Retries: The BullMQ worker could be configured with a robust retry strategy for jobs that fail due to transient issues (e.g., temporary database disconnects).

Configuration Management: Moving hardcoded values (like Redis connection details) into environment variables for better configuration across different environments (development, staging, production).
