# UPHS Scan-in – setup (about 15 minutes)

GitHub stores the code. Vercel runs it (free). Neon stores the data (free).
No coding needed; you only copy and paste.

## Folder contents
- `public/index.html` – your app (the website)
- `api/` and `lib/` – the small server that handles login and saves data to Neon
- `package.json`, `vercel.json` – settings (leave as is)

## Step 1 – Neon (database)
1. Sign up at https://neon.tech and click **Create project** (any name).
2. On the project dashboard click **Connect**, then copy the **connection string**
   (starts with `postgresql://`). Keep it private. It is your `DATABASE_URL`.
   You do NOT need to create any tables. The app creates them automatically.

## Step 2 – GitHub (code)
1. Sign up at https://github.com and click **New repository**. Name it, choose **Private**, click Create.
2. Click **uploading an existing file**, drag in everything from this folder
   (`public`, `api`, `lib`, `package.json`, `vercel.json`, `.gitignore`), then **Commit changes**.
   Check that the folders `public`, `api` and `lib` show up in the repository.

## Step 3 – Vercel (hosting)
1. Sign up at https://vercel.com with **Continue with GitHub**.
2. Click **Add New → Project**, pick your repository, click **Import**.
3. Leave Framework Preset as **Other**. Open **Environment Variables** and add these four:

| Name | Value |
|---|---|
| `DATABASE_URL` | the Neon connection string from Step 1 |
| `SESSION_SECRET` | a random string of 40+ characters (use your password manager's generator) |
| `ADMIN_USERNAME` | the login name you want for the first administrator, e.g. `admin` |
| `ADMIN_PASSWORD` | a strong password, at least 10 characters |

4. Click **Deploy**. When it finishes, click the link Vercel gives you.

## Step 4 – First login
1. Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`. This creates the first Administrator.
2. Open the **Admin users** page and add accounts for everyone else.
3. Recommended: in Vercel go to **Settings → Environment Variables**, delete `ADMIN_PASSWORD`,
   then **Deployments → Redeploy**. It is only needed for the very first login.

## Updating the app later
Edit or replace a file in GitHub and commit. Vercel redeploys automatically.

## How access works
- Passwords are stored hashed in Neon, never in the page or browser.
- Login uses a secure session cookie (12 hours). 5 wrong passwords lock that account for 15 minutes.
- Gate Keeper accounts can only receive and save employees and scan logs.
  Standard User and Administrator can use all data. Only Administrators manage users.

## Good to know
- Each save sends a whole list, so if two people edit the same list at the same moment, the last save wins,
  and other people see changes after a page refresh.
- One save is limited to about 4.5 MB (roughly 30,000 scan logs).
- The built-in sample employees/logs were removed. Data typed into the old local file does not carry over;
  re-import it using the app's import buttons.
