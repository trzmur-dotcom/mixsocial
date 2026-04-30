# 🍹 MixSocial - Setup Guide

## Step 1: Install Node.js
Download from: https://nodejs.org/en/download
Choose the **LTS** version (Windows Installer .msi)
Run the installer → click Next through all steps → Finish.

## Step 2: Open Terminal
- Press `Win + R`, type `cmd`, press Enter
- OR right-click the Start menu → "Terminal"

## Step 3: Navigate to project folder
```
cd "C:\Users\USER\OneDrive\שולחן העבודה\אפליקציית קוקטלים"
```

## Step 4: Install backend dependencies
```
cd backend
npm install
cd ..
```

## Step 5: Install frontend dependencies
```
cd frontend
npm install
cd ..
```

## Step 6: Start the backend (leave this terminal open)
```
cd backend
npm start
```
You should see: 🍹 MixSocial API running on http://localhost:3001

## Step 7: Open a second terminal window and start the frontend
```
cd "C:\Users\USER\OneDrive\שולחן העבודה\אפליקציית קוקטלים\frontend"
npm run dev
```
You should see: Local: http://localhost:5173

## Step 8: Open the app
Open your browser and go to: http://localhost:5173

## Demo login
- Email: master@demo.com
- Password: demo123

---

## Features
- 📖 Instagram-style stories with cocktail recipes
- 🔖 Save recipes to your personal Recipe Book
- 🗂️ Recipes organized by alcohol type (Gin, Whiskey, Vodka, Rum...)
- ⭐ Rate cocktails 1-10
- 🍽️ Food pairing recommendations
- 🍶 "My Bar" - filter recipes by what you have at home
- 🔍 Search & explore cocktails
- 👤 Follow other cocktail creators
