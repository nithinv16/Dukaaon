# GitHub Repository Setup Guide

This guide will help you create a GitHub repository and upload your DukaaOn Website project.

## Prerequisites

- Git installed on your system
- GitHub account created
- GitHub CLI (optional but recommended) or web browser access

## Step 1: Create GitHub Repository

### Option A: Using GitHub Web Interface (Recommended for first-time users)

1. Go to [GitHub](https://github.com)
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Fill in the details:
   - **Repository name**: `dukaaon-website`
   - **Description**: `DukaaOn - Rural Retail Distribution Platform Website`
   - **Visibility**: Choose Private or Public
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"
6. Copy the repository URL (it will look like: `https://github.com/YOUR_USERNAME/dukaaon-website.git`)

### Option B: Using GitHub CLI

```bash
gh repo create dukaaon-website --public --description "DukaaOn - Rural Retail Distribution Platform Website"
```

## Step 2: Initialize Git Repository (if not already done)

Open your terminal in the `DukaaOnWebsite` directory and run:

```bash
# Navigate to the DukaaOnWebsite directory
cd DukaaOnWebsite

# Initialize git repository (if not already initialized)
git init

# Check current status
git status
```

## Step 3: Add Files to Git

```bash
# Add all files to staging
git add .

# Check what will be committed
git status

# Commit the files
git commit -m "Initial commit: DukaaOn website with Next.js, TypeScript, and Tailwind CSS"
```

## Step 4: Connect to GitHub Repository

Replace `YOUR_USERNAME` with your actual GitHub username:

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/dukaaon-website.git

# Verify remote was added
git remote -v
```

## Step 5: Push to GitHub

```bash
# Push to main branch
git push -u origin main
```

If you encounter an error about the branch name, you might need to rename it first:

```bash
# Rename branch to main (if it's currently master)
git branch -M main

# Then push
git push -u origin main
```

## Step 6: Verify Upload

1. Go to your GitHub repository URL
2. Refresh the page
3. You should see all your files uploaded

## Important Notes

### Environment Variables

Your `.env.local` file is already in `.gitignore` and won't be uploaded (this is correct for security).

**Remember to:**
1. Document required environment variables in `.env.example`
2. Set up environment variables in your deployment platform (Vercel, Netlify, etc.)

### Sensitive Files Already Ignored

The following are already in `.gitignore`:
- `/node_modules` - Dependencies
- `/.next/` - Build output
- `.env*.local` - Environment variables
- `*.tsbuildinfo` - TypeScript build info

## Common Issues and Solutions

### Issue: "fatal: remote origin already exists"

**Solution:**
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/dukaaon-website.git
```

### Issue: Authentication failed

**Solution:**
Use a Personal Access Token instead of password:
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate new token with `repo` scope
3. Use the token as your password when pushing

Or use SSH:
```bash
git remote set-url origin git@github.com:YOUR_USERNAME/dukaaon-website.git
```

### Issue: "Updates were rejected because the remote contains work"

**Solution:**
```bash
git pull origin main --rebase
git push -u origin main
```

## Future Updates

After the initial push, to update your repository:

```bash
# Check status
git status

# Add changed files
git add .

# Commit with a descriptive message
git commit -m "Description of changes"

# Push to GitHub
git push
```

## Recommended: Add Branch Protection

Once uploaded, consider:
1. Go to repository Settings > Branches
2. Add branch protection rule for `main`
3. Enable "Require pull request reviews before merging"

## Next Steps

After uploading to GitHub:

1. **Set up CI/CD**: Configure GitHub Actions for automated testing
2. **Deploy**: Connect to Vercel or Netlify for automatic deployments
3. **Documentation**: Keep README.md updated with setup instructions
4. **Collaboration**: Add team members as collaborators if needed

## Repository Structure

Your repository will include:
```
dukaaon-website/
├── app/                    # Next.js app directory
├── components/             # React components
├── lib/                    # Utility functions
├── hooks/                  # Custom React hooks
├── public/                 # Static assets
├── sql/                    # Database scripts
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── package.json           # Dependencies
├── README.md              # Project documentation
└── tailwind.config.ts     # Tailwind configuration
```

## Support

If you encounter any issues:
1. Check GitHub's [documentation](https://docs.github.com)
2. Review error messages carefully
3. Ensure you have the correct permissions
4. Verify your internet connection

---

**Created**: January 2025
**Project**: DukaaOn Website
**Tech Stack**: Next.js 14, TypeScript, Tailwind CSS, Supabase
