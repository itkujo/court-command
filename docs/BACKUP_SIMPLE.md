# How to Back Up and Restore Court Command

This guide explains how to save your data and get it back if something goes wrong. You do not need to be a programmer to follow these steps.

---

## What You Need

- A computer with Court Command already running
- The Terminal app (on Mac, search "Terminal" in Spotlight)
- Your project folder open in Terminal

To open Terminal in the right folder:
1. Open Terminal
2. Type `cd ` (with a space after it)
3. Drag the `new-cc` project folder from Finder into the Terminal window
4. Press Enter

You should see something like:
```
phoenix@computer new-cc %
```

---

## How to Save a Backup

A backup is a copy of all your data. Think of it like taking a photo of your notebook before you erase the whiteboard.

### Save just the database (scores, players, teams, tournaments)

Type this and press Enter:

```
make backup
```

You will see a message like:
```
Database backed up to backups/db-20260417-143022.sql
```

That file is your backup. The numbers are the date and time (year-month-day-hour-minute-second).

### Save everything (database + uploaded logos and photos)

Type this and press Enter:

```
make backup-full
```

This saves two files:
- One for the database (the `.sql` file)
- One for uploaded images (the `.tar.gz` file)

### When should I make a backup?

- **Before every update.** Before you pull new code or restart things, always back up first.
- **Before deleting anything.** If you are about to remove players, teams, or tournaments, back up first.
- **Once a day** if your system is live and people are using it.

---

## How to See Your Backups

Type this and press Enter:

```
make backup-list
```

You will see a list of all your saved backups with their sizes:

```
Available backups in backups/:
  118K  db-20260417-143022.sql
  3.3M  uploads-20260417-143022.tar.gz
```

---

## How to Restore a Backup (Get Your Data Back)

If something went wrong and you need to go back to how things were before:

### Step 1: Find the backup you want

```
make backup-list
```

Pick the file from the date and time you want to go back to.

### Step 2: Restore the database

Type this, replacing the file name with the one you picked:

```
make restore-db FILE=backups/db-20260417-143022.sql
```

The system will ask you to confirm:

```
This will REPLACE all current data with the backup. Type YES to confirm:
```

Type `YES` (all capital letters) and press Enter.

### Step 3: Restore uploaded images (if needed)

If you also saved images with `make backup-full`, you can restore those too:

```
make restore-uploads FILE=backups/uploads-20260417-143022.tar.gz
```

### Step 4: Restart the backend

```
make dev
```

Then in the `backend` folder:

```
cd backend
go run .
```

Your data is now back to how it was when you made that backup.

---

## Important Rules (Please Read)

### Rule 1: Never type `-v` when stopping Docker

When you stop the system, use this (safe):

```
docker compose down
```

**Never** use this (deletes all your data):

```
docker compose down -v
```

The `-v` means "delete everything." Only use it if you truly want to start from zero.

### Rule 2: Always back up before updating

Before you update the code or restart the system:

```
make backup
```

This takes 2 seconds and could save you hours of lost work.

### Rule 3: Keep your backups somewhere else too

The `backups/` folder is on your computer. If your computer breaks, those backups are gone too. Copy your backup files to:
- A USB drive
- Google Drive, Dropbox, or iCloud
- Another computer

---

## Quick Reference Card

| What you want to do | What to type |
|---------------------|-------------|
| Save the database | `make backup` |
| Save database + images | `make backup-full` |
| See all your backups | `make backup-list` |
| Restore the database | `make restore-db FILE=backups/THE-FILE-NAME.sql` |
| Restore images | `make restore-uploads FILE=backups/THE-FILE-NAME.tar.gz` |
| Start the system (dev) | `make dev` |
| Stop the system safely | `docker compose down` |

---

## If Something Goes Wrong

### "I accidentally deleted data"

1. `make backup-list` to find your latest backup
2. `make restore-db FILE=backups/PICK-THE-FILE.sql` to restore it
3. Restart the backend

### "The system won't start after an update"

1. `make restore-db FILE=backups/PICK-THE-FILE.sql` to go back to the old data
2. Switch back to the old code: `git checkout PREVIOUS-COMMIT`
3. Restart everything

### "I don't have any backups"

If you never made a backup and data is lost, it cannot be recovered. The system can recreate the empty tables (just restart the backend), but all players, teams, scores, and tournaments will be gone.

**This is why backing up matters.** Two seconds of `make backup` can save everything.

---

## For the Tech-Savvy (Optional Reading)

- Backups are plain SQL files. You can open them in a text editor to see what's inside.
- The database is PostgreSQL 17 running in Docker. Data lives in a Docker volume called `courtcommand-data`.
- Migrations (schema changes) run automatically when the backend starts. Your data rows are never touched by migrations.
- For production servers, set up a daily automatic backup using cron. See `docs/DATABASE_GUIDE.md` for the full technical guide.
