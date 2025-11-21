---
description: Host the application on GitHub Pages
---

1. Initialize a git repository in the project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: NeuroCardio MedVisualizer"
   ```

2. Create a new public repository on GitHub (https://github.com/new). Name it something like `med-visualizer`.
   - **Do not** initialize with README, .gitignore, or license (since we have local files).

3. Link your local repository to the remote GitHub repository and push:
   ```bash
   # Replace <USERNAME> with your GitHub username and <REPO_NAME> with your repository name
   git remote add origin https://github.com/<USERNAME>/<REPO_NAME>.git
   git branch -M main
   git push -u origin main
   ```

4. Configure GitHub Pages:
   - Go to your repository settings on GitHub.
   - Navigate to **Pages** (in the left sidebar).
   - Under **Source**, select `Deploy from a branch`.
   - Under **Branch**, select `main` and `/ (root)`.
   - Click **Save**.

5. Your site will be live at `https://<USERNAME>.github.io/<REPO_NAME>/` in a few minutes.
