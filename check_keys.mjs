import firebase from 'firebase/compat/app';
import 'firebase/compat/database';

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCs8VgAr7bQoxv5vIVrnfG5opPWa9eDkuE",
    authDomain: "auratracker-18242.firebaseapp.com",
    databaseURL: "https://auratracker-18242-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "auratracker-18242",
    storageBucket: "auratracker-18242.firebasestorage.app",
    messagingSenderId: "757820673078",
    appId: "1:757820673078:web:176d48e26e6be657d31c97"
};

const app = firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database(app);

const testKeys = ["5678", "spiti", "spiti opr 5678", "spitiopr5678"];

console.log("Testing specific keys...");

async function run() {
    for (const key of testKeys) {
        try {
            const snapshot = await db.ref(`aura_tracker/${key}`).once("value");
            console.log(`Key "${key}": ${snapshot.exists() ? "EXISTS" : "DOES NOT EXIST"}`);
            if (snapshot.exists()) {
                console.log(`  Data details:`, JSON.stringify(snapshot.val()).substring(0, 100));
            }
        } catch (err) {
            console.error(`Error checking key "${key}":`, err.message);
        }
    }
    process.exit(0);
}

run();
