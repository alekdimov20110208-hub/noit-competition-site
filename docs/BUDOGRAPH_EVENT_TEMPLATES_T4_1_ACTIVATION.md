# T4.1 — потвърждение от собственика и development activation

17 октомври 2026 г., Europe/Kyiv. **T4.1 LIVE BACKEND: ACTIVATED.**
**MIGRATION 0013: APPLIED. T4.1 HUMAN ACCEPTANCE: PASS 8/8 — owner-confirmed.**
Git базата остава `6d5beac648a26f43b8104e2ddc4fbc28e83c0c70`.
Activation е приключил без commit, push, публичен deployment или live Apply от Codex. Последвалата owner заявка потвърди T4.1 HUMAN PASS 8/8 и разреши отделен одитиран Git checkpoint.

## Изяснен preflight gate

Собственикът изрично потвърди, че операция
`e6879dd5-4e12-4ed3-aedf-f2fcb4215767` е неговият T3 тест, и нареди да се
запазят и петте задачи и да се продължи activation. Операцията е от
`2026-10-17T19:06:01.257Z` — 22:06:01 местно време.

Тя добавя две задачи от личен шаблон към Event
`84ab5c6f-0ed8-44fb-85f0-b38b030d8694`,
**DEMO — Templates T2 Acceptance — 20261017-A**.
Това е отделно потвърден owner тест, а не ново T4.1 приложение или основание
да се променя предишното T2 HUMAN PASS 6/6 или T3 HUMAN PASS 8/8.

| Операция                                                 | Брой Tasks | Task-created History | Aggregate History |
| -------------------------------------------------------- | ---------- | -------------------- | ----------------- |
| `577f6bd6-0165-40e6-ba0a-6c504ccd97aa` — оригинален T2   | 2          | 2                    | 1                 |
| `0df64db1-b07e-49c4-a12f-2ffbfdec2e18` — допълнителен T2 | 1          | 1                    | 1                 |
| `e6879dd5-4e12-4ed3-aedf-f2fcb4215767` — потвърден T3    | 2          | 2                    | 1                 |

Общо: **5 active Tasks / 3 receipts / 9 History entries**, включително
първоначалното EVENT_CREATED. Няма изтрити или неотчетени задачи.
Read-only проверката сравнява canonical съдържание, дати, часове и provenance
за оригиналните задачи и за двете задачи от owner-only личния blueprint.
Всички принадлежат на потвърдените операции и остават непокътнати.
Private template идентичността не се публикува в този отчет.

## Проверени identity, TLS и source gates

- Development connection fingerprint: **734663449f0e944e**.
- Project-reference fingerprint: **a90a1035b104d054**.
- PostgreSQL: **17.11**.
- TLS: **1.3**, encrypted, authorized certificate chain, hostname verification
  и `rejectUnauthorized=true` през съществуващия application pool factory.
- Реалните pools на стария и новия backend независимо потвърждават същите
  fingerprints и TLS настройки. Временните loopback inspectors са затворени.
- Имената и checksums на **0001–0012** съвпадат с HEAD и development history.
  Единствената pending миграция преди операцията е **0013**.
- Auth, trusted origins, environment файловете, CA и disabled development email
  mode са запазени. Reminder worker не е изключван.

Това доказва Node → Supabase pooler TLS. Не е отделна проверка на транспорта
между pooler-а и PostgreSQL.

## Ограничен recoverable backup

Преди миграцията е създаден нов consistent read-only backup чрез
**pg_dump 17.11**, libpq `verify-full` и съществуващия доверен CA.
Обхватът е application `public` schema/data, включително auth таблици и
schema_migrations. Supabase-managed schemas и global roles/ACL definitions
не са включени.

- Архив преди криптиране: **898 948 bytes / 164 TOC entries**.
- SHA-256: `a608fa03b20888793c1ef8187ce85d1cf38088cf9c5421a77842619620848462`.
- `pg_restore --list` и пълно декомпресиране към Windows NUL: **PASS**;
  не е изпълнен restore SQL.
- Windows **DPAPI CurrentUser** encryption и decrypt/hash round trip: **PASS**.
- Криптиран архив: **899 174 bytes**.
- ACL допуска само текущия Windows потребител и SYSTEM. Plaintext архивът
  е премахнат след успешна проверка на криптираното копие.
- **Restore rehearsal: NOT RUN.** За декриптиране трябва да се запази същият
  Windows account/profile; destructive restore не е изпълняван.

Recovery директория:
`C:\Users\Lenovo\.budograph\backups\t4-pre0013-20261017-44c2334ed4fc`.
Съдържа OWNER.json, archive-validation.json, encryption-proof.json,
`public-before-0013.dump.dpapi` и RECOVERY.txt с указания.

## Миграция и един контролиран restart

Прегледаната 0013 разширява само receipt identity CHECK с bounded curated IDs
при v1. Няма business-row update, backfill, нов каталог в базата или промени
на RLS, immutable trigger и останалите constraints.

Използван е стандартният migration CLI с непроменени environment inputs:

```powershell
node --env-file-if-exists=server/.env --env-file-if-exists=server/.env.p1b.local server/scripts/migrate.ts
```

Първо изпълнение: **1 applied / 12 already applied**.
Повторно изпълнение: **0 applied / 13 already applied**.
0013 SHA-256:
`447b94f4487f28715b374778d15f77a384640f54132090f3c9a5e6a314e9b1c1`.
След миграцията няма pending файлове; RLS, zero browser policies, immutable
trigger и всички unrelated constraints съвпадат с предишния snapshot.

Съществуващият backend е бил под вече стартиран Node --watch supervisor
**31648**, който по време на source работата автоматично е презареждал child-а.
Контролираният restart в тази continuation е **точно един**:

1. Реалният serving child **22076** е проверен по cwd/entry/TLS/fingerprints.
2. Чрез установената временна loopback inspector процедура е задействан
   съществуващият graceful SIGTERM handler. Inspector-ът е затворен, процесът
   е излязъл и порт 3001 е проверен като свободен.
3. След липса на serving child е спрян само watch supervisor-ът, за да няма
   автоматичен втори backend при редакции.
4. Стартиран е **един** non-watch replacement, PID **33112**, със същия
   Node executable, cwd, source entry и двата environment-file inputs.
5. Първата readiness проба е била непосредствено преди отварянето на listener-а;
   същият replacement е станал ready при ограниченото изчакване. Няма втори
   старт или restart loop.

**Vite остава PID 27776.** Vite и Supabase не са рестартирани.
Runtime directory:
`C:\Users\Lenovo\.budograph\runtime\t4-activation-20261017-51b793a3d3de`.

## Preservation и реални read-only smoke проверки

Repeatable-read snapshots преди миграцията и след restart/UI проверките
съвпадат по hash за **18 business/auth/private таблици**. schema_migrations е
проверена отделно за точно новата 0013; нормалните notification worker таблици
са изключени от статичния business snapshot.

- T2/T3 Event: **5 Tasks / 3 receipts / 9 History entries**, непроменени.
- B.1: същите Event/member, **4 Tasks**, **1 Change**, **3 links**, **7 History**.
- Личният каталог: **1 template / 1 version / 2 items / 1 Save receipt**.
- Няма нови live Tasks, templates, Events или application receipts.
- `/api/health/live` и `/ready`: **200**.
- Curated и private/source routes без сесия: **401**, `Cache-Control: no-store`.

В съществуващата signed-in BudoGraph browser сесия са проверени:

1. Реално зареждане на **12** curated cards.
2. Търсене „кантар“ с Tournament/Advanced филтри: **1** реален резултат.
3. Оригинален T1/T2 authoritative Preview: **4** items и правилните стари
   дати/часове; без потвърждение и Apply.
4. My Templates list/detail: запазеният private template с **2** items;
   authoritative Preview от същия service: **2**, confirmation unchecked.
5. Нов curated plan: избрани точно първите **2** items; server Review показва
   **30.10.2026** и **06.11.2026** за Event start **27.11.2026**, date-only,
   unassigned, unaccepted, not-started, no reminders. Confirmation е unchecked.
6. Връщане към Curated Library, **12/12** cards, без филтри — оставена отворена
   за собственика. **Codex не е изпълнил live Apply.**

Live UI проверката установи граматична двусмисленост при „1 дни / 1 days“.
Коригиран е само frontend BG/EN duration етикетът до формулировка, валидна за
всяко число. Backend/source content, environment и CA не са променени след
контролирания restart. От manifest-а на **383** файла **382** остават идентични;
единствената умишлена разлика е `src/i18n/curatedTemplateMessages.ts`.
Тя е проверена с нови frontend **328 PASS**, TypeScript, lint и build.
Vite е използвал съществуващия HMR; втори backend restart няма.

Предишните source acceptance резултати остават: backend **188 PASS / 42 DB skips**,
реален isolated PostgreSQL Templates **53 PASS**, Event Management **77 PASS**,
Chromium T4.1 **26 PASS**, T1/T2/T3 **34/29/7 PASS**, LOCKED **112/112 identical**.
Те не са представени като повторно изпълнени в тази activation continuation.
Новите проверки тук са actual migration/no-op/schema audit, backup, реален runtime
TLS/readiness, preservation и authenticated UI reads; frontend suite е повторена
след малката копирайт корекция. Известното предупреждение за JS chunk над 500 kB
остава. Scoped formatting и git diff whitespace са проверени отделно.

Evidence: `tmp/t4-activation-{preflight,post}.json`,
`tmp/t4-final-live-preservation.txt`, `tmp/t4-schema-{before,after}.json`,
`tmp/t4-development-migration-{first,noop}.txt`, `tmp/t4-runtime-activation.json`,
`tmp/t4-{before,new}-runtime-tls.txt`, `tmp/t4-activation-source-final-audit.json`,
`tmp/t4-activation-live/read-verification.json` и `library-ready.png`.
Backup proof файловете остават само в ограничената recovery директория.

## Лично приемане — PASS 8/8, owner-confirmed

Собственикът впоследствие лично одобри всичките 8 проверки, включително точно две задачи и срокове 2026-10-23 / 2026-10-30 в ново празно Event, един Apply с 2 нови Tasks и 3 History entries, както и запазени Built-in/My Templates. Точни IDs и момент на новия тест не са предоставени и не се измислят. Следва първоначалната процедура като исторически контекст; нов Apply не е необходим за checkpoint-а.

Собственикът може да отвори вече оставената Curated Library или:
`http://127.0.0.1:5173/events/84ab5c6f-0ed8-44fb-85f0-b38b030d8694/templates`
и да избере „Библиотека с готови шаблони“.

За действителния Apply използвайте **ново празно тестово Event**, например
**DEMO — T4.1 Library Review**, **20 ноември 2026**, Europe/Sofia.
То не е създадено от Codex. Не добавяйте тестови Tasks към B.1 или приетите T2/T3
Events. Изберете първите две задачи от „Първи еднодневен айкидо семинар“:
Review трябва да показва **23 и 30 октомври**, без час.
След личното потвърждение и един Apply очаквайте **точно 2 нови Tasks**, две
Task-created History entries и една TEMPLATE_APPLIED entry. Проверете refresh,
BG/EN, филтрите, keyboard/mobile и старите шаблони по осемте стъпки в
[T4.1 source report](BUDOGRAPH_EVENT_TEMPLATES_T4_1.md).

При activation това беше готовност за лично приемане. Последвалото owner потвърждение вече е **T4.1 HUMAN PASS — 8/8**.
T1/T2/T3 HUMAN PASS и Event Management Stages 1–7 остават PRESERVED.
Owner Human Acceptance вече е получено; текущата заявка разрешава одитиран Git checkpoint, без нови DB или runtime промени.

NOIT 2025–2026 остава историческият източник. Тук не се потвърждават официални
правила или срокове за 2026–2027; roadmap датите са вътрешни планови оценки.
