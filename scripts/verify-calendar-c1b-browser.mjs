import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export async function verifyCalendarReal({
  origin,
  credentials,
  fixture,
  month,
  day,
  admin,
}) {
  const { chromium } = await import(
    process.env.BUDOGRAPH_PLAYWRIGHT_MODULE
      ? pathToFileURL(process.env.BUDOGRAPH_PLAYWRIGHT_MODULE).href
      : "playwright"
  );
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BUDOGRAPH_BROWSER_EXECUTABLE
      ? { executablePath: process.env.BUDOGRAPH_BROWSER_EXECUTABLE }
      : {}),
  });
  const passed = [];
  const pageErrors = [];
  const external = [];
  const {
    shared,
    privateEvent,
    archived,
    timed,
    dateOnly,
    privateTask,
    archivedTask,
  } = fixture;
  const url = (event, view) => origin + `/events/${event.id}/${view}`;
  const api = (event) => origin + `/api/events/${event.id}/tasks`;
  const statusLabels = {
    "not-started": "Not started",
    blocked: "Blocked",
    "in-progress": "In progress",
    completed: "Completed",
  };
  const check = (label) => {
    passed.push(label);
    console.log("PASS " + label);
  };
  const [year, number] = month.split("-").map(Number);
  const boundary = new Date(Date.UTC(year, number - 1, 0, 22, 30));

  async function login(account, timezoneId, target = url(shared, "tasks")) {
    const context = await browser.newContext({
      timezoneId,
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => {
      const target = new URL(route.request().url());
      if (target.origin === origin) return route.continue();
      external.push(target.origin);
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.clock.setFixedTime(boundary);
    await page.goto(target);
    await page.evaluate(() =>
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language: "en", theme: "light" }),
      ),
    );
    await page.reload();
    await page.locator("#login-email").fill(account.email);
    await page.locator("#login-password").fill(account.password);
    const loginResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/sign-in/email",
    );
    await page.locator("button[type=submit]").click();
    assert.equal((await loginResponse).status(), 200);
    await page.locator(".app-shell").waitFor();
    const me = await context.request.get(origin + "/api/me");
    assert.equal(me.status(), 200);
    assert.equal((await me.json()).user.email, account.email);
    return { page, context };
  }

  async function readTasks(account, event) {
    const response = await account.context.request.get(api(event));
    assert.equal(response.status(), 200);
    return (await response.json()).tasks;
  }
  async function readStored(event) {
    const { rows } = await admin.query(
      "SELECT id,title,status, to_char(deadline,'YYYY-MM-DD') AS deadline, to_char(deadline_time,'HH24:MI') AS \"deadlineTime\",version FROM public.task WHERE event_id=$1 ORDER BY title",
      [event.id],
    );
    return rows;
  }
  const comparable = ({
    id,
    title,
    status,
    deadline,
    deadlineTime,
    version,
  }) => ({ id, title, status, deadline, deadlineTime, version });
  async function calendar(page, event) {
    await page.goto(url(event, "calendar"));
    await page.locator(".calendar-page__table").waitFor();
  }
  async function cell(page, task, deadline = task.date, time = task.time) {
    const button = page
      .locator(".calendar-page__tasks button")
      .filter({ hasText: task.title });
    await button.waitFor();
    assert.equal(
      await button
        .locator("xpath=ancestor::td")
        .locator(":scope > time")
        .getAttribute("datetime"),
      deadline,
    );
    if (time) {
      assert.equal(
        await button.locator("time").getAttribute("datetime"),
        `${deadline}T${time}`,
      );
      assert.equal(await button.locator("time").innerText(), time);
    } else assert.equal(await button.locator("time").count(), 0);
    return button;
  }
  async function detail(page, title) {
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    const deadline = page.locator(".task-progress-meta time");
    return {
      status: await page
        .locator(".task-drawer__badges .status-badge")
        .first()
        .innerText(),
      date: await deadline.getAttribute("datetime"),
      deadlineLabel: await deadline.innerText(),
    };
  }
  function mutation(page, path, method = "PATCH") {
    return page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === path &&
        response.request().method() === method,
    );
  }

  try {
    const signedOut = await fetch(api(shared));
    assert.equal(signedOut.status, 401);
    const organizer = await login(credentials[0], "Europe/Sofia");
    const weekLink = (event, date) =>
      url(event, "calendar") + "?view=week&date=" + date;
    const listLink = (event, date) =>
      url(event, "calendar") + "?view=list&date=" + date;
    const member = await login(
      credentials[1],
      "America/Los_Angeles",
      weekLink(shared, day(9)),
    );
    await member.page.waitForURL(weekLink(shared, day(9)));
    const agendaTask = (page, task) =>
      page
        .locator(".calendar-agenda__tasks button")
        .filter({ hasText: task.title });
    const agendaTime = async (page, task, date, time) => {
      const button = agendaTask(page, task);
      await button.waitFor();
      assert.equal(
        await button.locator("time").getAttribute("datetime"),
        date + "T" + time,
      );
      return button;
    };
    const activeView = (page, name) =>
      page.getByRole("button", { name, exact: true, pressed: true });
    const switchView = (page, name) =>
      page.getByRole("button", { name, exact: true }).click();

    const week = member.page;
    const weekTask = await agendaTime(week, timed, day(9), "00:15");
    const days = week.locator(".calendar-agenda__day h3");
    assert.deepEqual(await days.locator("span").allTextContents(), [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    assert.ok(
      await week
        .locator('.calendar-agenda__day[data-event-day="true"]')
        .count(),
    );
    assert.match(await weekTask.innerText(), /Not started/);
    assert.equal(await weekTask.locator(".status-badge").count(), 2);
    await week.getByRole("button", { name: "Next week" }).click();
    assert.equal(await agendaTask(week, timed).count(), 0);
    await week.getByRole("button", { name: "Previous week" }).click();
    await week.waitForURL(weekLink(shared, day(9)));
    await week.getByRole("button", { name: "Today", exact: true }).click();
    assert.equal(
      await week.locator('time[aria-current="date"]').getAttribute("datetime"),
      day(1),
    );
    await week.goBack();
    await week.waitForURL(weekLink(shared, day(9)));
    await week.goForward();
    await week.waitForURL(weekLink(shared, day(1)));
    await week.goBack();
    await week.waitForURL(weekLink(shared, day(9)));
    const listToggle = week.getByRole("button", { name: "List", exact: true });
    await listToggle.focus();
    await week.keyboard.press("Enter");
    await week.waitForURL(listLink(shared, day(9)));
    await week.reload();
    await activeView(week, "List").waitFor();
    assert.deepEqual(
      await week
        .locator(".calendar-agenda__day h3 time")
        .evaluateAll((elements) =>
          elements.map((el) => el.getAttribute("datetime")),
        ),
      [day(9), day(10)],
    );
    const assigned = await agendaTime(week, timed, day(9), "00:15");
    assert.match(await assigned.innerText(), /Calendar member/);
    assert.equal(await agendaTask(week, dateOnly).locator("time").count(), 0);
    assert.match(
      await agendaTask(week, dateOnly).innerText(),
      /No time set.*Blocked/s,
    );
    await assigned.click();
    assert.equal((await detail(week, timed.title)).status, "Not started");
    assert.equal(
      await week
        .locator(".task-status-select, .task-assignment-select")
        .count(),
      0,
    );
    await week.keyboard.press("Escape");
    assert.equal(
      await assigned.evaluate((el) => el === document.activeElement),
      true,
    );
    await switchView(week, "Month");
    await activeView(week, "Month").waitFor();
    assert.equal(new URL(week.url()).searchParams.get("date"), day(9));
    await cell(week, timed);
    check(
      "Week/List real data, deep link through login, keyboard switch, history and read-only details",
    );
    const actorEvents = await Promise.all(
      [organizer, member].map(async (actor) => {
        const response = await actor.context.request.get(
          origin + "/api/events",
        );
        assert.equal(response.status(), 200);
        return (await response.json()).events;
      }),
    );
    assert.equal(
      actorEvents[0].find((event) => event.id === shared.id).membership
        .accessRole,
      "ORGANIZER",
    );
    assert.equal(
      actorEvents[1].find((event) => event.id === shared.id).membership
        .accessRole,
      "MEMBER",
    );
    assert.ok(!actorEvents[1].some((event) => event.id === privateEvent.id));
    check(
      "Genuine Better Auth sessions, distinct Event roles and signed-out denial",
    );

    const canonical = (await readStored(shared)).map(comparable);
    for (const actor of [organizer, member]) {
      const rows = await readTasks(actor, shared);
      assert.deepEqual(
        rows.map(comparable).sort((a, b) => a.title.localeCompare(b.title)),
        canonical,
      );
      for (const task of [timed, dateOnly]) {
        await actor.page.goto(url(shared, "tasks") + "?task=" + task.id);
        const fromTasks = await detail(actor.page, task.title);
        assert.equal(fromTasks.status, statusLabels[task.status]);
        assert.equal(fromTasks.date, task.date);
        await calendar(actor.page, shared);
        assert.equal(
          await actor.page.locator(".calendar-page__tasks button").count(),
          2,
        );
        await (await cell(actor.page, task)).click();
        assert.deepEqual(await detail(actor.page, task.title), fromTasks);
        assert.equal(
          await actor.page
            .locator(
              ".task-status-select, .task-assignment-select, .task-authoring-form",
            )
            .count(),
          0,
        );
        assert.equal(
          await actor.page
            .getByRole("button", { name: "Edit task details", exact: true })
            .count(),
          0,
        );
      }
      assert.equal(
        await actor.page
          .locator('time[aria-current="date"]')
          .getAttribute("datetime"),
        day(1),
      );
    }
    check(
      "Organizer and Member see matching persisted Tasks, dates and statuses; Calendar details are read-only",
    );
    check(
      "Sofia month boundary, wall time and date-only deadlines survive a different browser timezone",
    );

    await calendar(organizer.page, privateEvent);
    await cell(organizer.page, privateTask);
    assert.equal(
      await organizer.page.locator(".calendar-page__tasks button").count(),
      1,
    );
    assert.equal(
      (await member.context.request.get(api(privateEvent))).status(),
      404,
    );
    await member.page.goto(url(privateEvent, "calendar"));
    await member.page
      .getByRole("alert")
      .filter({ hasText: "This event is not available to you." })
      .waitFor();
    assert.equal(
      await member.page.getByText(privateTask.title, { exact: true }).count(),
      0,
    );
    check(
      "Organizer-only Event is isolated in API, Event list and Calendar deep link",
    );

    const taskPath = `/api/events/${shared.id}/tasks/${timed.id}`;
    await member.page.goto(url(shared, "tasks") + "?task=" + timed.id);
    await member.page.locator(`#drawer-status-${timed.id}-trigger`).click();
    const memberStatus = mutation(member.page, taskPath + "/status");
    await member.page
      .getByRole("option", { name: "In progress", exact: true })
      .click();
    assert.equal((await memberStatus).status(), 200);
    await member.page
      .locator(".task-drawer__badges .status-badge")
      .first()
      .filter({ hasText: "In progress" })
      .waitFor();
    await calendar(member.page, shared);
    await (await cell(member.page, timed)).click();
    assert.equal(
      (await detail(member.page, timed.title)).status,
      "In progress",
    );
    await member.page.keyboard.press("Escape");

    const weekSnapshot = await member.context.newPage();
    const listSnapshot = await member.context.newPage();
    for (const snapshot of [weekSnapshot, listSnapshot]) {
      snapshot.on("pageerror", (error) => pageErrors.push(error.message));
    }
    await Promise.all([
      weekSnapshot.goto(weekLink(shared, day(12))),
      listSnapshot.goto(listLink(shared, day(12))),
    ]);
    await agendaTime(listSnapshot, timed, day(9), "00:15");
    const firstWeekDay = await weekSnapshot
      .locator(".calendar-agenda__day h3 time")
      .first()
      .getAttribute("datetime");
    if (day(9) >= firstWeekDay) {
      await agendaTime(weekSnapshot, timed, day(9), "00:15");
    } else {
      assert.equal(await agendaTask(weekSnapshot, timed).count(), 0);
    }

    await organizer.page.goto(url(shared, "tasks") + "?task=" + timed.id);
    await organizer.page
      .getByRole("button", { name: "Edit task details", exact: true })
      .click();
    await organizer.page.locator("#task-author-deadline").fill(day(12));
    await organizer.page.locator("#task-author-deadlineTime").fill("23:40");
    const edited = mutation(organizer.page, taskPath);
    await organizer.page
      .locator(".task-authoring-form button[type=submit]")
      .click();
    assert.equal((await edited).status(), 200);
    const persisted = (await readStored(shared)).find(
      (row) => row.id === timed.id,
    );
    assert.equal(persisted.status, "in-progress");
    assert.equal(persisted.deadline, day(12));
    assert.equal(persisted.deadlineTime, "23:40");
    const refreshed = member.page.waitForResponse(
      (response) =>
        response.url() === api(shared) && response.request().method() === "GET",
    );
    await member.page
      .getByRole("button", { name: "Refresh calendar", exact: true })
      .click();
    assert.equal((await refreshed).status(), 200);
    await (await cell(member.page, timed, day(12), "23:40")).click();
    assert.equal(
      (await detail(member.page, timed.title)).status,
      "In progress",
    );
    await member.page.reload();
    await cell(member.page, timed, day(12), "23:40");
    check(
      "Member status and Organizer deadline edits through Tasks persist in PostgreSQL and reach Calendar on refresh",
    );

    for (const snapshot of [weekSnapshot, listSnapshot]) {
      const loaded = snapshot.waitForResponse(
        (response) =>
          response.url() === api(shared) &&
          response.request().method() === "GET",
      );
      await snapshot
        .getByRole("button", { name: "Refresh calendar", exact: true })
        .click();
      assert.equal((await loaded).status(), 200);
      const row = await agendaTime(snapshot, timed, day(12), "23:40");
      assert.match(await row.innerText(), /In progress/);
      await snapshot.close();
    }
    check(
      "Week and List refresh the same persisted Tasks edit already verified in Month",
    );

    const unassigned = (await readTasks(member, shared)).find(
      (row) => row.id === dateOnly.id,
    );
    const denied = await member.context.request.patch(
      api(shared) + `/${dateOnly.id}/status`,
      {
        headers: { origin },
        data: { status: "completed", expectedVersion: unassigned.version },
      },
    );
    assert.equal(denied.status(), 403);
    assert.equal(
      (await readStored(shared)).find((row) => row.id === dateOnly.id).status,
      "blocked",
    );
    check("Member cannot change an unassigned task");

    for (const actor of [organizer, member]) {
      await calendar(actor.page, archived);
      await (await cell(actor.page, archivedTask)).click();
      const archivedCalendar = await detail(actor.page, archivedTask.title);
      assert.equal(archivedCalendar.status, "Completed");
      await actor.page.goto(
        url(archived, "tasks") + "?task=" + archivedTask.id,
      );
      assert.deepEqual(
        await detail(actor.page, archivedTask.title),
        archivedCalendar,
      );
      assert.equal(
        await actor.page
          .locator(".task-status-select, .task-assignment-select")
          .count(),
        0,
      );
      assert.equal(
        await actor.page
          .getByRole("button", { name: "Edit task details", exact: true })
          .count(),
        0,
      );
    }
    const archivedDto = (await readTasks(organizer, archived))[0];
    const rejected = await organizer.context.request.patch(
      api(archived) + `/${archivedTask.id}/status`,
      {
        headers: { origin },
        data: { status: "blocked", expectedVersion: archivedDto.version },
      },
    );
    assert.equal(rejected.status(), 403);
    assert.equal((await rejected.json()).code, "EVENT_ARCHIVED");
    assert.equal((await readStored(archived))[0].status, "completed");
    check(
      "Archived Event remains readable for both roles; Organizer write rejected",
    );

    for (const link of [weekLink, listLink]) {
      await member.page.goto(link(privateEvent, day(9)));
      await member.page
        .getByRole("alert")
        .filter({ hasText: "This event is not available to you." })
        .waitFor();
      assert.equal(await agendaTask(member.page, privateTask).count(), 0);
      for (const actor of [organizer, member]) {
        await actor.page.goto(link(archived, archivedTask.date));
        await agendaTask(actor.page, archivedTask).click();
        assert.equal(
          (await detail(actor.page, archivedTask.title)).status,
          "Completed",
        );
        assert.equal(
          await actor.page
            .locator(".task-status-select, .task-assignment-select")
            .count(),
          0,
        );
        assert.equal(
          await actor.page
            .getByRole("button", { name: "Edit task details", exact: true })
            .count(),
          0,
        );
      }
    }
    check(
      "Week and List preserve private Event isolation and archived read-only access for both roles",
    );

    await member.page.setViewportSize({ width: 320, height: 850 });
    await member.page.evaluate(() =>
      localStorage.setItem(
        "budograph.preferences.v1",
        JSON.stringify({ version: 1, language: "bg", theme: "dark" }),
      ),
    );
    await calendar(member.page, shared);
    await member.page
      .getByRole("heading", { name: "Календар", exact: true })
      .waitFor();
    assert.equal(
      await member.page.locator("html").getAttribute("data-theme"),
      "dark",
    );
    await cell(member.page, timed, day(12), "23:40");
    assert.equal(
      await member.page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.equal(
      await member.page
        .locator(".calendar-page__scroll")
        .evaluate((el) => el.scrollWidth > el.clientWidth),
      true,
    );
    check(
      "BG dark mobile Calendar retains real data and scrolls inside the grid",
    );

    await member.page.goto(weekLink(shared, day(12)));
    for (const label of ["Седмица", "Списък"]) {
      await switchView(member.page, label);
      await activeView(member.page, label).waitFor();
      const row = await agendaTime(member.page, timed, day(12), "23:40");
      assert.equal(
        await row.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return (
            rect.left >= 0 &&
            rect.right <= innerWidth &&
            el.scrollWidth <= el.clientWidth
          );
        }),
        true,
      );
      assert.equal(
        await member.page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.equal(
        await member.page.locator("html").getAttribute("data-theme"),
        "dark",
      );
    }
    await switchView(member.page, "Месец");
    await cell(member.page, timed, day(12), "23:40");
    check(
      "320 px BG dark layout switches among all three Calendar views without document overflow",
    );

    assert.deepEqual(pageErrors, []);
    assert.deepEqual(external, []);
    assert.equal(
      (
        await admin.query(
          "SELECT count(*)::int AS count FROM budograph_private.email_outbox",
        )
      ).rows[0].count,
      0,
    );
    console.log(
      JSON.stringify({
        status: "PASS",
        scenarios: passed.length,
        pageErrors: 0,
        externalRequests: 0,
        emailOutboxJobs: 0,
        realPostgreSQL: true,
        realBetterAuth: true,
      }),
    );
  } finally {
    await browser.close();
  }
}
