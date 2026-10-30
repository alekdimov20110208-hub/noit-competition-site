# BudoGraph D2.2 — безопасен локален staging branch

Дата: 2026-10-30. Обхват: **LOCAL D2.2 PREPARATION ONLY**.
Branch: `staging/render-free-d2-2`, създаден от
`77816198512cbaba2cd53dab3bb40b65c62a9554` с всички налични D2/D2.1 файлове.
`main` и remote остават непроменени. Локалният commit не публикува файловете.
Този документ има предимство пред старите D2/D2.1 hosting инструкции за първото
staging разгръщане. Оригиналните документи/evidence остават исторически записи.

## Реално извършена локална подготовка

- Запазен е hash snapshot на 510 начални файла в игнорирания `tmp/` без копиране
  на съдържание или secrets. Несвързаният Windows shortcut остава извън Git.
- Recipe е един Free Node Web Service във Frankfurt, една инстанция, изричен
  staging branch, `autoDeployTrigger: off`, reminders изключени. Запазени са
  `production:build`, `production:start`, `/api/health/ready` и един origin.
- Production project ref е премахнат от активния recipe. Новите identity inputs
  са ръчни и задължителни; няма default staging credentials.
- Минималната runtime промяна е в `server/src/db/identity.ts`: отделен staging
  режим, проверен hostname, отказ на известния Production project преди pool
  creation, съпоставяне на UUID/ref/`staging` при всяко checkout. Production
  запазва съществуващия default и всички проверки на runtime role/TLS/schema.
- Няма промяна в auth/verification, бизнес логиката, frontend, dependencies,
  оригиналните SQL 0001–0016 или Production manifest/evidence. Няма нов SQL файл.

Пълните 48/222/329 проверки са предишни D2 резултати и не се представят като
повторени. Новите действително изпълнени проверки са в
`evidence/D2_2_SAFE_STAGING_RESULT.json`. Hosted login/email/TLS/performance и
staging database bootstrap **още не са изпълнени или проверени**.

Локално възпроизвеждане след инсталирани locked dependencies:

```powershell
pnpm production:build
$env:BUDOGRAPH_TEST_COMPILED_STAGING = '1'
node --test server/tests/staging-isolation.test.ts server/tests/database-identity.test.ts
node scripts/verify-render-free.mjs --config-only
node scripts/verify-staging-branch.mjs
```

Compiled case се включва изрично след build; обикновеният `server:test` няма
ново изискване за предварително налични build artifacts. За staged release
сканирането последната команда приема `--staged` преди commit. Скриптът изисква
точния branch/main baseline; optional началният snapshot е само в `tmp/`.

## Vercel: задължителна процедура ПРЕДИ бъдещ push

Различното име на branch не изключва Preview deployments. По подразбиране
непосочените branches са разрешени; ако няколко правила съвпадат, дори едно
`true` разрешава deployment.
[Официална Git конфигурация](https://vercel.com/docs/project-configuration/git-configuration).

1. Първо read-only проверка на свързаните GitHub/Vercel настройки преди бъдещия
   отделно одобрен защитен Git checkpoint. Установяват се всички Vercel
   projects, свързани с repository, production branch, Root Directory,
   Configuration File, Git правила, Deploy Hooks, GitHub Actions и други външни
   build/deploy автомати. Проверяват се актуалните remote refs преди публикация.
   Сега няма account-level проверка; липсата на локални workflows не доказва
   липса на външни triggers.
2. Подготвя се и се одобрява локален commit с branch-specific забрана в реално
   използвания Vercel config на всеки свързан project. Ако root `vercel.json`
   е потвърденият config и няма друг config, минималното съдържание е:

   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "git": {
       "deploymentEnabled": {
         "staging/render-free-d2-2": false
       }
     }
   }
   ```

   Това е **бъдеща предложена промяна**, не активен файл в D2.2. Съществуващ
   config се допълва внимателно; не се презаписва. Проверяват се всички
   съвпадащи glob правила, особено разрешаващо `true`. Забраната трябва да е
   в самия първи публикуван commit. Не се разчита на commit message, Ignored
   Build Step, име на branch или отказал build като предотвратяване на deploy.

3. Ако настройките/външните автомати не позволяват доказуемо предотвратяване,
   push остава блокиран. Всяко необходимо remote settings действие иска отделно
   owner approval; текущото разрешение не го обхваща. Не се променят production
   branch, domains, aliases или активният сайт.
4. Едва след проверена забрана и изрично разрешен push: публикува се само
   точният branch и прегледан SHA, без merge/force/tags/PR triggers. След това
   се прави read-only проверка, че няма нов Vercel deployment за SHA. Последната
   проверка е потвърждение, не заместител на предотвратяването.

Текущи локални branch/add/commit операции не изпращат Git provider събития.
В repository не е добавян или променян Vercel config/workflow. Не е извикван
Vercel CLI/deploy/API mutation. Няма Git push и няма remote branch creation.

## Отделна staging база — бъдеща отделно одобрена операция

Production `bdcjascqqvzmmlvabhgv` е забранен target за този staging recipe.
Не се четат Production credentials, users или sessions и не се правят
dump/restore, clone, live SQL или повторение на consumed verifier attempts.
Наличният неактивен Supabase project не е инспектиран, възстановен или използван.
Преди евентуално използване са нужни проверка на ownership/предназначение/
съхранявани данни и отделно изрично разрешение; свободен слот не е такова разрешение.

Предпочитаният план е **нов празен Supabase Free project**, само след approval:

1. Owner проверява организацията и Free плана, броя активни Free projects във
   всички организации, където е Owner/Administrator, текущите квоти и че изборът
   няма платен compute/add-on. По текущи публични правила лимитът е два активни
   Free projects; paused projects не се броят. Не се приема, че конкретният
   акаунт има свободен слот. При липса на слот се спира без upgrade, изтриване
   или възстановяване на чужд/неизяснен project.
   [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase).
2. След изрично approval за новия празен project се избира име за BudoGraph
   disposable staging и Frankfurt, ако е наличен. Потвърждават се различен
   project ref, собственик, Postgres версия/съвместимост и цена $0. Паролата на
   owner/admin остава само в защитения store; никога в Render runtime.
3. Преди SQL owner одобрява конкретен, reviewable staging-only bootstrap с
   target ref/hostname и нов UUID. Той трябва самостоятелно да установи празна
   application schema и verified provider/connection identity преди мутации,
   да отхвърли Production ref и всеки неочакван съществуващ обект. Не се пуска
   непроверена команда `production:migrate` срещу произволен URL.
4. В тази нова база се подготвят R2 creator/runtime roles и ACL prerequisites:
   session `postgres`, creator `budograph_migrator`, отделен non-owner LOGIN
   `budograph_runtime`, без memberships/superuser/BYPASSRLS/permanent CREATE,
   connection limit 4 и запазен допустим inherited PUBLIC TEMP. Точните bootstrap
   команди подлежат на review за новия provider target. Не се разширяват grants,
   за да се заобиколи migration failure.
5. Прилагат се **само оригиналните bytes** 0001–0016 в ред, с SHA-256 сравнение
   към `production-manifest.json`, през отделно одобрения staging runner.
   Историята е собствена `schema_migrations` на новата база. Production
   verification ID/attempt/result не се използват за live проверка на staging.
   Проверяват се history, application tables/RLS/functions и права отделно.
6. **Съществена особеност:** оригиналната 0015 има
   `CHECK(environment='production')`. Не може просто да се seed-не `staging`.
   След schema verification е необходим отделно одобрен staging-only overlay,
   извън immutable migrations и никога в startup: в една транзакция owner
   установява точната таблица/оригинален constraint и празна identity таблица,
   заменя само този CHECK с `CHECK(environment='staging')`, и въвежда един ред
   `singleton=true`, новия UUID, `environment=staging`, новия project ref.
   При съществуващ/конфликтен ред операцията спира; няма overwrite/upsert/reset.
   Runtime role запазва SELECT-only достъп до identity. Точният overlay SQL
   трябва да бъде написан, прегледан и тестван в отделния одобрен етап; тук няма
   executable bootstrap/overlay и не се твърди готова база.
7. Създава се **нов staging evidence**, включващ 16/16 history checksums,
   разликата в constraint/identity, runtime ACL и отказ при production identity.
   Оригиналното Production evidence остава непроменено. Това е същата базова
   schema с документиран staging overlay, не идентичен Production catalog.
8. Runtime password и secrets са нови и независими. Няма копирани users,
   accounts, sessions, outbox jobs или реални потребители. Първи synthetic
   Organizer/Event и тестов mailbox изискват собствен отделно одобрен bootstrap;
   development provisioning CLI не е подходящ при `NODE_ENV=production`.

Free публични квоти при проверката: 500 MB database, 5 GB egress, shared compute,
пауза след седмица неактивност. Другите Free услуги не са нужни за този runtime.
Проверяват се отново преди provisioning; тук account billing не е инспектиран.
[Supabase pricing](https://supabase.com/pricing).
Не се добавят paid branching, dedicated pooler, IPv4 add-on или PITR. При
IPv4-only hosting се използва shared **session** pooler от Connect диалога,
порт 5432, username `budograph_runtime.` плюс действителния staging ref.
Не се отгатва pooler hostname. Direct е допустим при налична IPv6 свързаност.
[Официална connection документация](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Render Free — точен future preflight

Всички values се въвеждат по-късно в защитения dashboard. Няма реални secrets
или работещи placeholders в този документ. `sync: false` означава липсващ
owner input, не валиден credential. Runtime работи fail closed.

| Input                               | Изискване                                                                                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_VERSION`                      | `24.16.0`; `pnpm@11.9.0` от package.json                                                                                                                       |
| `NODE_ENV`                          | `production`, включително staging                                                                                                                              |
| `BUDOGRAPH_DEPLOYMENT_ENV`          | `staging`, изрично от recipe                                                                                                                                   |
| `HOST`, `PORT`                      | `0.0.0.0`, `10000`                                                                                                                                             |
| `WEB_CONCURRENCY`, `SERVE_FRONTEND` | `1`, `true`                                                                                                                                                    |
| `REMINDER_WORKER_ENABLED`           | `false`                                                                                                                                                        |
| `DATABASE_URL`                      | Само новият staging runtime LOGIN, собствена парола, `/postgres`, direct/session 5432; без query overrides                                                     |
| `EXPECTED_SUPABASE_PROJECT_REF`     | Новият 20-character staging ref, никога Production                                                                                                             |
| `EXPECTED_DATABASE_HOST`            | Точен независимо проверен hostname от staging Connect диалога; съвпада с URL                                                                                   |
| `EXPECTED_DATABASE_ID`              | Новият owner-confirmed UUID от staging identity row                                                                                                            |
| `DATABASE_TLS_MODE`                 | `verify-full`                                                                                                                                                  |
| `DATABASE_TLS_CA_FILE`              | `/etc/secrets/database-ca.pem`                                                                                                                                 |
| Secret File                         | `database-ca.pem`: валиден PostgreSQL CA от verified provider source; provenance/fingerprint/expiry се проверяват независимо, без private key; извън Git/build |
| `BETTER_AUTH_SECRET`                | Нов независим high-entropy secret, 32–512 знака, без whitespace; стабилен при restarts                                                                         |
| `RATE_LIMIT_HMAC_KEY`               | Нов независим canonical base64 от 32 random bytes, стабилен                                                                                                    |
| `EMAIL_OUTBOX_KEY_ID`               | Активен ID от 1–32 lowercase letters/digits/underscore/hyphen                                                                                                  |
| `EMAIL_OUTBOX_KEYS`                 | JSON с 1–3 независими 32-byte canonical base64 keys, включва активния ID; запазват се ключове за останалите jobs                                               |
| `EMAIL_MODE`                        | `resend`; без disabled/direct fallback                                                                                                                         |
| `EMAIL_FROM`                        | Съществуващ verified sender/domain; проверени SPF/DKIM и authorization; без DNS промени тук                                                                    |
| `RESEND_API_KEY`                    | Нов staging server-only domain-restricted sending key; проверени Free quotas и тестов recipient                                                                |
| `BETTER_AUTH_URL`, `PUBLIC_APP_URL` | Еднакви с действително назначения временен HTTPS `onrender.com` origin, без path/query/credentials; не budograph.com                                           |

`TRUSTED_PROXY_IPS` се пропуска до независима проверка на точни ingress IPs.
Не се добавят `VITE_*`, TLS-disable, `PGSSLMODE`, `NODE_OPTIONS`, dev `.env`
или provisioning credentials. Липсващ provider secret/sender спира startup;
валидният синтаксис не доказва provider authorization — нужен е отделен реален
email acceptance тест след одобрение. Публичната регистрация остава затворена,
invitation-only и email verification остават задължителни.

CA се качва в Environment → Secret Files, filename `database-ca.pem`, без paid
disk; Render документира runtime path и общ лимит 1 MB.
[Secret Files](https://render.com/docs/configure-environment-variables#secret-files).
Hosted mount/TLS acceptance още не е тестван. Не се учи CA от самия endpoint.

Преди creation owner потвърждава Hobby workspace без payment method, налични
Free hours/bandwidth/build minutes и $0 summary. Само един Web Service,
repository root, branch от recipe, Auto Deploy Off, без databases/workers/cron/
disk/preview resources/domains. `off` не предотвратява първия deploy при creation
или deploy при save; ако CA/origin още липсват, runtime credentials остават
непопълнени и startup отказва. Използва се Save only, където е налично, след
това Manual Deploy на точно одобрения SHA. Няма migration/pre-deploy hook.
[Blueprint reference](https://render.com/docs/blueprint-spec).

Free спи след 15 idle minutes и има 750 споделени instance hours/month; без карта
изчерпването спира services/builds. Не се добавя карта, upgrade или keep-alive.
Outbox работи само когато service е буден; reminders остават изключени. Няма
обещание за непрекъснат email или readiness/login при студен старт.
[Render Free](https://render.com/docs/free).

След отделно разрешен deploy: еднократен readiness/routing check, след това
контролиран synthetic login/invitation/verification/cookie/email тест и измерване
на memory/cold-start. Не се поканват реални users и няма public activation.

## Следващото едно одобрение

**Одобрение само за създаване на един нов празен Supabase Free project
`budograph-staging-d2` във Frankfurt след read-only проверка на Free
capacity/ownership и потвърдена цена $0.** При липса на свободна квота или
неясна собственост се спира. Това не разрешава SQL/bootstrap/overlay, restore
на неактивния project, push, Render creation или deployment. Те остават
отделни операции за следващи одобрения с точните targets и evidence.

НОИТ: прочетени са master prompt и регламентът за **2025–2026**. За по-късна
година категориите/сроковете/форматът/защитата и периодът за online достъп
изискват нова проверка. Free sleeping staging не доказва състезателна наличност.
Запазени са GPLv3, license register и изискването за човешко разбиране/review;
human code review остава PENDING.
