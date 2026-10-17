# BudoGraph — Event Templates T4.1

## Окончателно лично приемане — T4.1 HUMAN PASS 8/8

**T4.1 HUMAN PASS — 8/8, owner-confirmed, 17 октомври 2026 г.**
Собственикът лично изпълни и одобри осемте проверки:

1. Всичките 12 нови curated шаблона се показват в библиотеката.
2. Реалното търсене работи правилно.
3. Филтрите за категория и сложност работят.
4. BG/EN имена, описания и съдържание на задачите са подходящи.
5. Подробният план и всичките 8 задачи на еднодневния айкидо шаблон се показват правилно.
6. В ново празно тестово Event изборът на точно 2 задачи и Review показва срокове **2026-10-23** и **2026-10-30**.
7. Един лично потвърден Apply създава **точно 2 нови Tasks и 3 History entries от операцията**.
8. Built-in и My Templates остават функционални, без очевидни UI регресии.

Това е авторитетното лично приемане от собственика, отделно от по-ранните
автоматични и isolated SQL проверки. Codex не изпълнява този Apply от негово име.
Точните нови Event/Task/operation IDs, момент на Apply и нови screenshots не са
предоставени в това потвърждение и не се извеждат по предположение.

Има **13 curated system templates общо**: 12 нови BG/EN плана с **108 Tasks**,
плюс оригиналния starter с непроменени 4 задачи. Миграция 0013 е приложена в
development и контролираният backend activation е завършен. T1/T2/T3 HUMAN PASS,
B.1 и LOCKED Event Management Stages 1–7 са запазени. Продуктовата пътна карта е
създадена с вътрешни планови оценки, а не официален NOIT график.

Текущата owner заявка изрично разрешава одитиран commit и normal push на приетия
T4.1 checkpoint. T4.2 и другите бъдещи направления не са започнати.

Начало: 17 октомври 2026 г. Приета Git база:
`6d5beac648a26f43b8104e2ddc4fbc28e83c0c70`.
**Development update:** migration 0013 е APPLIED и T4.1 backend е ACTIVATED след owner потвърждение на допълнителната T3 операция. Петте Tasks / трите receipts са запазени. [Подробен activation отчет](BUDOGRAPH_EVENT_TEMPLATES_T4_1_ACTIVATION.md). T4.1 HUMAN ACCEPTANCE: PASS 8/8 — owner-confirmed.

T1 HUMAN PASS 6/6, T2 HUMAN PASS 6/6, T3 HUMAN PASS 8/8 са предишни приемания
на собственика; не се представят като ново лично тестване.

## Обхват и каталог

Новата Curated Library е отделна от Built-in и My Templates. Оригиналният
`international-aikido-seminar`, v1, запазва своите четири задачи, ред, BG/EN
формулировки, времена и поведение. Новите **12** системни шаблона са v1 и
съдържат общо **108** реални задачи. Броят на задачите в API и картите се
изчислява от съдържанието. Няма фиктивни проучвания, измислени потребителски
резултати или импорт на външни checklist текстове.

| Stable ID                               | BG име / EN име                                                                            | Ниво     | Задачи | Отмествания в дни |
| --------------------------------------- | ------------------------------------------------------------------------------------------ | -------- | ------ | ----------------- |
| `curated-aikido-first-day`              | Първи еднодневен айкидо семинар / First one-day Aikido seminar                             | Beginner | 8      | −28…+1            |
| `curated-aikido-local`                  | Местен айкидо семинар / Local Aikido seminar                                               | Standard | 9      | −42…0             |
| `curated-aikido-international-full`     | Международен айкидо семинар — цялостен план / International Aikido seminar — comprehensive | Advanced | 14     | −90…0             |
| `curated-aikido-kyu-examination`        | Изпит за кю по айкидо / Aikido kyu examination                                             | Standard | 8      | −42…+1            |
| `curated-aikido-dan-preparation`        | Подготовка за изпит за дан по айкидо / Aikido dan examination preparation                  | Advanced | 8      | −90…0             |
| `curated-weekend-training-camp`         | Уикенд тренировъчен лагер / Weekend martial-arts training camp                             | Advanced | 10     | −60…+3            |
| `curated-dojo-open-day`                 | Отворени врати и демонстрация в доджото / Dojo open day and demonstration                  | Beginner | 8      | −28…+2            |
| `curated-guest-instructor-logistics`    | Логистика за гост-инструктор / Guest instructor logistics                                  | Standard | 8      | −42…0             |
| `curated-local-martial-arts-tournament` | Местен турнир по бойни изкуства / Local martial-arts tournament                            | Advanced | 11     | −60…+2            |
| `curated-multi-club-workshop`           | Съвместна спортна работилница на няколко клуба / Multi-club sports workshop                | Standard | 8      | −42…+2            |
| `curated-guest-speaker-workshop`        | Образователна работилница с гост-лектор / Educational workshop with a guest speaker        | Beginner | 7      | −28…+2            |
| `curated-two-day-training-course`       | Двудневен обучителен курс / Two-day training course                                        | Standard | 9      | −42…+3            |

Всеки шаблон има отделни BG/EN name, description и audience: за кого е
подходящ и кога се използва. Audience е видим в подробния план. Нивата са
редакционна оценка за организацията, не степен на бойно майсторство. Не се
публикува непроверена оценка за човекочасове. Beginner плановете умишлено
са с различен брой задачи.

## Редакционен checklist и преглед

| Проверка                                      | Резултат и основание                                                                                                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Конкретна аудитория и отделна практическа цел | PASS — audience и description за всички 12; семинар, изпит, лагер, демонстрация, логистика, турнир, работилница и курс имат отделни процеси.                                                                                       |
| 6–18 смислени задачи без пълнеж               | PASS — 7–14; уникални заглавия вътре във всеки план; всяка задача произвежда договореност, проверка, инструкция или приключване.                                                                                                   |
| Stable ID/version и ред                       | PASS — `curated-` namespace, v1, стабилни item slugs; canonical selection следва сървърния ред. Промяна на публикувано съдържание изисква нова версия и поддръжка на старите receipts.                                             |
| Самостоятелни BG/EN текстове                  | PASS — авторски превод на всички metadata/title/category/context, автоматични проверки за попълване и различия, редакционен прочит на текста. Това не е отделно експертно dojo или собственическо приемане.                        |
| Реалистични приоритети                        | PASS — normal и important; critical не е използван за обикновено планиране.                                                                                                                                                        |
| Съобразени айкидо термини                     | PASS — айкидо, кю, дан, уке, доджо и татами са използвани по контекст; турнирът не се представя като айкидо състезание.                                                                                                            |
| Без измислени правила и лични факти           | PASS — организации/инструктори потвърждават изпитни правила, документи, такси и изисквания; действителни маршрути и настаняване се уточняват. Няма имена, суми, полети или гарантирани квалификации.                               |
| Обосновани подготвителни срокове              | PASS — дългите срокове са за покани, компетентни лица/зала/документи; средните — записване/програма/логистика; последните дни — повторна проверка/инструкции/готовност. Положителните дни са втори ден или последващо приключване. |
| Неизвестен час остава null                    | PASS — всички нови 108 задачи са date-only. Няма универсален оправдан час за тези сценарии; старите T1 15:00/08:30 остават непроменени.                                                                                            |
| Употреба при друга продължителност            | PASS — durationDays и видимо предупреждение при несъответствие. Задачите са спрямо началото, не спрямо края; не се скъсяват или местят тихо.                                                                                       |
| Лиценз и произход                             | PASS — нов авторски текст, source/CSS в GPL-3.0-only; без нови зависимости или външни assets.                                                                                                                                      |

Сроковете са **редакционни предложения**, не Event дати или официални крайни
срокове. За изпит с по-ранен официален срок той има предимство. При друга
продължителност, маршрут или вече извършена подготовка организаторът изключва
неподходящите задачи и при нужда създава/редактира своите нормални Tasks.
Шаблонът за дан е привързан към началната дата на действителния изпит.

## Архитектура и граници

`server/src/templates/curated.ts` е единственият автор на новото съдържание.
Runtime validation проверява всяка версия, ID, граници и двете локализации чрез
съществуващия Task parser; каталогът се замразява рекурсивно при зареждане.
Той не се съхранява в PostgreSQL и не съдържа private IDs или Event данни.

`GET /api/templates/curated` изисква текущ активен автентикиран акаунт, отхвърля
query параметри и връща `Cache-Control: no-store`. DTO има `catalogVersion: 1`
и `templates`, с реалните itemCount и blueprints. Frontend валидира стриктно
allowlisted полета, namespace, версии, уникалност, граници, категории/нива,
преводи, optional HH:mm и празни reminders. Няма второ ръчно копие на 108 задачи.

Системният resolver избира оригиналния starter или конкретния curated slug.
UUID идентичностите остават owner-only през T3 lookup. Новите планове използват
същите `/api/events/:eventId/templates/preview` и `/apply`, транзакция, advisory
lock, Event/member/user locks, Review revision, server date resolution, Task
primitive, ActivityEntries и durable receipt. Клиентът изпраща само identity,
version, selected IDs, language и Review/confirmation metadata — никога trusted
Task fields. Member preview и archived read-only са запазени.

Frontend Review сравнява всяко canonical поле с валидирания API blueprint.
Recovery валидира bounded `curated-` identity/item slugs и v1 без да изисква
успешно повторно зареждане на каталога; сървърът отново проверява реалния каталог
и правата. Подсказките остават scoped по user/Event. Ако е отворен друг шаблон,
недовършената операция е обозначена с първоначалния ID и се възстановява със
същия key/payload. Нова операция не се създава тихо.

History показва проверените системни IDs, version и operation. Private
provenance продължава да е `private-template`, без личен ID/име/описание.
Matching-name предупреждението използва реалните локализирани заглавия и
активните Tasks в destination Event; то не е семантично откриване на дубликати.

UI предлага търсене с всички въведени думи в локализирани metadata и реалния
Task текст, комбинирани category/difficulty филтри, реални бройки, подробен план,
select all/none, календарна дата за всяка задача, explicit Review/Apply,
success и History. Смяна на template или destination монтира нова селекция;
смяна на език запазва селекцията, но изисква актуален Review/confirmation.
Няма промени в Dashboard или глобални input компоненти.

## Миграция 0013

`0013_curated_template_catalog.sql` променя само receipt identity CHECK.
Допуска стария starter/v1, bounded syntactic `curated-…`/v1 и съществуващите
лични UUID/версии. Съществуващият outcome CHECK от 0012 вече допуска до 50
задачи за non-starter IDs, затова не е необходимо да се заменя.
Runtime catalog membership остава авторитетен; синтактично допустим неизвестен
slug не може да бъде приложен през API. Няма нови таблици, catalog records,
backfill, business UPDATE/DELETE, промени на RLS, privileges или immutable trigger.
Миграции 0001–0012 остават непроменени.

## Проверки и evidence

Това са новоизпълнени проверки в T4.1, отделни от историческите T3 резултати:

- Frontend unit: **328 PASS / 0 FAIL / 0 SKIP**.
- Backend default: **188 PASS / 0 FAIL / 42 opt-in DB SKIP**.
- Реален PostgreSQL Templates T2/T3/T4: **53 PASS / 0 FAIL / 0 SKIP**.
- Реален PostgreSQL Event Management: **77 PASS / 0 FAIL / 0 SKIP**.
- Отделна pre0013 migration проверка: създадени starter и personal receipts,
  личен blueprint; 0013 **1 applied / 12 existing**, повторение **0 / 13**;
  всички business таблици са hash-identical и старите receipts се replay-ват.
- TypeScript frontend/backend, lint и двата build: PASS. Frontend main chunk
  остава над 500 kB; това е известна build препоръка, не е скрито като липсващо предупреждение.
- Chromium T4.1: **26 PASS**; T1/T2/T3: **34/29/7 PASS**. Нулеви неочаквани API заявки и page errors. **112/112 LOCKED сравнения са pixel-identical**, оригиналните baselines не са обновявани; 2 deliberate-change controls са открити.

Изолираната инфраструктура е съществуващият PostgreSQL **17.11**, cluster
`7697374354312044444`, `127.0.0.1:55432`, owned directory
`BudoGraph-T2-PostgreSQL17-eb975bcf9737`. Преди fixtures бяха проверени OWNER
marker, реалната data directory, version, system identifier, listen_addresses,
loopback endpoint и отделен несуперпотребителски runner/owner. Използва се нова
disposable T4 база. Shared Supabase никога не се подава на test fixtures.

Ignored evidence: `tmp/t4-{frontend-tests,backend-tests,real-postgres,real-event-regressions}.txt`,
`tmp/t4-isolation-proof.json`, `tmp/t4-migration-preservation.json`,
`tmp/templates-t4/`. За SQL използвайте само guarded isolated environment
`BUDOGRAPH_T2_ISOLATED_DATABASE_URL` и съответното `…DB_CONFIRM`.
`pnpm server:test:templates-isolated` не чете development `.env`.

## Процедура за приемане — изпълнена от собственика

Долният списък е първоначалната процедура, запазена за повторяемост. Всичките осем проверки вече са лично потвърдени PASS от собственика; не се изисква нов Apply за Git checkpoint-а.

След успешна activation проверка собственикът може да създаде ново празно тестово
Event, например **DEMO — T4.1 Library Review**, **20 ноември 2026**, Europe/Sofia.
Това е предложение, не автоматично създадено или попълнено събитие. Не използвайте
B.1 или приетите T1/T2/T3 Events за нов Apply.

1. Отворете Templates и проверете Built-in, Curated Library и My Templates.
2. В библиотеката потърсете „татами“ или „кантар“; проверете и комбинация на
   category/difficulty. Пробвайте липсващ резултат и изчистване.
3. Прочетете BG/EN име, описание, предназначение и задачите на избран план.
4. Отворете „Първи еднодневен айкидо семинар“. При начало 20 ноември първите
   две задачи са 23 и 30 октомври, без час. Това са подготвителни Tasks.
5. Изберете само тях, поискайте Review и проверете точно 2 задачи, Event,
   дати, category, priority, context, null assignees, not-started и no reminders.
6. **Лично** потвърдете и приложете веднъж. Изчакайте server success, отворете
   Tasks и History: точно 2 нови Tasks, 2 `task.created` и 1 `TEMPLATE_APPLIED`.
7. Проверете refresh, BG/EN, теми и keyboard/mobile, както и оригиналния
   starter и личните шаблони. Те не трябва да са променени от новия Apply.
8. Запишете отделно **T4.1 HUMAN PASS / FAIL**. При неясен отговор възстановете
   съществуващата операция; отделен нов Apply умишлено създава допълнителни Tasks.

Codex не изпълнява live Apply от името на собственика. По време на source/activation не е имало commit или push; след вече потвърдения HUMAN PASS текущата owner заявка разрешава отделния Git checkpoint.

## Състезателна рамка и ограничения

Прочетени са AGENTS.md, целият master prompt, 30-те страници на предоставения
регламент, T1–T3 source/activation records, migrations и actual source/tests.
Приложимата историческа рамка изисква самостоятелен завършен продукт, source,
GPLv3, лицензирани ресурси, документация, сигурност, онлайн достъп и тестови роли.
Правила за екип/категории, период на достъп, график, оценяване и формат на
документацията за **2026–2027 трябва да се потвърдят отделно**. Roadmap датите
не са официален график. Няма заявено юридическо съответствие или удостоверяване.

Ограничения: редакционните срокове не се местят към endDate; template date
editing не е нова функция. Няма напомняния/assignment копиране, semantic duplicate
matching, AI, n8n, Calendar, T4.2 или custom picker модернизация. Physical-device,
Firefox/Safari и формален screen-reader audit не са изпълнени. Owner/editorial
приемането е отделно от автоматичната bilingual проверка.

Пътната карта с десетте направления е в `BUDOGRAPH_PRODUCT_ROADMAP.md`.
Stage-local implementation, test и editorial log: Codex authored BG/EN catalog,
server/client generalization, migration, UI и автоматични проверки; човешката
проверка и разбиране на кода са отговорност на автора; собственикът вече е потвърдил T4.1 HUMAN PASS 8/8.

## Исторически source handoff — спрян preflight, впоследствие изяснен

Следващите три параграфа записват първоначалния спрян source handoff. Те са заменени за текущия статус от [успешната activation](BUDOGRAPH_EVENT_TEMPLATES_T4_1_ACTIVATION.md), разрешена след изричното owner потвърждение.

Проверени са development fingerprints `734663449f0e944e` / `a90a1035b104d054`, PostgreSQL 17.11, TLS 1.3, authorized chain, hostname и rejectUnauthorized=true. Всички 0001–0012 checksums съвпадат с HEAD и development history; само 0013 е pending. Няма изпълнена development миграция, нов backup или контролиран restart.

Preflight е спрян по изричния owner gate: T2 Event `84ab5c6f-0ed8-44fb-85f0-b38b030d8694` има **5 active Tasks / 3 receipts / 9 History entries**, вместо стария запис 3/2/6. Read-only диагностиката потвърждава оригиналните три Tasks, canonical BG полета/дати/часове и двете T2 операции като непокътнати. Няма deleted или неотчетени Tasks. Допълнителната owner операция `e6879dd5-4e12-4ed3-aedf-f2fcb4215767`, **2026-10-17T19:06:01.257Z**, прилага личен шаблон v1 и добавя 2 Tasks, 2 task.created и 1 aggregate History. Тя предхожда тази T4.1 работа и може да е owner T3 acceptance, но това не е прието като установено без потвърждение. Изпратен е точният въпрос към собственика. Никой запис не е коригиран или премахнат. Evidence: `tmp/t4-activation-preflight.txt`, `tmp/t4-activation-diagnostic.json`.

Съществуващият backend е под Node --watch и е презареждал source автоматично при редакции; това не е контролираната T4.1 activation. Vite PID 27776 остава същият. Новият catalog route може да е зареден от watcher-а, но не се заявява готов live Apply преди миграция и целия activation gate.

## Задължителни статуси

| Статус                      | Резултат                                                            |
| --------------------------- | ------------------------------------------------------------------- |
| T1 HUMAN PASS               | PRESERVED                                                           |
| T2 HUMAN PASS               | PRESERVED                                                           |
| T3 HUMAN PASS               | PRESERVED                                                           |
| T4.1 SOURCE                 | COMPLETE                                                            |
| T4.1 CURATED TEMPLATES      | 12 нови / 108 Tasks, плюс оригиналния starter / 4 Tasks             |
| T4.1 BG/EN QUALITY          | PASS — автоматичен преглед и owner HUMAN PASS 8/8                   |
| T4.1 REAL POSTGRESQL TESTS  | PASS — 53/53 Templates                                              |
| T4.1 ATOMIC APPLY           | PASS — реална isolated PostgreSQL транзакция и rollback             |
| MIGRATION 0013              | APPLIED — development; 1/12, повторение 0/13                        |
| T4.1 LIVE BACKEND           | ACTIVATED — PID 33112, verified TLS 1.3                             |
| T4.1 HUMAN ACCEPTANCE       | PASS 8/8 — DOCUMENTED                                               |
| ROADMAP DOCUMENT            | CREATED                                                             |
| EVENT MANAGEMENT STAGES 1–7 | PRESERVED — 77/77 SQL и 112/112 LOCKED                              |
| COMMIT / PUSH               | AUTHORIZED — одитиран checkpoint; резултатът е в Git/финалния отчет |

## Файлове от T4.1

- `CHANGELOG.md`
- `README.md`
- `docs/AI_ASSISTANCE_LOG.md`
- `docs/BACKEND_DEVELOPMENT.md`
- `docs/BUDOGRAPH_EVENT_TEMPLATES_T4_1.md`
- `docs/BUDOGRAPH_EVENT_TEMPLATES_T4_1_ACTIVATION.md`
- `docs/BUDOGRAPH_PRODUCT_ROADMAP.md`
- `docs/DEPLOYMENT_AND_DEMO_PLAN.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/PRESENTATION_OUTLINE.md`
- `docs/TEST_EVIDENCE.md`
- `docs/THIRD_PARTY_NOTICES.md`
- `docs/USER_GUIDE.md`
- `package.json`
- `scripts/verify-curated-templates-ui.mjs`
- `server/migrations/0013_curated_template_catalog.sql`
- `server/migrations/README.md`
- `server/src/routes/templates.ts`
- `server/src/templates/catalog.ts`
- `server/src/templates/curated.ts`
- `server/src/templates/history.ts`
- `server/src/templates/model.ts`
- `server/src/templates/service.ts`
- `server/tests/curated-templates.integration.test.ts`
- `server/tests/curated-templates.test.ts`
- `server/tests/personal-templates.integration.test.ts`
- `server/tests/template-acceptance.integration.test.ts`
- `src/domain/curatedTemplates.ts`
- `src/i18n/curatedTemplateMessages.ts`
- `src/i18n/messages.ts`
- `src/pages/StarterTemplatesPage.tsx`
- `src/pages/templates/CuratedLibrary.tsx`
- `src/pages/templates/TemplateApplicationPanel.tsx`
- `src/pages/templates/curated.css`
- `src/services/curatedTemplates.test.ts`
- `src/services/curatedTemplates.ts`
- `src/services/eventHistory.ts`
- `src/services/templateApplications.ts`

Няма нови зависимости. Непроменени са оригиналният client starter, неговите BG/EN текстове, calendar resolver и 12-те исторически SQL миграции (15 byte-identical файла спрямо HEAD). Windows shortcut остава извън промените.
