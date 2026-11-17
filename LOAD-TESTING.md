# Student load test

This guide walks through making a small, fake school in a separate test database and asking the app to handle many simulated student visits at once. You do not need to create class credentials or write SQL by hand: a generator makes the SQL and the matching login file for you.

> **Never run this against the real school app or production Supabase database.** The setup SQL creates classes and students in the database you run it against. Only use a separate test project with no real student data.

## What this test actually does

Each simulated person follows a student read-and-login flow:

1. Requests the app’s HTML page and its JavaScript/CSS assets.
2. Requests the list of available classes (`start_info`).
3. Logs into one of the generated test classes with its student password.
4. Downloads that class’s data (`alles`), chooses one of its fake students (`kies_leerling`), and downloads the data again.
5. About 15% of simulated people also request the optional class information page.
6. Every 50–75 seconds, checks whether class data changed (`ververs`). Every 2–6 minutes, requests the standings (`stand_dag_leagues`).
7. At the end, tries to log out and remove its temporary login session.

The report shows how many times each request ran, how many failed, and the median (p50) and slower-tail (p95) response time in milliseconds.

This is an HTTP/API load test, **not** 800 real browser windows. It does not render or click the interface, and does not test browser rendering, push notifications, image uploads, analytics, admin editing, Root tools, or changes to schedules/messages/points. The generated classes have fake student names, but no activities or announcements. So the test measures app delivery and the student login/data/refresh endpoints, not every feature of the school app.

## Before you start

You need:

- A separate, non-production Supabase project with this app’s database schema and migrations already installed.
- A non-production app deployment configured to use that same test Supabase project.
- Node.js, installed project dependencies (`npm install`), and permission from the people responsible for the test project.
- The test project’s public anon/publishable key. Never use a service-role key.

The generator only creates files on your computer; it does not connect to Supabase or run SQL for you. You will copy the generated setup SQL into the Supabase SQL Editor yourself.

## 1. Generate test classes and students

For example, to create 20 fake classes with 40 students in each (800 fake students total), run this from the repository folder:

```bash
npm run loadtest:generate -- --classes 20 --students-per-class 40
```

The generator creates a private local folder named `load-test-fixtures` containing:

- `setup.sql` — creates the fake classes and students, with randomly generated passwords.
- `participants.json` — the matching class slugs and student passwords used by the load runner.
- `cleanup.sql` — deletes only the classes created for this generation run, if you want to remove the test data later.

These files are ignored by Git because they contain passwords. Keep them private. You can choose a different output folder with `--output-dir`. It will not overwrite existing output files; choose an empty folder if you already generated fixtures.

You can choose other counts, but the total number of fake students is capped at 1000 and a class can have at most 35 students (the schema’s default per-class limit). For example, `--classes 10 --students-per-class 30` makes 300 fake students. If your test project has configured a lower per-class limit, choose a lower number. The generated classes and students are test data; the generator does not add activities, announcements, or scores.

## 2. Add the test data to Supabase

1. Double-check that you are signed into the **test** Supabase project, not production.
2. Open that project’s **SQL Editor**.
3. Open `load-test-fixtures/setup.sql` on your computer and copy all of it into a new SQL Editor query.
4. Run it once. It creates classes with slugs starting `loadtest-` and fake students named `Test student ...`.
5. Confirm the query succeeded before starting the load test.

If SQL reports a problem, stop and resolve it before running the load test. The SQL uses the project’s existing class/student helper functions, so the app schema and migrations need to be up to date first.

## 3. Start with a small load

Set the public key for the **test** project in your terminal, then run 20 simulated people for five minutes:

```bash
export LOADTEST_SUPABASE_KEY="your-test-project-public-key"
npm run loadtest -- \
  --app-url https://your-test-app.example \
  --supabase-url https://your-test-project.supabase.co \
  --participants ./load-test-fixtures/participants.json \
  --users 20 \
  --ramp-seconds 120 \
  --duration-seconds 300 \
  --confirm-nonproduction
```

Replace the example URLs with the test app and Supabase project URLs. The confirmation flag is required for every real run; it does not verify the URLs for you, so check them carefully. The load runner refuses remote HTTP URLs and refuses service-role keys.

The `--users` number is the number of simulated active student sessions, **not** the number of fake students created in setup. Sessions are spread across the classes and choose a fake student from that class; if there are fewer fake students than sessions, a student can be chosen more than once.

When the small run works, increase `--users` gradually. The default is 800 simulated sessions, a five-minute login ramp, and a 15-minute total run. The runner caps sessions at 800 and requires a ramp of at least two minutes. Coordinate larger tests with the people responsible for Supabase and Cloudflare.

Press Ctrl+C to stop early. The runner will try to log out active sessions. A failed logout can leave a temporary session until its normal expiry.

## 4. Read the results and clean up

The summary lists each operation, its request count, failures, p50, and p95. Failures mean an HTTP/API request failed; check the test project’s Supabase and hosting logs for details. The script does not print passwords, session tokens, or returned student data.

When finished, you can remove the generated classes from the **test project**:

1. Open `load-test-fixtures/cleanup.sql`.
2. Confirm you are still in the test project.
3. Run the SQL in Supabase’s SQL Editor.

The cleanup script filters on a unique run ID, so it only targets classes created by that one generator run. Keep the generated files until cleanup is complete.

## Useful commands

```bash
npm run loadtest:generate -- --help
npm run loadtest -- --help
```

Use the load runner’s `--dry-run` option to validate its URLs and participant file without sending requests.
