import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDCecKcchU7se3DItAr9d5saMxEyDLj588",
  authDomain: "userinfo-a3f4c.firebaseapp.com",
  projectId: "userinfo-a3f4c",
  storageBucket: "userinfo-a3f4c.firebasestorage.app",
  messagingSenderId: "527388958827",
  appId: "1:527388958827:web:8ad81ab47a03e87e70d12e"
};


export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth())
  ]
};
