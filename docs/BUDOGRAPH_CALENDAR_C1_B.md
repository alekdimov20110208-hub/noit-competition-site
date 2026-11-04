# Calendar C1-B — локално приемане с реални данни

Клон `codex/calendar-c1-a`. Calendar използва същия Event-scoped workspace и
Fastify Task reads като Tasks. Панелът в Calendar е само за преглед.

`scripts/calendar-c1b-local.mjs` стартира нов PostgreSQL 17 cluster на loopback,
прилага 16 миграции и създава две временни Better Auth сметки. Един общ Event
съдържа две задачи. Отделни малки fixtures проверяват чужд Event и архив.
Fastify обслужва build-а и реалните API routes на един локален origin.
Входните настройки са създадени за fixture-а, с изключен email.

## Възпроизвеждане

От `C:\NOIT\budograph-calendar-c1a`, с инсталираните locked dependencies и
наличните локални PostgreSQL binaries:

```powershell
& 'D:\School\Computer Science\node.exe' scripts/calendar-c1b-local.mjs --serve
```

Скриптът отпечатва Calendar и Tasks URL адресите, архивната и частната
референция и пътя до локалния `disposable-accounts.json`. Файлът е извън Git
и frontend root. В него са само еднократните сметки за текущия fixture.
Ctrl+C спира самостоятелно стартираната инстанция и нейния PostgreSQL cluster.
Данните в спрения fixture са еднократни.

## Кратко човешко приемане

1. Отворете Calendar URL и влезте като `calendar-organizer@example.invalid`.
   В общия Event Calendar C1-B отворете **Confirm venue** на 9-и, 00:15,
   и **Print agenda** на 10-и без час. Сравнете сроковете и статусите в
   детайлите с Tasks.
2. В Tasks преместете срока на Confirm venue на 12-и, 23:40. Обновете
   Calendar и потвърдете новата клетка и час. В Calendar липсват редакция,
   промяна на статус и assignment контроли.
3. В отделен private прозорец влезте като `calendar-member@example.invalid`.
   Проверете същите задачи и актуалния срок. В Tasks променете статуса
   на възложената Confirm venue и обновете Calendar. Member не може да
   променя невъзложената Print agenda или да отваря Organizer-only Event.
4. Отворете архивния Calendar URL с двете роли. Архивната задача е видима,
   а редакцията през Tasks е недостъпна. Проверете BG/EN и тъмна тема на
   тесен екран. Решетката има вътрешен хоризонтален scroll.

## Техническа проверка

- 8 сценария в Chromium с реални PostgreSQL записи, Better Auth login и
  Fastify APIs. PASS за parity, UI промени и refresh, роли, Event isolation,
  София/Лос Анджелис при смяна на месеца, архив и BG/dark mobile.
- 90 фокусирани Calendar/route/Tasks/Archive теста PASS.
- C1-A регресия: 30 browser сценария и 3 Fastify fixture случая PASS.
- Frontend и backend TypeScript и локален build PASS. Остава Vite
  предупреждението за размера на основния JS пакет.

Автоматизираният реален run е същата команда без `--serve`. Използва наличния
Playwright и Chromium. При външен Playwright задайте
`BUDOGRAPH_PLAYWRIGHT_MODULE` и `BUDOGRAPH_BROWSER_EXECUTABLE` към локалните
инсталации. Резултатът от браузърната проверка е отделен от приемането от
собственика.
