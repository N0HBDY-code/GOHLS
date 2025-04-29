
# 🔐 Angular 19 Firebase Authentication with Google Sign-In

![Angular](https://img.shields.io/badge/Angular-19-red?logo=angular)
![Firebase](https://img.shields.io/badge/Firebase-Authentication-yellow?logo=firebase)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Status](https://img.shields.io/badge/Status-In_Progress-orange)

This project demonstrates how to implement authentication using **Firebase** in an **Angular 19** application. It includes traditional email/password registration and login, as well as authentication via **Google Sign-In**.

---

## ✨ Features

- 🔑 Register using email and password  
- 🔐 Login with existing email/password  
- 📧 "Forgot Password" functionality to receive a password reset email  
- 🌐 Sign in with Google  

---

## 🧩 Components

- **LoginComponent** — Handles the login form and Google sign-in  
- **RegisterComponent** — Allows users to create an account  
- **DashboardComponent** — Main dashboard after successful authentication  
- **VerifyEmailComponent** — View shown after initiating the "Forgot Password" process  

---

## 🧰 Services

- **AuthService** — Centralized service that provides authentication functionality:
  - `login()`
  - `register()`
  - `logout()`
  - `forgotPassword()`
  - `signInWithGoogle()`

---

## 🚀 Getting Started

### 1. Clone the Project

```bash
git clone <url-of-your-forked-repo>
cd <project-directory>
npm install
```

### 2. Set Up Firebase

1. Go to [Firebase Console](https://firebase.google.com/)
2. Create a new Firebase project
3. Navigate to **Build > Authentication**
4. Click **Get Started**
5. Under **Sign-in providers**, enable:
   - **Email/Password**
   - **Google**
6. Go to **Project Settings** (gear icon near Project Overview)
7. Register a new **Web App** and follow the setup steps
8. Copy the `firebaseConfig` object provided
9. Paste it into your Angular project’s `app.config.ts` file (inside the designated comment)

### 3. Run the Project
Open the local cloned project in VS Code and launch the terminal and run the below ng command.
```bash
ng serve
```

Open your browser and navigate to `http://localhost:4200/`

---

## 🧪 How to Use

1. You’ll be presented with the **Login Page**
2. Click the **Register** link to sign up using email/password
3. After registration, your credentials will be saved in Firebase
4. Login using the registered credentials
5. On success, you'll be navigated to the **Dashboard**
6. Try signing in with Google by clicking **"Sign in with Google"**
7. On success, you’ll be authenticated and redirected to the dashboard
8. You can view your sign-in info inside your Firebase console

---

## 📝 Notes

- Make sure to configure Firebase correctly before running the app
- Firebase may require you to add authorized domains (like `localhost`) to the authentication settings
- Always keep sensitive data like API keys and config in environment-specific files or secure storage

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
