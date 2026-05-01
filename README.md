# Travel Window - Booking Management System

A robust, full-stack Travel Booking Management System designed for travel agencies to streamline their operations, manage bookings, track suppliers, and coordinate between different agent roles.

## 🚀 Live Deployment
- **Frontend**: [https://travel-windo-ca.vercel.app](https://travel-windo-ca.vercel.app)
- **Backend API**: [https://travel-windo-ca-s5b9.vercel.app](https://travel-windo-ca-s5b9.vercel.app)

## 🛠 Tech Stack

### Frontend
- **Framework**: Angular 18
- **Styling**: Tailwind CSS
- **State Management**: RxJS
- **UI Components**: SweetAlert2, Ngx-Toastr
- **Deployment**: Vercel (Static Build)

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB Atlas (Mongoose ODM)
- **Authentication**: JWT (JSON Web Tokens) with BcryptJS hashing
- **Deployment**: Vercel Serverless Functions

## 📁 Repository Structure
- `travel-window-frontend-staging-main/`: The Angular frontend application.
- `travel-window-backend-staging-main/`: The Node.js Express backend.

## ⚙️ Configuration & Environment Variables

### Backend Environment Variables
Set these in your Vercel Dashboard or local `.env` file:
- `MONGODB_URI`: Your MongoDB Atlas connection string (e.g., `mongodb+srv://...`).
- `JWT_SECRET`: A secure string for signing authentication tokens.
- `SEED_SECRET`: A secret string used to protect the database seeding route.

### Frontend Environment Variables
Set these in your Vercel Dashboard:
- `API_URL`: The full URL to your backend API, including the `/api` suffix (e.g., `https://travel-windo-ca-s5b9.vercel.app/api`).

## 🛠 Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Harman032/Travel-windo-ca.git
   ```

2. **Backend Setup**:
   ```bash
   cd travel-window-backend-staging-main
   npm install
   # Create a .env file with your MONGODB_URI
   npm start # Runs on http://localhost:3000
   ```

3. **Frontend Setup**:
   ```bash
   cd travel-window-frontend-staging-main
   npm install
   npm start # Runs on http://localhost:4200
   ```

## 🧪 Database Seeding
The system includes an idempotent seeding script to initialize default users and suppliers.

1. Set a `SEED_SECRET` in your backend environment variables.
2. Visit the following URL in your browser:
   `https://travel-windo-ca-s5b9.vercel.app/api/seed?secret=YOUR_SEED_SECRET`

### Default Access (After Seeding)
- **Admin**: `admin@travel.com` / `123456789`
- **Account**: `account@travel.com` / `123456789`
- **Agent**: `agent1@travel.com` / `123456789`

## 📄 License
This project is for internal use.
