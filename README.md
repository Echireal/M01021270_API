# M01021270_CW1

# All links
Github Vue Front End Repository link
https://github.com/Echireal/FullStackDevelopment_VueCode

Github Pages link
https://echireal.github.io/FullStackDevelopment_VueCode/

Github Express Back End Repository link
https://github.com/Echireal/M01021270_API

Render.com link that return all lessons
https://fullstack-cw1-api.onrender.com/api/lesssons

## Catution:
https://fullstack-cw1-api.onrender.com maybe shows "Can not GET",
but you can try https://fullstack-cw1-api.onrender.com/api/health
or
https://fullstack-cw1-api.onrender.com/api/lesssons
to test it is working or not.

## JSON file Exportion

#### Already exported MongoDB two collections lessons and orders.
They are in the path M01021270_API
fullStack-cw1.lessons
fullStack-cw1.orders
#### Already exported Postman collections.
M01021270_Postman.postman_collection


# Introduction

This project is a full-stack web application developed as part of the CST3144 Full Stack Development coursework. The system implements a complete lesson-booking workflow, including displaying lessons, adding lessons to a shopping cart, submitting orders, performing real-time search, and updating lesson availability. The application is built with a Vue 3 front-end, an Express.js back-end, and MongoDB Atlas as the database. The project is deployed using Render (backend) and GitHub Pages (frontend).

# Front-End (Vue 3 + Vite)

Displays a list of lessons retrieved from the backend API.
Allows sorting lessons by topic, location, price, and available spaces.
Provides cart functionality: add, remove, increase/decrease quantity.
Includes form validation (name + phone) before order submission.
Implements a real-time “search as you type” feature.
Dynamically shows lesson icons served by the backend static middleware.
Uses fetch() to communicate with backend REST routes.

# Back-End
Provides REST API routes:
#### GET /api/lessons – returns all lessons.
#### POST /api/orders – saves new order and validates data.
#### PUT /api/lessons/:id – updates lesson availability.
#### GET /api/search?q= – backend full-text search supporting several fields.
They are all displayed in JSON format files exported from MongoDB and Postman.

Includes two required middleware functions:
Logger middleware – prints every incoming request to the console (method, URL, timestamp, IP, user agent).
Static image middleware – serves lesson images from /public/images/lessons and returns JSON error message if a file does not exist.
Uses MongoDB Atlas for data storage, including “lessons” and “orders” collections.
Uses environment variables (.env) for connection string and port.

# Key Features Implemented
## Lesson Retrieval (GET /api/lessons)
The application fetches lesson data from MongoDB using the backend API. Each lesson contains topic, price, location, available space, and an optional image filename.
## Order Submission (POST /api/orders)
When the user checks out:
Front-end sends a JSON body containing name, phone, and cart items.
Backend validates input, inserts the order into MongoDB, and returns insertedId.
For each ordered lesson, a PUT request can update its available spaces.

## Update Lesson Availability (PUT /api/lessons/:id)

After checkout, the lesson space is recalculated and sent to the backend to update the database. This route supports updating any field, not just increment/decrement.

## Search Functionality with “Search As You Type”
One of the advanced parts of the coursework:
#### The front-end captures user input in real time and sends it to /api/search?q=.
#### The backend performs full-text matching on topic, location, price, and space.
#### The filtered results are displayed instantly.

## Static Image Hosting Middleware
Each lesson can have an icon (e.g., lesson2.png).
Images are stored under:
/public/images/lessons/

Backend route:
GET /images/lessons/:file

## Logger Middleware

Every request logs:
[timestamp] METHOD URL – status, time spent, IP, User-Agent

## Backend Deployment (Render)

Backend repository is connected to Render.
On each push to GitHub, Render redeploys automatically.
Public API base URL:
https://fullstack-cw1-api.onrender.com

## Frontend Deployment (GitHub Pages)
Vite build output is placed inside /docs.
vite.config.js configured with correct base path.
GitHub Pages serves the built static frontend.
Frontend fetches backend using:
VITE_API_BASE = https://fullstack-cw1-api.onrender.com

## How to Run Locally
### Backend:
cd M01021270_API
npm install
npm run dev

### Frontend:
cd M01021270_CW1
npm install
npm run dev

# Summary

This project demonstrates a complete full-stack workflow, including database integration, API design, front-end interactivity, middleware implementation, search features, and deployment. All coursework requirements have been fulfilled: REST API, POST/PUT functionality, middleware, images, search-as-you-type, and cloud deployment. All functions were achieved and worked.