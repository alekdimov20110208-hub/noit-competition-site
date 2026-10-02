# BudoGraph Backend Foundation Architecture Contract

Версия: **1.0** · Дата: **2026-10-03** · Обхват: **Backend P1**.

Този документ превръща предходния read-only архитектурен одит в единен
implementation contract, уточнен под човешко ръководство. Записва зададената
архитектурна посока; окончателното човешко одобрение предстои. След одобрение
той е водещият договор за Backend P1; промяна на основната идея изисква изрично
разрешение. Всички backend модели, API и проверки по-долу са бъдещи изисквания,
а не реализирани функции или постигнати резултати.

| Статус                        | Стойност                         |
| ----------------------------- | -------------------------------- |
| BACKEND IMPLEMENTATION STATUS | NOT STARTED                      |
| BACKEND FOUNDATION CONTRACT   | AWAITING HUMAN APPROVAL          |
| DASHBOARD                     | LOCKED — functionally + visually |
| TASKS                         | LOCKED — functionally + visually |
| TEAM                          | LOCKED — functionally + visually |
| PLAN B                        | NOT YET REDESIGNED               |
| TEMPLATES                     | NOT YET REDESIGNED               |
| Phase 2B.4C                   | ACCEPTED                         |

**Този contract НЕ разрешава автоматично започване на Backend P1.** Текущата
задача е documentation only: без source/CSS/tests, dependencies/lockfiles,
configuration/`.gitignore`/environment files, server/database/auth code,
migrations или API routes; без redesign на заключените страници, Plan B и Templates.

## 1. Основа и състезателни ограничения

Проверена основа преди редакцията: branch `main`; `HEAD` и freshly fetched
`origin/main` = `49562d870f88f740b8cfb7155a1d0ef494909492`
(`fix(app): refine Dashboard and Tasks composition`); ahead/behind `0/0`.
Commit съществува; няма tracked diff или staged промени. Dashboard/Tasks/Team
и цялата application implementation съвпадат с основата. Единственият
untracked файл е `docs/market-research/docs - Shortcut.lnk`; той е извън scope.

Задължителни източници: [master prompt](NOIT_MASTER_PROMPT.md) и
[регламент 2025–2026](NOIT_REGULATIONS_2025_2026.pdf). Регламентът потвърждава
VIII–X клас / „Софтуерни приложения“, максимум двама ученици, самостоятелен
завършен продукт, пълен source, защита на информацията, documentation/user guide,
лицензирани ресурси, GPLv3 и тестови акаунти за всяка роля (стр. 1–2, 5, 11).
Изисква онлайн достъп поне седмица преди областния и месец след финалния кръг
(стр. 11); приложение 1 задава PDF/A4/12 pt/1.5/Times New Roman (стр. 17).

**Правила за проверка за по-късна състезателна година:** всички горни
eligibility/licensing/deliverable изисквания, направленията, сроковете от
стр. 13–16, периодът на достъпност, documentation format и rubric 20/25/35/20
(стр. 26). Това е рамката за 2025–2026, без твърдение за актуалност за 2026–2027
или юридическо съответствие. Вътрешният срок 15 септември 2026 от master prompt
не е официален състезателен срок. Stack, Event boundary и P1 scope са вътрешни
продуктови решения. Продължават source/docs, user/setup/deployment guides,
test/demo account documentation, license register, automated evidence,
presentation и offline/backup demo plan; този договор не ги заменя.

## 2. Архитектура и бизнес граница

| Слой                              | Избор                                  |
| --------------------------------- | -------------------------------------- |
| Frontend                          | React + Vite + TypeScript              |
| Backend                           | TypeScript + Fastify modular monolith  |
| Database                          | PostgreSQL                             |
| Authentication                    | Better Auth с database-backed sessions |
| Database access                   | `pg` първоначално                      |
| Transport                         | HTTP / JSON                            |
| Collaboration / security boundary | `Event`                                |

Първоначално има един deployable backend service и relational database.
Модулите отделят auth integration, event membership/authorization, task business
commands, activity history и database access; HTTP handlers не съдържат цялата
business logic. Използват се explicit business commands и server authorization
за всяка protected request. Frontend никога не решава authorization.

`Event` е единицата, в която members, organizers, tasks, changes и бъдещите
оперативни данни си сътрудничат и получават достъп. Един `User` може да участва
в множество Events. Event scopes memberships, tasks, milestones, changes,
бъдещ budget и assistant context; всички business resources се достъпват в
Event scope. **Не се създава database `Workspace` entity.** Organization/Workspace
hierarchy чака реално продуктово изискване; името `WorkspaceService` означава
frontend facade/snapshot, а не нова security или database граница.

Current-state tables са authoritative. Lightweight activity history не е
event sourcing. Няма whole-workspace replacement writes, microservices или
realtime requirement за P1. Pure deterministic frontend selectors остават полезни.

## 3. Identity и Event

| Понятие          | Договор                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `User`           | Global authenticated identity; активността се проверява server-side.                                                                  |
| `EventMember`    | Участие на един User в конкретен Event; active/inactive membership.                                                                   |
| Operational role | Човешка семинарна отговорност, напр. Guest logistics coordinator или Venue and equipment coordinator; **никога не дава permissions**. |
| Access role      | Един от `ORGANIZER` / `MEMBER`; server-enforced authorization.                                                                        |
| Event ownership  | Отделна ownership relation; не е трета generic RBAC role.                                                                             |

Текущият frontend `TeamMember` е prototype data, не authenticated identity.
Future task assignment сочи `EventMember`, не директно `User`. Event включва
`id`, `name`, `startDate`, `endDate`, валидна IANA `timezone`, owner relation,
archive state, integer `version`, server timestamps. Ownership/archive rules
трябва да пазят активен owner с organizer membership; ownership transfer и
deactivation не могат да заобикалят тази проверка.

## 4. P1 conceptual database contract

Без SQL или migrations в тази задача. IDs са opaque и server-generated;
auth IDs и auth-specific constraints се управляват чрез Better Auth integration.
Business timestamps са server-generated; timestamps представляват instants,
а event dates и date-only deadlines се интерпретират по Event IANA timezone.

| Entity / purpose                                                           | ID и важни fields                                                                                                                                                                                                                                              | Foreign keys / constraints / uniqueness                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Version / timestamps                                                                                                            |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `User` / Better Auth auth tables — global identity, credentials и sessions | `id`, identity/display fields, active state; library-controlled account/session/verification data                                                                                                                                                              | Unique login identity според избрания auth configuration; account/session references → User; unique session token/library keys. Credential/session primitives остават library-controlled и не се връщат в workspace DTO.                                                                                                                                                                                                                                                                | User `createdAt`, `updatedAt`; session expiry/revocation и timestamps според library schema. Няма custom auth version protocol. |
| `Event` — collaboration boundary                                           | `id`, `name`, `startDate`, `endDate`, `timezone`, `ownerUserId`, `archivedAt` nullable                                                                                                                                                                         | `ownerUserId` → User; owner трябва да има active ORGANIZER membership в същия Event. Валидна IANA timezone; `endDate >= startDate`. PK `id`; няма global unique name.                                                                                                                                                                                                                                                                                                                   | Integer `version >= 1`, `createdAt`, `updatedAt`.                                                                               |
| `EventMember` — participation и access                                     | `id`, `eventId`, `userId`, `accessRole`, descriptive `operationalRole`, active state                                                                                                                                                                           | `eventId` → Event, `userId` → User; `UNIQUE(eventId, userId)` и `UNIQUE(eventId, id)` за scoped references. Access role само ORGANIZER/MEMBER. Исторически membership не се изтрива чрез cascade.                                                                                                                                                                                                                                                                                       | Integer `version >= 1`, `createdAt`, `updatedAt`; deactivation timestamp where appropriate.                                     |
| `Task` — current operational work                                          | `id`, `eventId`, `title`, `category`, `context`, `deadline`, `status`, `priority`, nullable `assignedMemberId`, descriptive `blockedBy` / `blocks`, nullable `acceptedByMemberId` / `acceptedAt`, `createdBy`, `updatedBy`, nullable `deletedAt` / `deletedBy` | `eventId` → Event; PK `id`, `UNIQUE(eventId, id)`. Composite `(eventId, assignedMemberId)` / `(eventId, acceptedByMemberId)` / actor references → EventMember `(eventId, id)`. `createdBy`, `updatedBy`, `deletedBy` са session-derived member IDs. Acceptance fields са едновременно null или populated, accepted member = assigned member. Unassigned task няма current acceptance. Title nonempty; status/priority са validated enums. Assignment command изисква active membership. | Integer `version >= 1`, server `createdAt`, `updatedAt`; soft-delete metadata where appropriate.                                |
| `ActivityEntry` — append-only business history                             | `id`, `eventId`, `actorUserId`, nullable `actorMemberId` where appropriate, `actionType`, `targetType`, `targetId`, small structured before/after или event payload                                                                                            | `eventId` → Event; actorUserId → User, scoped actorMemberId → EventMember; ако member е наличен, User трябва да съвпада. PK `id`; няма arbitrary dedup uniqueness. Target type/ID се валидират по Event; polymorphic target не е автоматичен SQL FK. Няма destructive cascade към history.                                                                                                                                                                                              | Server `createdAt`; immutable, без mutable `version`/`updatedAt`.                                                               |

Cross-event assignments и всички cross-event resource references се забраняват
и чрез scoped queries/transaction validation, и чрез composite foreign keys
където е възможно. Actor fields са derivation от session, не editable input.
Indexes за event snapshots/history следват `eventId`, а history — server time/ID.
Inactive historical ownership може да се запази за completed work; open assigned
work изисква explicit resolution преди member removal/deactivation. Soft deletion
и deactivation не заличават activity. Destructive database operations изискват
отделно човешко одобрение.

## 5. Task semantics и acceptance

| Концепция  | Значение                                                                       |
| ---------- | ------------------------------------------------------------------------------ |
| STATUS     | Lifecycle: `not-started`, `in-progress`, `blocked`, `completed`.               |
| PRIORITY   | Impact/consequence: `normal`, `important`, `critical`.                         |
| TIMING     | Calendar relationship, derived от deadline, reference/current date и timezone. |
| ATTENTION  | Derived operational signal от canonical task state.                            |
| ACCEPTANCE | Acknowledgement на отговорността; независимо от lifecycle status.              |

Descriptive blocker/consequence (`blockedBy` / `blocks`) остават валидни.
Structured dependencies не се извличат от prose и не задават автоматично
`blocked` lifecycle status. По-късно минимален `TaskDependency` ще обслужва
Plan B / impact modeling; това е извън P1.

Само текущият active assignee може да приеме отговорност или да оттегли своето
приемане. Actor идва от authenticated session; `acceptedAt` идва от server.
Organizer може да приема само собствена assigned task, никога от името на друг.
Status change не приема/оттегля отговорност автоматично.

Assignment/reassignment/unassignment изискват organizer permission и
`expectedVersion`. Nullable `assignedMemberId` позволява unassignment. Новият
assignee трябва да е active EventMember от същия Event. В една transaction се
проверява canonical task version, сменя assignment, изчистват
`acceptedByMemberId` и `acceptedAt` при промяна/unassignment, увеличава version
и записва ActivityEntry, включително acceptance invalidation когато има такова.
Повторното възлагане на предишния assignee **не възстановява** старото приемане.
Историческото acceptance остава в ActivityEntry. Member deactivation/removal
трябва explicit да resolve open assigned work и current acceptance; completed
historical work може да пази inactive ownership reference where appropriate.

Текущият frontend `Task.acknowledged` остава prototype-compatible до отделно
одобрена migration; frontend schema не се променя в тази задача.

## 6. Permissions и authorization pipeline

| Action                                             | ORGANIZER                                        | MEMBER                                        |
| -------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| Read event operational data                        | Да, в authorized Event                           | Да, в authorized Event                        |
| Manage tasks; assign/reassign/unassign             | Да                                               | Не                                            |
| Change task lifecycle status                       | Да                                               | Само собствена assigned task                  |
| Accept/withdraw responsibility                     | Само собствена assigned task                     | Само собствена assigned task                  |
| Manage event members/access roles                  | Да, с ownership safeguards                       | Не                                            |
| Create/update event changes; assign response owner | Да, later scope                                  | Не                                            |
| Update change response                             | Да, later scope                                  | Само ако explicit response owner, later scope |
| Edit Event / milestones                            | Да, authoring/later scope                        | Не                                            |
| Archive Event                                      | Само където отделните ownership rules разрешават | Не                                            |

Таблицата задава permissions за продуктовата посока; не добавя authoring,
changes/milestones или archive endpoints към P1. Frontend role flags са само
presentation hints. Server е deny-by-default и изпълнява за всяка protected request:

`authenticated session → active User → active EventMember → permission check → resource belongs to same Event → mutation/resource validation`.

За event list се връщат само Events с active authorized membership. Resource
lookup винаги е event-scoped. Client `actorId`, `createdBy`, `updatedBy`,
`isOrganizer`, `acceptedBy` или arbitrary `eventId` не доказват authorization;
resource IDs също не са authorization. Absent/invalid session → `401`.
За inaccessible foreign resources се предпочита non-disclosing `404` where
appropriate; `403` е за отказ на действие в вече authorized scope.

## 7. P1 API и concurrency

| Conceptual API                                       | Действие / request                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Better Auth routes                                   | Login, session inspection, logout; exact mount/integration се определя в одобрения P1.                  |
| `GET /api/events`                                    | Authorized Event list; empty account е валиден empty result.                                            |
| `GET /api/events/:eventId/workspace`                 | Current authorized Event snapshot: Event, memberships, tasks и необходима lightweight activity history. |
| `POST /api/events/:eventId/tasks/:taskId/assignment` | Organizer command: `assignedMemberId` nullable + `expectedVersion`.                                     |
| `PUT /api/events/:eventId/tasks/:taskId/acceptance`  | Current assignee command: desired `accepted` boolean + `expectedVersion`; actor/time не са inputs.      |
| `PATCH /api/events/:eventId/tasks/:taskId/status`    | Organizer или current assignee: validated `status` + `expectedVersion`.                                 |

Всяка mutation authenticate/authorize/validate/verify event scope и
`expectedVersion`, изпълнява business update + ActivityEntry в една DB
transaction и връща canonical state, integer version и server timestamps.
Concurrent version check/update трябва да е atomic, така че две команди със
същата version не могат и двете да overwrite canonical state. Membership и
assignment permissions се проверяват спрямо валидното transactional state.

Initial policy: **server-confirmed writes**, без blind last-write-wins.
Stale version → `409 Conflict` → refetch canonical state → разбираемо
changed-data състояние, без silent overwrite или автоматичен replay на intent.
Validation failure → `400`; server failure връща safe error и не оставя
частичен business/history write. ETags не са задължителни за P1.
Няма `PUT /workspace` и generic reducer-action endpoints.

## 8. Activity history

Append-only `ActivityEntry` записва assignment/unassignment/reassignment,
acceptance/withdrawal/invalidation, task lifecycle status, важни deadline
changes, meaningful priority changes и, когато съответният scope бъде
реализиран, event change creation, response ownership/status,
membership/access-role changes, archive/removal actions.

Payload е малък и structured, със server actor/time и before/after или event
details; достатъчен е да запази предишно acceptance след reassignment.
Не се логват hover, filters, current page, language, selection или всеки read.
History не реконструира authoritative state; няма event sourcing.

## 9. Frontend service boundary и demo/real separation

Бъдещ `WorkspaceService` има explicit business methods и implementations
`LocalDemoWorkspaceService` / `RemoteWorkspaceService`. UI components не знаят
persistence transport; pure selectors остават transport-independent.

| Mode / implementation            | Data и поведение                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEMO / LocalDemoWorkspaceService | Current fictional deterministic seed, reference date **7 Sep 2026**, local persistence, explicit `resetDemo`, no login, no production API writes.                      |
| REAL / RemoteWorkspaceService    | Authenticated HTTP API, server Events/state, canonical server timestamps, Event timezone, PostgreSQL; loading/error/conflict states, без demo reset или general reset. |

`useWorkspace` поема loading, empty-account state, error, pending mutations,
current Event snapshot, refetch, stale-response rejection и clearing remote
state при logout/account change. User/Event/mode change invalidates outstanding
responses и history/focus context. Refresh/navigation/focus refetch е достатъчен
за P1; WebSockets не са нужни.

**Няма silent migration на local demo data към real account.** `401`, `403`,
network error, empty account или server error в remote mode никога не задействат
fallback към fictional demo data. Mode и state separation са explicit.
Това е бъдещ service contract; нищо от него не се implement-ва сега.

## 10. Auth и security preconditions

P1 включва login/session/logout и **две controlled test accounts**, с отделни
browser sessions. Better Auth управлява credential/session primitives чрез
database-backed secure cookie sessions. Без auth tokens в localStorage.
Public signup, invitation UI, social login и MFA не са initial requirement.
Email verification/recovery могат да чакат later onboarding само при controlled,
documented test environment. Няма credentials в source или committed seed data.

Преди backend configuration е задължителен отделен `.gitignore` review/hardening:
всички real `.env.*` secret files трябва да се игнорират, както и `.env`;
единственият allowed committed placeholder е `.env.example`. Текущият файл
съдържа изброени local env patterns, но няма general `.env.*` coverage.
**`.gitignore` не се променя в тази documentation задача.** DB passwords,
auth/session secrets, credential-bearing production URLs и test-user passwords
не могат да влизат в Git history.

Security implementation requirements:

- Server authorization на всяка protected request, deny by default,
  event-scoped DB queries, IDOR protection и least-privilege access.
- Server input/schema validation, parameterized SQL; client не контролира
  actor, time или permission. Validation допуска само explicit command fields.
- HttpOnly session cookies, `Secure` в production/HTTPS, подходяща SameSite policy,
  CSRF/origin protection за cookie auth и restricted CORS.
- Rate limiting за auth/write abuse where appropriate; secrets само server-side,
  включително бъдещи AI API calls. Отделни runtime DB и migration credentials
  where practical.
- Safe logging без passwords/tokens/cookies; минимални лични данни, backup/restore
  plan с проверка на restore, dependency/license review преди добавяне и
  актуализиран license register за GPLv3 distribution review.

Това са изисквания за бъдеща реализация, без security/compliance certification.

## 11. P1 vertical slice и definition of done

**Two-user responsibility loop** доказва реална collaboration:

1. Organizer и Member влизат в отделни browser/session contexts.
2. Двамата имат active membership в един Event.
3. Organizer възлага task на Member с current `expectedVersion`.
4. Member refresh/refetch вижда assignment и приема отговорност.
5. Server записва authenticated actor и server acceptance timestamp.
6. Organizer refresh вижда acceptance.
7. Member сменя lifecycle status; Organizer refetch вижда промяната.
8. Organizer reassign-ва task към друг active EventMember (може към себе си).
9. Acceptance се изчиства atomically; history пази предишното приемане.
10. Старият assignee вече няма право да mutate task като assignee.
11. Concurrent stale command връща `409`.
12. User извън Event не може да read или mutate resources.

Тестова стратегия за одобрения P1: unit tests за permission/acceptance rules;
PostgreSQL integration/API tests за scoped FKs, transactions/rollback и atomic
version conflicts; auth tests за invalid/expired sessions и logout; two-session
E2E за целия loop. Покриват се withdrawal, unassignment, reassignment back без
acceptance restore, organizer impersonation denial, member deactivation с open
work, cross-event IDs, inactive User/Member и forged actor/time/role inputs.
Frontend integration проверява explicit empty/error/conflict states, logout/account/
Event/mode clearing, stale responses и липса на demo fallback.

P1 е done само когато този flow и negative cases са реализирани и проверени,
има възпроизводими automated/manual evidence, secure controlled account setup,
installation/deployment и backup/restore инструкции. Резултатите се записват
след изпълнение; този contract не твърди passing backend tests. Refresh е
достатъчен; няма изискване за WebSockets.

## 12. Later entities, exclusions и roadmap

Later entities: `EventMilestone`, `EventChange`, `ChangeAffectedTask`,
`TaskDependency`, `Invitation`, template definitions, `BudgetItem`.
Не се въвеждат `Workspace` table, generic `Role` table или `TaskAcceptance`
table, освен ако later implementation evidence докаже необходимост.

Извън Backend P1: microservices, WebSockets, Redis, queues, Kubernetes,
CQRS framework, event sourcing, graph DB, organization hierarchy, generic policy
engine, invitation UI, template backend, budget, AI assistant, vector DB,
notifications, realtime presence, analytics warehouse, offline sync,
Change Consequence Path и full Plan B backend.

| Фаза  | Обхват                                                                               |
| ----- | ------------------------------------------------------------------------------------ |
| P1    | Two-user responsibility loop.                                                        |
| P2    | Organizer authoring + multiple Events + event-scoped navigation.                     |
| P3    | Plan B / Change → impact → response persistence + explicit task relationships.       |
| P4    | Controlled invitation/onboarding + recovery + deployment hardening.                  |
| Later | Templates, Budget, AI assistant — само след стабилен operational collaboration core. |

## 13. Locked UI compatibility и approval gate

Dashboard / Tasks / Team остават заключени. Бъдещата integration е съвместима,
ако selected Team person се map-ва към EventMember, IDs остават opaque,
`ownerId` мигрира към EventMember assignment, Accepted boolean остава prototype
display state до migration, а acceptance actor/time стават server metadata.
Operational role никога не определя authorization. Task counts се извеждат от
full authorized Event state или server aggregates; attention/timing selectors
продължават върху canonical DTOs. History/focus context се invalidates при
User/Event/mode change; remote loading може временно да обезсили selected
member/task и UI трябва безопасно да обработва това. Future routes може да
изискват explicit Event context. Това не разрешава UI edits в текущата задача.

Следващата разрешена стъпка е човешки review/approval на този contract и P1
scope, data model, security/test strategy и deployment plan. Backend configuration,
dependencies, migrations, auth/API/server code и frontend service migration
чакат изрично човешко разрешение. **Не започвай Backend P1, Plan B или Templates
като продължение на този documentation commit.**
