# AuraSpend Mobile Expense Tracker

A modern, fast, mobile-first personal expense tracker. The app keeps track of daily/monthly transactions, category allocations with interactive visualizations, accounts, fixed/variable bills, and lent funds. All your data is securely persisted on your local device via `localStorage`.

## 🚀 How to Run Locally

You can open `index.html` directly in any web browser, or serve it using a lightweight local development server:

```bash
# Serve using Python 3
python -m http.server 8000

# Or serve using Node / npx
npx http-server -p 8000
```
Then visit `http://localhost:8000` in your browser.

---

## 🐙 Deployment to GitHub Pages

This project is pre-configured with a GitHub Action that automatically deploys the code to GitHub Pages on every push to the `main` branch.

### Step-by-Step Setup:
1. Initialize Git and make the initial commit:
   ```bash
   git init
   git checkout -b main
   git add .
   git commit -m "initial commit"
   ```
2. Create a new repository on GitHub (do NOT initialize it with README, license, or gitignore).
3. Connect your local repository to your GitHub repo and push:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```
4. On your GitHub Repository Page:
   - Go to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.
   - The workflow `.github/workflows/deploy.yml` will automatically build and publish your site!

---

## ⚡ Deployment to Firebase Hosting

This project is pre-configured with `firebase.json` to publish the static app instantly.

### Step-by-Step Setup:
1. Install Firebase CLI globally (if you haven't already):
   ```bash
   npm install -g firebase-tools
   ```
2. Login to your Firebase account:
   ```bash
   firebase login
   ```
3. Initialize hosting and connect it to your Firebase Project:
   ```bash
   firebase init hosting
   ```
   *Note: Select your existing project, choose `.` (current directory) as your public directory, and configure as a single-page app (write `y` to rewrites).*
4. Deploy your website:
   ```bash
   firebase deploy --only hosting
   ```
