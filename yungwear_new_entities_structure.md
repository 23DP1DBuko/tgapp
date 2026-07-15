# YungWear — Firestore Entities: Referrals, Tasks, Polls, Giveaway, Campaigns

Документ для агента-разработчика. Описывает точную структуру коллекций Firestore и логику бэкенда для новых фич. Не менять существующие коллекции (`products`, `orders`, `promoCodes`, `broadcasts`, `telegramSubscribers`) — только добавить новые.

---

## 1. Referrals — реферальная система

### Зачем отдельная коллекция
Нужна для лидерборда (кто больше всех пригласил) и как источник правды для подсчёта прогресса в giveaway-заданиях. Считать инвайты "на лету" из `orders` или `telegramSubscribers` не подходит — нужен чистый, независимый счётчик приглашений.

### Коллекция `referrals`

```
referrals/{telegramUserId}
  telegramUserId: number
  telegramUsername: string | null
  referralCode: string              // уникальный код/deep-link parameter для этого юзера
  totalInvited: number               // lifetime счётчик — сколько людей перешло по его ссылке и стало новым пользователем
  invitedUserIds: number[]           // список ID приглашённых (для проверки дублей и антифрода)
  createdAt: Timestamp
  updatedAt: Timestamp
```

### Как считается новый инвайт
1. Новый пользователь открывает Mini App через deep-link с параметром `?startapp=ref_{referralCode}`.
2. Cloud Function при первом входе нового пользователя проверяет: этот `telegramUserId` уже существует в системе? Если нет — это новый пользователь.
3. Найти владельца `referralCode` в `referrals`, увеличить `totalInvited += 1`, добавить `telegramUserId` нового пользователя в `invitedUserIds`.
4. Защита от накрутки: один и тот же `telegramUserId` не может быть добавлен в `invitedUserIds` дважды (ни у одного реферера, ни повторно).

### Лидерборд
Простой запрос: `referrals` отсортированный по `totalInvited` descending, top N. Не требует дополнительной агрегации.

---

## 2. Referral progress per giveaway (решение твоего главного вопроса)

**Проблема:** `totalInvited` — это lifetime счётчик. Если giveaway требует "пригласи 3 друзей", нельзя засчитывать старых друзей, приглашённых до начала этого giveaway — иначе задание выполняется автоматически без всякого действия.

**Решение:** при входе в giveaway и активации реферального задания — сделать "снимок" текущего `totalInvited`, и считать прогресс как разницу.

### Поле в `giveawayEntries` (см. раздел 5)

```
giveawayEntries/{giveawayId}_{telegramUserId}
  activeTasks: [
    {
      taskId: string
      startedAt: Timestamp
      snapshotValue: number         // totalInvited (или streakCount) НА МОМЕНТ нажатия "Выполнить"
      currentProgress: number       // = referrals.totalInvited - snapshotValue (пересчитывается при чтении)
      isCompleted: boolean
    }
  ]
```

Это отвечает на твой вопрос "как считать под giveaway каждый раз заново количество приглашенных" — не создаётся новая коллекция на каждый giveaway, просто **снимок числа в момент старта задания**, и прогресс = текущее значение минус снимок.

---

## 3. Tasks — фиксированный каталог (не создаётся через форму)

Ты правильно заметил: задания не создаются вручную, они уже существуют в коде как готовый набор. Задача бэкенда — просто хранить их определения и состояние `isActive`, а не позволять создавать новые произвольные тексты.

### Коллекция `taskDefinitions` (сидируется один раз через скрипт/сид-функцию, НЕ через форму создания)

```
taskDefinitions/{taskId}
  category: 'referral' | 'streak' | 'subscription'
  key: string                    // 'referral_1', 'referral_3', 'referral_5', 'referral_10',
                                  // 'streak_3', 'streak_5', 'streak_7',
                                  // 'subscription_tiktok', 'subscription_instagram'
  label: string                  // "Пригласить 3 друзей" — editable в админке
  threshold: number | null       // 1, 3, 5, 10 для referral; 3, 5, 7 для streak; null для subscription
  verifyMethod: 'referral_delta' | 'streak_delta' | 'manual_claim'
  isActive: boolean              // админ может выключить тип задания глобально
```

**Фиксированный список при сидировании:**
- `referral_1`, `referral_3`, `referral_5`, `referral_10` (category: referral)
- `streak_3`, `streak_5`, `streak_7` (category: streak)
- `subscription_tiktok`, `subscription_instagram` (category: subscription)

Админка для Tasks — это не "New Task" форма, а **список из 9 фиксированных карточек** с переключателем `isActive` и возможностью редактировать `label` (текст). Threshold и key менять нельзя — они зашиты в код.

---

## 4. Polls — упрощённая структура

Ты прав, что Telegram уже умеет делать опросы нативно, но раз коллекция должна существовать — минимальная структура для внутренних опросов в самом Mini App (не заменяет Telegram Polls, используется отдельно, например, для "какой дроп хотите следующим").

### Коллекция `polls`

```
polls/{pollId}
  title: string
  description: string | null
  options: [
    {
      id: string
      label: string
      votesCount: number
    }
  ]
  isActive: boolean
  allowMultipleVotes: boolean      // может ли юзер выбрать несколько вариантов
  createdAt: Timestamp
  endsAt: Timestamp | null
```

### Подколлекция голосов (для защиты от повторного голосования)

```
polls/{pollId}/votes/{telegramUserId}
  optionIds: string[]
  votedAt: Timestamp
```

---

## 5. Giveaway — полная структура с учётом заданий

### Коллекция `giveaways`

```
giveaways/{giveawayId}
  title: string
  description: string
  status: 'draft' | 'live' | 'finished' | 'announced'
  endAt: Timestamp
  prizes: [
    {
      productId: string           // ссылка на products
      place: number                // 1, 2, 3...
    }
  ]
  winnersCount: number             // = prizes.length
  attachedTasks: [
    {
      taskId: string               // ссылка на taskDefinitions
      ticketsGranted: number       // сколько билетов даёт выполнение конкретно в этом giveaway
    }
  ]
  baseEntryTickets: number         // билетов за простое присоединение (обычно 1)
  createdAt: Timestamp
  finishedAt: Timestamp | null
  winners: [
    {
      place: number
      productId: string
      telegramUserId: number
      ticketsAtWinTime: number
    }
  ] | null
```

### Коллекция `giveawayEntries`

```
giveawayEntries/{giveawayId}_{telegramUserId}
  giveawayId: string
  telegramUserId: number
  joinedAt: Timestamp
  totalTickets: number              // baseEntryTickets + сумма ticketsGranted завершённых activeTasks
  activeTasks: [
    {
      taskId: string
      startedAt: Timestamp          // момент нажатия "Выполнить" на конкретное задание
      snapshotValue: number | null  // для referral/streak — снимок значения на старте
      isCompleted: boolean
      completedAt: Timestamp | null
    }
  ]
```

### Логика "нажал Выполнить — отсчёт начинается с этого дня"
Это именно то, что ты описал: задания в giveaway не засчитываются автоматически по общему прогрессу — пользователь должен явно нажать "Выполнить" на конкретное задание внутри giveaway, и **только с этого момента** начинается отсчёт (для streak — день 1 засчитывается от даты нажатия, для referral — снимок текущего числа делается в момент нажатия).

**Шаги:**
1. Пользователь заходит в giveaway, видит список `attachedTasks`.
2. Нажимает "Выполнить" на задание "7-дневный стрик" → создаётся `activeTasks[]` элемент с `startedAt = now`, `snapshotValue = user.currentStreak на данный момент` (если используется относительный подсчёт) или просто `startedAt = now` для абсолютного отсчёта следующих 7 дней захода в приложение.
3. Каждый день Cloud Function (или клиентская проверка при заходе) сверяет, продолжается ли стрик пользователя без пропуска дня, начиная с `startedAt`.
4. Когда условие достигнуто — `isCompleted = true`, `totalTickets` пересчитывается (+ticketsGranted).

Для referral-задания: `snapshotValue = referrals.totalInvited` на момент нажатия, `isCompleted` становится true когда `referrals.totalInvited - snapshotValue >= threshold` из привязанного `taskDefinition`.

### Розыгрыш (Cloud Function по расписанию/триггеру на `endAt`)
1. Собрать все `giveawayEntries` для данного `giveawayId` с `totalTickets > 0`.
2. Взвешенный случайный выбор — билет = один шанс.
3. Для каждого места в `prizes` (по порядку от 1 до N) выбрать одного победителя, исключая уже выигравших в этом же giveaway.
4. Записать в `winners[]`, перевести giveaway в `finished`.
5. Отправить сообщение победителям через Telegram Bot API.

---

## 6. Campaigns — промо-баннеры/слайды

### Коллекция `campaigns`

```
campaigns/{campaignId}
  bannerImageUrl: string
  badgeText: string | null          // например "NEW", "HOT", "-20%"
  headline: string
  subheading: string | null
  caption: string | null
  isVisible: boolean                 // показывать ли слайд сейчас
  sortOrder: number                  // порядок показа среди других campaigns
  linkTo: {
    type: 'product' | 'giveaway' | 'external_url' | 'none'
    targetId: string | null          // productId или giveawayId, если применимо
    url: string | null               // если type = external_url
  } | null
  createdAt: Timestamp
  updatedAt: Timestamp
```

Рендерится как карусель/слайдер на главном экране, отфильтрованный по `isVisible: true`, отсортированный по `sortOrder`.

---

## 7. Итоговый список новых коллекций для агента

| Коллекция | Создаётся через форму? | Основная цель |
|---|---|---|
| `referrals` | Нет, авто при первом deep-link входе | Лидерборд + источник для giveaway-заданий |
| `taskDefinitions` | Нет, сидируется в коде один раз | Фиксированный каталог из 9 типов заданий |
| `polls` | Да, через админку (обычная форма) | Внутренние опросы (не заменяет Telegram Polls) |
| `giveaways` | Да, через админку | Розыгрыши с призами из `products` |
| `giveawayEntries` | Нет, создаётся автоматически при "Присоединиться"/"Выполнить" | Прогресс и билеты каждого участника |
| `campaigns` | Да, через админку | Промо-баннеры на главном экране |

**Правило для агента:** только `polls`, `giveaways` и `campaigns` создаются через обычные админ-формы. `referrals` и `giveawayEntries` создаются исключительно автоматически бэкенд-логикой. `taskDefinitions` создаётся один раз сид-скриптом — админка только редактирует `label`/`isActive`, никогда не создаёт новые записи.
