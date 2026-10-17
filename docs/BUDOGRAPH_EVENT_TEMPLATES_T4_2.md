# BudoGraph — Event Templates T4.2

Дата: 17 октомври 2026 г. Приета база: `36c73c11bf26449277a37ada061658ee4bcaf81e`.
T1/T2/T3/T4.1 HUMAN ACCEPTANCE: **PRESERVED**.

## Окончателно лично приемане — T4.2 HUMAN PASS 8/8

**T4.2 HUMAN PASS — 8/8, лично потвърден от собственика на 18 октомври 2026 г.**
Собственикът изрично одобри всичките осем проверки:

1. Налични са 25 системни шаблона: 24 curated плюс оригиналния starter; My Templates е запазен.
2. Дванадесетте нови плана имат подходящо BG/EN съдържание и разбираемо разграничение между цялостни планове и пакети.
3. Търсенето, категориите, трите нива и празният резултат работят.
4. Броевете, датите, select all/none, keyboard, mobile и light/dark са лично проверени.
5. Създадено е ново празно development Event с начало **2026-12-20**, Europe/Sofia.
6. Първите две задачи на многоинструкторския айкидо шаблон дават Review срокове **2026-10-25** и **2026-11-08**, без час.
7. Един лично потвърден Apply създава **точно 2 нови Tasks и 3 application History entries**.
8. Refresh запазва резултата; T1–T4.1 и My Templates остават използваеми.

Това е авторитетното **OWNER Human Acceptance**, отделно от автоматичните
доказателства. Не са предоставени точните нови Event/Task/History/operation IDs,
момент на Apply или screenshots и те не се измислят. Codex не е изпълнявал live
Apply от името на собственика и не повтаря личния тест в този checkpoint.

Приети са **12 T4.2 плана / 101 Tasks**, към **12 T4.1 плана / 108 Tasks** и
оригиналния **starter / 4 Tasks**: **25 системни шаблона / 213 blueprint Task
definitions**. Development activation е завършен без нова миграция.
Event Templates библиотеката е завършена за планирания initial release.
T1 6/6, T2 6/6, T3 8/8, T4.1 8/8, B.1 и LOCKED Stages 1–7 са запазени.

Заявката разрешава отделния одитиран commit и нормален push на приетия T4.2.
Няма разрешение за нова функция, migration, restart, live Apply или deployment.
Разделите по-долу пазят техническите доказателства от изпълнението на 17 октомври;
те не са представени като повторени на 18 октомври.

## Финален Git checkpoint — 18 октомври 2026 г.

Новите, немодифициращи базата проверки са: frontend **329 PASS / 0 FAIL /
0 SKIP**, backend default **201 PASS / 0 FAIL / 54 explicit opt-in DB SKIP**.
И двата TypeScript check и build, lint, curated content/hash/Preview/Apply unit
регресиите, scoped formatting и `git diff --check` са PASS. SQL fixtures и
browser suites не са повторени за този checkpoint. Историческите **65 SQL
Templates / 77 Event / 26+26 Chromium / 112 LOCKED** са доказателства от
изпълнението, не нови резултати. Първоначалният fixture конфликт и чистото му
повторение остават документирани по-долу.

Одитираният обхват е **13 файла** от списъка „Променени файлове“: 5 source/test
и 8 documentation. Прегледът запазва приетите blueprints, общия T2 service,
личните шаблони, dependency/lockfile, LOCKED интериорите и миграции 0001–0013.
Няма 0014. Scoped formatting не преформатира непроменения LOCKED
`EventArchiveDialog.tsx`; известният му formatting проблем остава отделен.
Vite advisory остава **698.08 kB / 186.92 kB gzip**, над прага 500 kB.

Branch/upstream са `main` / `origin/main`. Fetch потвърди приетата база
`36c73c11bf26449277a37ada061658ee4bcaf81e` без divergence; GitHub потвърди
private repository `alekdimov20110208-hub/noit-competition-site`. Разрешен е
само нов commit и normal push; приетият T4.1 commit не се изменя.
Всеки файл се проверява преди staging и повторно като staged content, включително
secret scan; ignored diagnostics/evidence, runtime logs, credentials, backups
и несвързаният shortcut се изключват. Няма нова feature реализация.

Development проверките използват repeatable-read **READ ONLY** snapshot и
verify-full TLS 1.3; 0013 вече е приложена и няма pending миграции.
Snapshot-ът започва след личния owner тест и включва неговите нови записи,
без да предполага техните IDs. Сравнението на 18 статични business/auth/private
таблици пази и всички предишни receipts и лични blueprints; notification worker
таблиците са изключени от статичния hash. B.1 съвпада с историческия persisted
record. Backend **39920** и Vite **27776** се запазват; environment/CA и приетата
активна source реализация са непроменени. Няма development write, migration,
restart, live Apply/Save, deployment или email activation.

Локални checkpoint evidence: `tmp/t42-final-checkpoint-*.{json,txt}`,
`tmp/t42-final-checkpoint-db-{before,after}.json`,
`tmp/t42-checkpoint-audit-{worktree,staged}.json` и staged diff. Тези локални
диагностики не се включват в commit-а. Публичният deployment и реалната email
доставка остават следваща отделна production-readiness фаза.

## Обхват и редакционен преглед

Добавени са точно **12** нови v1 шаблона със **101** задачи. Има **24 curated
плана / 209 задачи**, плюс отделния оригинален starter / 4 задачи: **25 системни
шаблона / 213 дефиниции на задачи**. Личните шаблони не се броят като системни.
Старите 13 blueprints запазват всички публични полета и поведение. Hash тестът
проверява целия accepted JSON, включително ред, преводи, IDs, версии, приоритети,
отмествания, часове и напомняния.

| Stable ID                                 | BG / EN име                                                                                            | Задачи | Категория / сложност | Обхват и опорна дата                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ | -----: | -------------------- | ----------------------------------------------------------------- |
| `curated-multi-instructor-seminar`        | Айкидо семинар с няколко инструктори / Multi-instructor Aikido seminar                                 |     10 | aikido / advanced    | Цялостен еднодневен план; начало на семинара                      |
| `curated-children-guardian-workshop`      | Детска айкидо работилница с настойници / Children's Aikido workshop with guardians                     |     10 | aikido / advanced    | Цялостен еднодневен план; начало на работилницата                 |
| `curated-inclusive-practice-workshop`     | Приобщаваща работилница по бойни изкуства / Inclusive martial-arts workshop                            |      8 | workshops / advanced | Цялостен еднодневен план; начало на работилницата                 |
| `curated-instructor-development-workshop` | Работилница за развитие на инструктори / Instructor development workshop                               |      8 | workshops / standard | Цялостен еднодневен план; начало на срещата                       |
| `curated-beginner-aikido-course`          | Въвеждащ курс по айкидо за начинаещи / Beginner Aikido introductory course                             |      9 | courses / standard   | Стартиране на поредица; първо занимание, +7 не е край             |
| `curated-external-sports-venue`           | Семинар във външна спортна зала — пакет / External sports venue seminar — task pack                    |      8 | logistics / standard | Допълващ пакет; еднодневен семинар                                |
| `curated-volunteer-reception-team`        | Доброволци и посрещане — пакет / Volunteer preparation and reception — task pack                       |      8 | community / beginner | Допълващ пакет; еднодневно събитие                                |
| `curated-tatami-equipment-transport`      | Превоз на татами и оборудване — пакет / Tatami and equipment transport — task pack                     |      8 | logistics / standard | Допълващ пакет; събитие в ден 0, сверяване с реалния превоз       |
| `curated-away-seminar-group-travel`       | Групово пътуване до семинар — пакет / Group travel to an away seminar — task pack                      |      9 | logistics / advanced | Допълващ пакет; отпътуване в ден 0, +1 не означава връщане        |
| `curated-community-fundraising-event`     | Общностно събитие за набиране на средства / Martial-arts community fundraising event                   |      8 | community / advanced | Цялостен еднодневен организационен план; не е платежен инструмент |
| `curated-post-event-improvement-review`   | Преглед след събитие и план за подобрения / Post-event review and improvement workshop                 |      7 | workshops / beginner | Отделна среща; начало на прегледа, не на миналото събитие         |
| `curated-training-weapons-logistics`      | Практика с учебни оръжия — организационен пакет / Training weapons practice — organizational task pack |      8 | aikido / standard    | Допълващ пакет към еднодневно занимание; не е техническо обучение |

Предложеният междуклубен айкидо ден се припокрива със съществуващия
`curated-multi-club-workshop`. Заменен е с пакета за учебни оръжия: одобрени
средства и пространство, опис, съхранение, заемане и проверено връщане.
Новият многоинструкторски план добавя общ водещ, преходи и резерв при отсъствие;
детският — предаване, надзор и контакт с настойници; приобщаващият — конкретно
проверен маршрут и индивидуално договорена подкрепа. Това са различни процеси
от общите задачи за зала, покана и програма в T4.1.

Курсът за начинаещи подготвя последователно включване и постоянен график, докато
приетият двудневен курс организира обучение в два дни. Пакетите за зала,
доброволци, превоз и пътуваща група изрично допълват Event план. Прегледът
след събитие има собствена опорна дата, факти и проследими подобрения.
Дарителски, детски, здравни, достъпни и учебни условия се проверяват
с местните отговорни и квалифицирани лица; няма измислени правни, медицински
или изпитни изисквания, статистики, лични данни или обещания за сертификация.

Всички нови задачи имат авторски BG/EN title/category/context, стабилен slug,
normal/important приоритет и целочислено календарно отместване. Часът е `null`:
няма универсален оправдан час без конкретна програма. Няма автоматични
отговорници, приемане или напомняния. Сроковете са редакционни предложения.
BG/EN QUALITY: **PASS** след редакционен прочит и автоматична проверка; отделното
собственическо приемане на текста вече е потвърдено с HUMAN PASS 8/8.

## Архитектура и UI

Единственият източник е `server/src/templates/curated.ts`; добавени са записи към
приетия масив. Няма втори frontend каталог, нов Apply engine, schema промяна,
dependency, asset или външен checklist. Новият текст следва GPL-3.0-only на проекта.
Не са променяни миграции 0001–0013. Съществуващата 0013 приема новите bounded
`curated-…` IDs при v1; всички са проверени и с действителни SQL receipts.

Запазени са автентикираното catalog API, сървърният resolver и атомарният T2
service, Organizer-only Apply, Member preview, archived ограниченията,
freshness/version проверките, durable idempotency, server-owned Task полетата,
нормалните History/provenance и owner-only лични шаблони.

Няма нови category values или промяна на difficulty/filter/search поведението.
Два видими BG/EN етикета са обобщени: „Айкидо семинари“ → „Айкидо“ и „Логистика
за гости“ → „Логистика“, защото категориите вече включват работилница, учебни
средства, зала и оборудване. Идентификаторите `aikido` и `logistics` са запазени.
Каталогът показва **24 от 24** в Curated Library; starter е отделно във Вградени.
Няма редизайн, custom picker или промени в LOCKED интериори. При 320 px картите
остават последователни и филтрите/empty result помагат за свиване на списъка.
Това е автоматична/редакционна проверка, не потребителско изследване.

## Технически проверки при изпълнението — 17 октомври 2026 г.

| Проверка                                             |          PASS | FAIL | SKIP | Evidence                                                    |
| ---------------------------------------------------- | ------------: | ---: | ---: | ----------------------------------------------------------- |
| Frontend unit                                        |           329 |    0 |    0 | `tmp/t42-checkpoint-frontend.txt`                           |
| Backend default                                      |           201 |    0 |   54 | `tmp/t42-checkpoint-backend.txt`; explicit opt-in SQL skips |
| Реален PostgreSQL Templates T2/T3/T4.1/T4.2          |            65 |    0 |    0 | `tmp/t42-real-postgres.txt`                                 |
| Реален PostgreSQL Event Management, чисто повторение |            77 |    0 |    0 | `tmp/t42-real-event-regressions-clean.txt`                  |
| Chromium T4.1 поток                                  |            26 |    0 |    0 | `tmp/templates-t42/curated-old/report.json`                 |
| Chromium T4.2 поток                                  |            26 |    0 |    0 | `tmp/templates-t42/curated-new/report.json`                 |
| Chromium T1 / T2 / T3                                |   34 / 29 / 7 |    0 |    0 | `tmp/templates-t42/{t1,t2,t3}/report.json`                  |
| Оригинални LOCKED изображения                        | 112 identical |    0 |    0 | `tmp/templates-t42/locked/report.json`; без rebaseline      |

Двата deliberate-change controls са открити. Browser suites имат 0 page errors
и 0 unexpected API requests. T4 проверките включват 320/390/768/1440 px,
BG/EN, light/dark, keyboard, empty/error/loading/retry, Member/archived,
stale Review, lost-response recovery, реални избрани Tasks и History през
изолирания service. Всичките 12 нови detail списъка се проверяват на BG/EN при
320 px. T1/T2 browser transport е синтетичен; T3/T4 ползват истински изолиран
PostgreSQL и Fastify service със синтетична автентикация и intercepted transport.

SQL покрива всички 24 curated шаблона на двата езика, same-key concurrency,
точни Task полета, History и receipt, replay в нов процес, различен payload,
права и rollback. Съществуващият T2 acceptance suite покрива календарни граници,
date-only и local-time starter, freshness и атомарност. Server/client canonical
Review и всички category/difficulty комбинации имат unit проверки.

След обобщаването на двата category етикета frontend 329 PASS, TypeScript/build,
lint и целият T4.2 browser поток 26 PASS са повторени; финалният browser report е
`tmp/templates-t42/curated-final/report.json`. Само един от 383 source/env/CA
manifest записа е умишлено различен: `src/i18n/curatedTemplateMessages.ts`.
Останалите 382, включително backend/environment/CA, остават идентични.

Първият Event run беше **75 PASS / 2 FAIL / 0 SKIP**: браузърни fixtures пишеха
едновременно в същата disposable база и нарушиха global-count assertion на
rollback теста (родителят също е отчетен като FAIL). Не е променян production
код или assertion. Suite е повторена последователно в друга собствена база:
**77 PASS / 0 FAIL / 0 SKIP**. Първият LOCKED launcher опит не зареди Sharp
заради остарял път `lib/index.js`; използван е реалният bundled `dist/index.mjs`,
без инсталация или промяна на dependency. Финалният визуален резултат е 112/112.

Изолация: PostgreSQL **17.11**, cluster **7697374354312044444**, само
`127.0.0.1:55432`, owned root `BudoGraph-T2-PostgreSQL17-eb975bcf9737`.
OWNER marker, data directory, version, system identifier, listener и
несуперпотребителският runner/owner са проверени преди fixtures. Нови собствени
disposable бази: `budograph_t2_isolated_t42_20261017_1792268706829` и отделната
Event база `budograph_t2_isolated_t42_20261017_1792268804242`. Credentials остават
извън repository. Shared development Supabase не е подаван на test fixtures.
Fresh disposable базите изпълняват съществуващите 13 миграции като setup;
това не е development migration и няма нова миграция 0014.

След приключване на проверките прекъсването на чакащия Windows launcher спря и
дървото на disposable PostgreSQL. Клъстерът е възстановен със собствените binaries,
identity е проверена повторно, няма други client connections и е изпълнен чист
`pg_ctl stop -m fast`. `pg_controldata` потвърждава `shut down`; тестовите бази са
запазени. Development backend/Vite/Supabase не са засегнати. Cleanup evidence:
`tmp/t42-cleanup-{recovery,stop}.txt`. Това не променя вече приключилите тестови резултати.

Frontend/backend TypeScript, lint и build: **PASS**. Scoped Prettier и
`git diff --check`: **PASS**. Пълно repository formatting не се твърди; запазен
е историческият проблем в непроменения `EventArchiveDialog.tsx`. Vite build
продължава да предупреждава за chunk над 500 kB: **698.08 kB / 186.92 kB gzip**.

## Development activation и запазване

LIVE T4.2 CATALOG: **ACTIVATED**. Извършен е точно един graceful backend-only
restart **33112 → 39920**, с непроменени Node/working directory/env inputs.
Vite остава **27776**; Supabase не е рестартиран. Source/environment/CA manifest
е проверен преди/след restart; последващата единствена frontend промяна са двата
category етикета, заредени с Vite HMR и повторно проверени. Втори backend restart няма.

Target fingerprint **734663449f0e944e**, project fingerprint **a90a1035b104d054**,
development config, verify-full, trust chain, hostname, `rejectUnauthorized=true`
и действителен application-pool **TLS 1.3** са проверени преди и след restart.
Това доказва Node → pooler транспорта, не отделен pooler → database одит.
Readiness е 200. Всички 13 migration checksums съвпадат, 0013 вече е приложена,
pending = 0. **Не е изпълняван migration CLI върху development**.

Read-only repeatable-read snapshots на **18 business/auth/private таблици** са
hash-identical преди/след. Notification worker таблиците са изключени от статичния
hash, защото worker остава работещ. B.1 е сравнен с историческия persisted record:
1 Event / 1 member / 4 Tasks / 1 Change / 3 links / 7 History, всички идентични.
Четирите template Apply receipts, четирите private таблици и предишните
T2/T3/T4.1 записи са непокътнати. Няма live Apply, Save, Event/Task authoring,
изтриване, reset или редакция на development данни от Codex.

Съществуващата автентикирана browser сесия прочита активните 24 curated карти
и оригиналния starter отделно. Личните шаблони и server Review се проверяват
само чрез read/preview. Human Acceptance не се заменя с тези проверки.
Runtime доказателства: `tmp/t42-runtime-{before,after}.txt`,
`tmp/t42-runtime-activation.json`, `tmp/t42-checkpoint-db-{before,after}.json`,
`tmp/t42-b1.json`, `tmp/t42-activation-source-manifest.json` и
`tmp/t42-live-read-verification.json`.

Live Review е изпълнен с първите две задачи на новия многоинструкторски план в
съществуващото Event с начало **27.11.2026**: точно **2** реда със срокове
**02.10.2026** и **16.10.2026**, без час; потвърждението е немаркирано и Apply е
disabled. Това е само preview, не личният acceptance Apply. Live BG/EN
multi-keyword search, комбинирани logistics/standard филтри и empty result са
проверени; My Templates detail има приетите 2 задачи. Накрая библиотеката е
оставена на BG с изчистени филтри, 24 карти. След всички прочити повторната
18-table preservation проверка също е PASS.

## Променени файлове

- `server/src/templates/curated.ts` — единственото разширение на съдържанието.
- `src/i18n/curatedTemplateMessages.ts` — два видими category етикета на BG/EN.
- `server/tests/curated-templates.test.ts` — exact counts, accepted hashes и качество.
- `src/services/curatedTemplates.test.ts` — 24-entry contract и localized search/filter matrix.
- `scripts/verify-curated-templates-ui.mjs` — стар и нов blueprint през същия UI/SQL поток.
- `docs/BUDOGRAPH_EVENT_TEMPLATES_T4_2.md` — отчет и лично приемане.
- `docs/BUDOGRAPH_PRODUCT_ROADMAP.md` — реален статус и незабавен P0 фокус.
- `docs/AI_ASSISTANCE_LOG.md` — помощта и owner-confirmed acceptance.
- `docs/TEST_EVIDENCE.md` — новите резултати и граници на доказателствата.
- `docs/USER_GUIDE.md` — 25 системни шаблона, пакети и опорни дати.
- `docs/KNOWN_LIMITATIONS.md` — ограничения и лично приет статус.
- `README.md` — текущ статус и връзка към отчета.
- `CHANGELOG.md` — ограничената T4.2 промяна.

Несвързаният untracked Windows shortcut е непокътнат и изключен от checkpoint-а;
ignored `tmp` доказателствата, credentials, runtime файловете и сертификатите
не са част от source-control обхвата. License register остава валиден:
без нови зависимости, assets или външни ресурси.

## Human Acceptance — лично от собственика

**Процедурата по-долу вече е изпълнена и одобрена: PASS 8/8.** Запазена е за
проследимост; не е инструкция за повторен Apply в Git checkpoint-а.

1. Отворете Templates. Вградени съдържа оригиналния starter, Curated Library —
   **24**, общо **25**; My Templates остава отделно. Намерете 12 нови имена от таблицата.
2. Прочетете BG/EN описанията, audience и задачите на новите сценарии. Проверете
   обозначението на пакетите, опорните дати и напътствията за местни правила.
3. Проверете multi-keyword търсене: „превоз товарене“ / “tatami loading”; пробвайте
   липсващ резултат и Clear filters. Комбинирайте категория и всяко ниво.
4. На desktop и тесен mobile, BG/EN, light/dark проверете четимост, detail counts,
   select all/none, Tab/Space/Enter и точните календарни дати.
5. **Лично създайте ново празно development Event**, например
   `DEMO — T4.2 Library Review`, **20 декември 2026**, Europe/Sofia.
   Codex не го създава. Не използвайте B.1 или приетите T2/T3/T4.1 Events.
6. Отворете „Айкидо семинар с няколко инструктори“, махнете всички и изберете
   само първите две: „Потвърдете участието на всеки инструктор“ и
   „Определете кой съгласува общата програма“. Server Review трябва да показва
   **точно 2**, правилното ново Event, **25.10.2026** и **08.11.2026**, без час.
   BG/EN смяната запазва селекцията, но изисква нов Review/confirmation.
7. Само след лична проверка на destination и полетата маркирайте потвърждението
   и изпълнете **един Apply**. Очаквайте **точно 2 нови Tasks**, без отговорник,
   неприети, незапочнати, без напомняния, плюс **3 application History entries**
   (2 task.created + 1 TEMPLATE_APPLIED), отделно от EVENT_CREATED. Проверете refresh.
8. Проверете starter, някой приет T4.1 план и My Templates. Собственикът вече
   потвърди резултата по осемте точки: **T4.2 HUMAN ACCEPTANCE: PASS 8/8**.

## Приоритети и граници

Пътната карта е обновена с приетия T4.2 статус. Текущият checkpoint обхваща
документация, одит, commit и безопасен push на приетото разширение. Публичен
deployment и реална email доставка не са започнати в тази задача.
P0 остават стабилната публична версия до **30 ноември 2026** и надеждни
акаунти/реална email доставка. Calendar и тесни AI/workflow функции предстоят;
не са започвани deployment/email setup/Calendar/AI/Budget/n8n/global UI в T4.2.

Потвърдени изисквания в наличния регламент: собствен завършен продукт, лицензирани
ресурси, GPLv3/source, документация, онлайн оценяване и тестови роли. Те са от
**2025–2026**; екип, категории, график, формати, оценяване и онлайн период за
следващата година изискват отделна актуална проверка преди регистрация.
Плановите продуктови дати са вътрешни решения, не официални NOIT срокове.
