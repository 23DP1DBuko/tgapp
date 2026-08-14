/**
 * Localized legal document bodies (Privacy Policy + Terms of Service).
 *
 * Kept separate from the UI dictionaries so each document reads as a whole
 * in one place per language. Inline text supports two markers:
 *   **bold**           → <strong>
 *   [label](url)       → <a href="url" target="_blank">
 *
 * ⚠️ DRAFT: these documents are AI-generated and must be reviewed by a
 * qualified lawyer before public launch (see LEGAL_TODO.md).
 */
import type { Language } from './translations'
import type { LegalDocId, LegalSection } from '../../types/legal'

export const legalDocs: Record<LegalDocId, Record<Language, LegalSection[]>> = {
  // ─────────────────────────── Privacy Policy ───────────────────────────
  privacy: {
    en: [
      {
        heading: '1. Who is responsible for your data?',
        blocks: [
          {
            kind: 'p',
            text: 'The data controller is a **private individual** operating the YungWear Mini App as a personal project. The App showcases personal items (for example, used or unworn clothing) and facilitates order requests via Depop/Yaga or direct messaging. If you have any questions about this policy or your data, please contact us via our Telegram bot.',
          },
          {
            kind: 'p',
            text: 'The controller is based in Latvia (European Union). All data processing described in this policy is subject to the General Data Protection Regulation (GDPR).',
          },
        ],
      },
      {
        heading: '2. What data do we collect?',
        blocks: [
          {
            kind: 'p',
            text: 'When you use this Mini App, we collect the following categories of data:',
          },
          {
            kind: 'list',
            items: [
              '**Telegram account data:** Telegram user ID, username, first name, and language code. This is obtained from Telegram when you open the Mini App.',
              '**Order request data:** The information you submit through the checkout form, including your full name, Telegram handle, contact notes, delivery address or meetup preferences, and payment method preference.',
              '**Referral activity:** Your unique referral code, number of successful referrals, and Telegram user IDs of referred users (stored securely and not publicly displayed).',
              '**Giveaway participation:** Your Telegram user ID, username, entry timestamp, completed tasks, and ticket count when you participate in giveaways.',
              '**Daily check-in:** Your check-in streak count and total check-in count to manage reward milestones.',
              '**Leaderboard visibility:** Whether you have chosen to appear in the public referral leaderboard (opt-in only).',
              '**Broadcast subscription:** Your explicit opt-in or opt-out status for receiving broadcast messages from us.',
              '**Online presence:** A timestamp indicating your last activity in the app, used to show an approximate count of currently active users. This is not a real-time tracking system and does not record your behaviour.',
            ],
          },
        ],
      },
      {
        heading: '3. Why do we process your data and on what legal basis?',
        blocks: [
          {
            kind: 'titled',
            title: 'Processing order requests',
            text: 'Legal basis: **Performance of a contract** (GDPR Art. 6(1)(b)). We need your Telegram ID, name, and contact/fulfilment details to process your order request and communicate with you about it.',
          },
          {
            kind: 'titled',
            title: 'Referral and rewards system',
            text: 'Legal basis: **Legitimate interest** (GDPR Art. 6(1)(f)) and, for leaderboard visibility, **consent** (GDPR Art. 6(1)(a)). We track referrals to operate the rewards programme. Your leaderboard visibility is opt-in only.',
          },
          {
            kind: 'titled',
            title: 'Giveaway participation',
            text: 'Legal basis: **Performance of a contract** (GDPR Art. 6(1)(b)). We need your Telegram ID to register your entry, manage tickets, and contact you if you win.',
          },
          {
            kind: 'titled',
            title: 'Broadcast notifications',
            text: 'Legal basis: **Consent** (GDPR Art. 6(1)(a)). We only send broadcast messages if you have explicitly opted in. You can withdraw consent at any time via the app settings.',
          },
          {
            kind: 'titled',
            title: 'Daily check-in',
            text: 'Legal basis: **Legitimate interest** (GDPR Art. 6(1)(f)) to operate the engagement programme.',
          },
          {
            kind: 'titled',
            title: 'Online presence counter',
            text: 'Legal basis: **Legitimate interest** (GDPR Art. 6(1)(f)) to display an approximate count of currently active users. This is a minimal presence indicator, not user tracking.',
          },
        ],
      },
      {
        heading: '4. How long do we keep your data?',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Order requests:** Retained for up to 1 year after the last communication to manage ongoing conversations, then deleted or anonymised.',
              '**Referral data:** Retained while you remain an active user of the app. If you request erasure, referral data is anonymised within 30 days.',
              '**Giveaway participation:** Retained until 6 months after the giveaway ends, after which only winner information is kept for prize fulfilment records.',
              '**Consent records:** Retained for up to 3 years to demonstrate GDPR compliance.',
              '**Daily check-in and presence data:** Retained while you remain active. Reset after 90 days of inactivity.',
            ],
          },
        ],
      },
      {
        heading: '5. Your rights under GDPR',
        blocks: [
          { kind: 'p', text: 'You have the following rights regarding your personal data:' },
          {
            kind: 'list',
            items: [
              '**Right of access:** Request a copy of the data we hold about you.',
              '**Right to rectification:** Request correction of inaccurate data.',
              '**Right to erasure ("right to be forgotten"):** Request deletion of your data, subject to legal retention requirements.',
              '**Right to restriction of processing:** Request that we limit how we use your data.',
              '**Right to data portability:** Request your data in a structured, machine-readable format.',
              '**Right to object:** Object to processing based on legitimate interests, including broadcast messaging.',
              '**Right to withdraw consent:** Withdraw any consent you have given at any time (e.g., broadcast opt-out, leaderboard opt-out).',
            ],
          },
          {
            kind: 'p',
            text: 'To exercise any of these rights, contact us via the Telegram bot. We will respond within 30 days as required by GDPR.',
          },
          {
            kind: 'p',
            text: 'You also have the right to lodge a complaint with the Latvian data protection authority (Datu valsts inspekcija) if you believe your rights have been violated.',
          },
        ],
      },
      {
        heading: '6. Who processes your data?',
        blocks: [
          {
            kind: 'p',
            text: 'We use the following service providers who process your data on our behalf (data processors):',
          },
          {
            kind: 'list',
            items: [
              '**Firebase / Google Cloud Platform** (Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA). Firebase hosts the application database (Firestore), file storage (Cloud Storage), and server-side logic (Cloud Functions). Data may be transferred to the US under the EU-US Data Privacy Framework. See: [Google Cloud DPA](https://cloud.google.com/terms/data-processing-agreement).',
              '**Telegram** (Telegram Messenger LLP, 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, UK). Telegram provides the Mini App platform and messaging infrastructure.',
            ],
          },
        ],
      },
      {
        heading: '7. International data transfers',
        blocks: [
          {
            kind: 'p',
            text: 'Your data is stored on Firebase servers which may be located outside the European Economic Area (EEA). Google Cloud Platform has certified compliance with the EU-US Data Privacy Framework. By using this app, you acknowledge that your data may be transferred to and processed in the United States and other countries where Google operates.',
          },
        ],
      },
      {
        heading: '8. Changes to this policy',
        blocks: [
          {
            kind: 'p',
            text: 'We may update this Privacy Policy from time to time. Material changes will be notified to you via the Mini App or through Telegram. Continued use of the app after changes constitutes acceptance of the updated policy.',
          },
        ],
      },
    ],
    ru: [
      {
        heading: '1. Кто отвечает за ваши данные?',
        blocks: [
          {
            kind: 'p',
            text: 'Оператором данных является **частное лицо**, которое управляет Mini App YungWear в качестве личного проекта. Приложение демонстрирует личные вещи (например, одежду в употреблении или новую) и помогает оформлять запросы на заказ через Depop/Yaga или в личных сообщениях. Если у вас есть вопросы об этой политике или ваших данных, свяжитесь с нами через нашего Telegram-бота.',
          },
          {
            kind: 'p',
            text: 'Оператор находится в Латвии (Европейский союз). Вся обработка данных, описанная в этой политике, осуществляется в соответствии с Общим регламентом по защите данных (GDPR).',
          },
        ],
      },
      {
        heading: '2. Какие данные мы собираем?',
        blocks: [
          {
            kind: 'p',
            text: 'При использовании этого Mini App мы собираем следующие категории данных:',
          },
          {
            kind: 'list',
            items: [
              '**Данные аккаунта Telegram:** ID пользователя Telegram, имя пользователя, имя и код языка. Эти данные мы получаем от Telegram при открытии Mini App.',
              '**Данные запроса на заказ:** информация, которую вы указываете в форме оформления заказа, включая полное имя, контакт в Telegram, контактные заметки, адрес доставки или предпочтения по встрече, а также предпочтительный способ оплаты.',
              '**Реферальная активность:** ваш уникальный реферальный код, количество успешных приглашений и ID пользователей Telegram, которых вы пригласили (хранятся безопасно и не отображаются публично).',
              '**Участие в розыгрышах:** ваш ID пользователя Telegram, имя пользователя, время участия, выполненные задания и количество билетов при участии в розыгрышах.',
              '**Ежедневные отметки (check-in):** количество дней подряд и общее количество отметок для управления наградами.',
              '**Видимость в таблице лидеров:** выбрали ли вы отображение в публичной реферальной таблице лидеров (только по согласию).',
              '**Подписка на рассылки:** ваш явный статус согласия или отказа на получение наших рассылок.',
              '**Присутствие онлайн:** метка времени, указывающая вашу последнюю активность в приложении, для отображения примерного количества активных пользователей. Это не система отслеживания в реальном времени и не записывает ваше поведение.',
            ],
          },
        ],
      },
      {
        heading: '3. Зачем мы обрабатываем ваши данные и на каком основании?',
        blocks: [
          {
            kind: 'titled',
            title: 'Обработка запросов на заказ',
            text: 'Правовое основание: **исполнение договора** (ст. 6(1)(b) GDPR). Нам нужны ваш ID в Telegram, имя и контактные данные для обработки вашего запроса на заказ и связи с вами по нему.',
          },
          {
            kind: 'titled',
            title: 'Реферальная система и система наград',
            text: 'Правовое основание: **законный интерес** (ст. 6(1)(f) GDPR), а для видимости в таблице лидеров — **согласие** (ст. 6(1)(a) GDPR). Мы отслеживаем рефералов для работы программы наград. Ваша видимость в таблице лидеров — только по согласию.',
          },
          {
            kind: 'titled',
            title: 'Участие в розыгрышах',
            text: 'Правовое основание: **исполнение договора** (ст. 6(1)(b) GDPR). Нам нужен ваш ID в Telegram для регистрации участия, управления билетами и связи с вами в случае выигрыша.',
          },
          {
            kind: 'titled',
            title: 'Уведомления-рассылки',
            text: 'Правовое основание: **согласие** (ст. 6(1)(a) GDPR). Мы отправляем рассылки только при вашем явном согласии. Вы можете отозвать согласие в любое время в настройках приложения.',
          },
          {
            kind: 'titled',
            title: 'Ежедневные отметки',
            text: 'Правовое основание: **законный интерес** (ст. 6(1)(f) GDPR) для работы программы вовлечения.',
          },
          {
            kind: 'titled',
            title: 'Счётчик присутствия онлайн',
            text: 'Правовое основание: **законный интерес** (ст. 6(1)(f) GDPR) для отображения примерного количества активных пользователей. Это минимальный индикатор присутствия, а не отслеживание пользователей.',
          },
        ],
      },
      {
        heading: '4. Как долго мы храним ваши данные?',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Запросы на заказ:** хранятся до 1 года после последнего общения для ведения переговоров, затем удаляются или анонимизируются.',
              '**Реферальные данные:** хранятся, пока вы остаётесь активным пользователем приложения. По запросу на удаление реферальные данные анонимизируются в течение 30 дней.',
              '**Участие в розыгрышах:** хранится до 6 месяцев после окончания розыгрыша, после чего сохраняется только информация о победителях для учёта выдачи призов.',
              '**Записи о согласии:** хранятся до 3 лет для подтверждения соответствия GDPR.',
              '**Данные ежедневных отметок и присутствия:** хранятся, пока вы остаётесь активным. Сбрасываются после 90 дней бездействия.',
            ],
          },
        ],
      },
      {
        heading: '5. Ваши права по GDPR',
        blocks: [
          { kind: 'p', text: 'Вы обладаете следующими правами в отношении ваших персональных данных:' },
          {
            kind: 'list',
            items: [
              '**Право доступа:** запросить копию данных, которые мы храним о вас.',
              '**Право на исправление:** запросить исправление неточных данных.',
              '**Право на удаление («право быть забытым»):** запросить удаление ваших данных с учётом требований законодательства о хранении.',
              '**Право на ограничение обработки:** запросить ограничение использования ваших данных.',
              '**Право на переносимость данных:** запросить ваши данные в структурированном, машиночитаемом формате.',
              '**Право на возражение:** возражать против обработки на основании законных интересов, включая рассылки.',
              '**Право отозвать согласие:** отозвать данное вами согласие в любое время (например, отказ от рассылок или отображения в таблице лидеров).',
            ],
          },
          {
            kind: 'p',
            text: 'Для реализации любого из этих прав свяжитесь с нами через Telegram-бота. Мы ответим в течение 30 дней, как того требует GDPR.',
          },
          {
            kind: 'p',
            text: 'Вы также вправе подать жалобу в латвийский орган по защите данных (Datu valsts inspekcija), если считаете, что ваши права были нарушены.',
          },
        ],
      },
      {
        heading: '6. Кто обрабатывает ваши данные?',
        blocks: [
          {
            kind: 'p',
            text: 'Мы используем следующих поставщиков услуг, которые обрабатывают ваши данные от нашего имени (обработчики данных):',
          },
          {
            kind: 'list',
            items: [
              '**Firebase / Google Cloud Platform** (Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, США). Firebase размещает базу данных приложения (Firestore), хранилище файлов (Cloud Storage) и серверную логику (Cloud Functions). Данные могут передаваться в США в рамках рамочного соглашения EU-US Data Privacy Framework. См.: [Google Cloud DPA](https://cloud.google.com/terms/data-processing-agreement).',
              '**Telegram** (Telegram Messenger LLP, 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, Великобритания). Telegram предоставляет платформу Mini App и инфраструктуру обмена сообщениями.',
            ],
          },
        ],
      },
      {
        heading: '7. Международная передача данных',
        blocks: [
          {
            kind: 'p',
            text: 'Ваши данные хранятся на серверах Firebase, которые могут находиться за пределами Европейской экономической зоны (ЕЭЗ). Google Cloud Platform сертифицирована на соответствие рамочному соглашению EU-US Data Privacy Framework. Используя это приложение, вы подтверждаете, что ваши данные могут передаваться и обрабатываться в США и других странах, где работает Google.',
          },
        ],
      },
      {
        heading: '8. Изменения в этой политике',
        blocks: [
          {
            kind: 'p',
            text: 'Мы можем время от времени обновлять эту Политику конфиденциальности. О существенных изменениях мы сообщим вам через Mini App или Telegram. Продолжение использования приложения после внесения изменений означает принятие обновлённой политики.',
          },
        ],
      },
    ],
    lv: [
      {
        heading: '1. Kas ir atbildīgs par jūsu datiem?',
        blocks: [
          {
            kind: 'p',
            text: 'Datu pārzinis ir **privātpersona**, kas pārvalda YungWear Mini App kā personīgu projektu. Lietotne demonstrē personīgas lietas (piemēram, lietotu vai nevalkātu apģērbu) un palīdz noformēt pasūtījuma pieprasījumus, izmantojot Depop/Yaga vai tiešu saziņu. Ja jums ir jautājumi par šo politiku vai jūsu datiem, sazinieties ar mums, izmantojot mūsu Telegram robotu.',
          },
          {
            kind: 'p',
            text: 'Pārzinis atrodas Latvijā (Eiropas Savienībā). Visa šajā politikā aprakstītā datu apstrāde notiek saskaņā ar Vispārīgo datu aizsardzības regulu (VDAR).',
          },
        ],
      },
      {
        heading: '2. Kādus datus mēs apkopojam?',
        blocks: [
          {
            kind: 'p',
            text: 'Lietojot šo Mini App, mēs apkopojam šādas datu kategorijas:',
          },
          {
            kind: 'list',
            items: [
              '**Telegram konta dati:** Telegram lietotāja ID, lietotājvārds, vārds un valodas kods. Tos no Telegram saņemam, atverot Mini App.',
              '**Pasūtījuma pieprasījuma dati:** informācija, ko iesniedzat norēķinu formā, tostarp pilns vārds, Telegram kontaktinformācija, kontaktpiezīmes, piegādes adrese vai tikšanās vēlmes un vēlamā apmaksas metode.',
              '**Nosūtījumu (referāļu) aktivitāte:** jūsu unikālais nosūtījuma kods, veiksmīgo nosūtījumu skaits un uzaicināto lietotāju Telegram ID (tiek glabāti droši un netiek publiski rādīti).',
              '**Dalība izlozēs:** jūsu Telegram lietotāja ID, lietotājvārds, dalības laiks, izpildītie uzdevumi un biļešu skaits, piedaloties izlozēs.',
              '**Ikdienas atzīmēšanās (check-in):** jūsu nepārtraukto atzīmēšanos skaits un kopējais atzīmēšanos skaits, lai pārvaldītu atlīdzības.',
              '**Redzamība līderu tabulā:** vai esat izvēlējies parādīties publiskajā nosūtījumu līderu tabulā (tikai pēc jūsu piekrišanas).',
              '**Paziņojumu abonements:** jūsu nepārprotamais piekrišanas vai atteikuma statuss mūsu paziņojumu saņemšanai.',
              '**Klātbūtne tiešsaistē:** laika zīmogs, kas norāda jūsu pēdējo aktivitāti lietotnē un tiek izmantots aptuvenā aktīvo lietotāju skaita rādīšanai. Tā nav reāllaika izsekošanas sistēma un neieraksta jūsu uzvedību.',
            ],
          },
        ],
      },
      {
        heading: '3. Kāpēc mēs apstrādājam jūsu datus un uz kāda pamata?',
        blocks: [
          {
            kind: 'titled',
            title: 'Pasūtījuma pieprasījumu apstrāde',
            text: 'Juridiskais pamats: **līguma izpilde** (VDAR 6. panta 1. punkta b) apakšpunkts). Lai apstrādātu jūsu pasūtījuma pieprasījumu un sazinātos ar jums, mums ir nepieciešams jūsu Telegram ID, vārds un kontaktinformācija.',
          },
          {
            kind: 'titled',
            title: 'Nosūtījumu un atlīdzību sistēma',
            text: 'Juridiskais pamats: **leģitīmā interese** (VDAR 6. panta 1. punkta f) apakšpunkts) un — attiecībā uz redzamību līderu tabulā — **piekrišana** (VDAR 6. panta 1. punkta a) apakšpunkts). Mēs sekojam nosūtījumiem, lai darbinātu atlīdzību programmu. Jūsu redzamība līderu tabulā ir iespējama tikai pēc jūsu piekrišanas.',
          },
          {
            kind: 'titled',
            title: 'Dalība izlozēs',
            text: 'Juridiskais pamats: **līguma izpilde** (VDAR 6. panta 1. punkta b) apakšpunkts). Mums ir nepieciešams jūsu Telegram ID, lai reģistrētu jūsu dalību, pārvaldītu biļetes un sazinātos ar jums, ja uzvarat.',
          },
          {
            kind: 'titled',
            title: 'Paziņojumi',
            text: 'Juridiskais pamats: **piekrišana** (VDAR 6. panta 1. punkta a) apakšpunkts). Mēs sūtām paziņojumus tikai tad, ja esat nepārprotami piekritis. Jūs varat atsaukt piekrišanu jebkurā laikā lietotnes iestatījumos.',
          },
          {
            kind: 'titled',
            title: 'Ikdienas atzīmēšanās',
            text: 'Juridiskais pamats: **leģitīmā interese** (VDAR 6. panta 1. punkta f) apakšpunkts), lai darbinātu iesaistes programmu.',
          },
          {
            kind: 'titled',
            title: 'Klātbūtnes skaitītājs tiešsaistē',
            text: 'Juridiskais pamats: **leģitīmā interese** (VDAR 6. panta 1. punkta f) apakšpunkts), lai rādītu aptuvenu aktīvo lietotāju skaitu. Tas ir minimāls klātbūtnes rādītājs, nevis lietotāju izsekošana.',
          },
        ],
      },
      {
        heading: '4. Cik ilgi mēs glabājam jūsu datus?',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Pasūtījuma pieprasījumi:** tiek glabāti līdz 1 gadam pēc pēdējās saziņas, lai pārvaldītu notiekošās sarunas, pēc tam tiek dzēsti vai anonimizēti.',
              '**Nosūtījumu dati:** tiek glabāti, kamēr esat aktīvs lietotnes lietotājs. Ja pieprasāt dzēšanu, nosūtījumu dati tiek anonimizēti 30 dienu laikā.',
              '**Dalība izlozēs:** tiek glabāta līdz 6 mēnešiem pēc izlozes beigām; pēc tam tiek saglabāta tikai uzvarētāju informācija balvu izsniegšanas uzskaitei.',
              '**Piekrišanas ieraksti:** tiek glabāti līdz 3 gadiem, lai apliecinātu atbilstību VDAR.',
              '**Ikdienas atzīmēšanās un klātbūtnes dati:** tiek glabāti, kamēr esat aktīvs. Tiek atiestatīti pēc 90 dienām bez aktivitātes.',
            ],
          },
        ],
      },
      {
        heading: '5. Jūsu tiesības saskaņā ar VDAR',
        blocks: [
          { kind: 'p', text: 'Attiecībā uz saviem personas datiem jums ir šādas tiesības:' },
          {
            kind: 'list',
            items: [
              '**Tiesības piekļūt datiem:** pieprasīt kopiju no datiem, ko glabājam par jums.',
              '**Tiesības labot datus:** pieprasīt neprecīzu datu labošanu.',
              '**Tiesības tikt aizmirstam (dzēšana):** pieprasīt savu datu dzēšanu, ievērojot tiesiskās glabāšanas prasības.',
              '**Tiesības ierobežot apstrādi:** pieprasīt, lai mēs ierobežotu jūsu datu izmantošanu.',
              '**Tiesības uz datu pārnesamību:** pieprasīt savus datus strukturētā, mašīnlasāmā formātā.',
              '**Tiesības iebilst:** iebilst pret apstrādi, kas balstīta uz leģitīmajām interesēm, tostarp paziņojumu sūtīšanu.',
              '**Tiesības atsaukt piekrišanu:** jebkurā laikā atsaukt sniegto piekrišanu (piemēram, atteikties no paziņojumiem vai redzamības līderu tabulā).',
            ],
          },
          {
            kind: 'p',
            text: 'Lai īstenotu kādas no šīm tiesībām, sazinieties ar mums, izmantojot Telegram robotu. Mēs atbildēsim 30 dienu laikā, kā to prasa VDAR.',
          },
          {
            kind: 'p',
            text: 'Jums ir arī tiesības iesniegt sūdzību Latvijas datu aizsardzības iestādē (Datu valsts inspekcija), ja uzskatāt, ka jūsu tiesības ir pārkāptas.',
          },
        ],
      },
      {
        heading: '6. Kas apstrādā jūsu datus?',
        blocks: [
          {
            kind: 'p',
            text: 'Mēs izmantojam šādus pakalpojumu sniedzējus, kas apstrādā jūsu datus mūsu vārdā (datu apstrādātāji):',
          },
          {
            kind: 'list',
            items: [
              '**Firebase / Google Cloud Platform** (Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, ASV). Firebase nodrošina lietotnes datubāzi (Firestore), failu glabāšanu (Cloud Storage) un servera puses loģiku (Cloud Functions). Dati var tikt pārsūtīti uz ASV saskaņā ar ES–ASV datu privātuma sistēmu (Data Privacy Framework). Skatīt: [Google Cloud DPA](https://cloud.google.com/terms/data-processing-agreement).',
              '**Telegram** (Telegram Messenger LLP, 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, Apvienotā Karaliste). Telegram nodrošina Mini App platformu un ziņojumapmaiņas infrastruktūru.',
            ],
          },
        ],
      },
      {
        heading: '7. Starptautiska datu pārsūtīšana',
        blocks: [
          {
            kind: 'p',
            text: 'Jūsu dati tiek glabāti Firebase serveros, kas var atrasties ārpus Eiropas Ekonomikas zonas (EEZ). Google Cloud Platform ir sertificēta atbilstībai ES–ASV datu privātuma sistēmai. Lietojot šo lietotni, jūs apstiprināt, ka jūsu dati var tikt pārsūtīti un apstrādāti ASV un citās valstīs, kurās darbojas Google.',
          },
        ],
      },
      {
        heading: '8. Izmaiņas šajā politikā',
        blocks: [
          {
            kind: 'p',
            text: 'Mēs varam laiku pa laikam atjaunināt šo Privātuma politiku. Par būtiskām izmaiņām informēsim jūs, izmantojot Mini App vai Telegram. Lietotnes turpmāka lietošana pēc izmaiņām nozīmē atjauninātās politikas pieņemšanu.',
          },
        ],
      },
    ],
  },

  // ───────────────────────── Terms of Service ─────────────────────────
  terms: {
    en: [
      {
        heading: '1. Nature of the Application',
        blocks: [
          {
            kind: 'p',
            text: 'This Telegram Mini App ("the App") serves as a **product catalog and order request platform**. It allows you to browse products, express interest, and submit an order request.',
          },
          {
            kind: 'p',
            text: 'The operator is a **private individual** reselling personal items (for example, used or unworn clothing) via Depop/Yaga or direct communication, using this Mini App as a catalogue and request form.',
          },
          {
            kind: 'p',
            text: '**The App is NOT a point of sale. No payments are processed through the App.**',
          },
          {
            kind: 'p',
            text: 'By submitting an order request through the App, you express your interest in purchasing the selected items. The actual sale, payment, delivery, and any returns or exchanges are handled outside the App — either through the third-party platforms Depop or Yaga, or by separate direct agreement with the seller.',
          },
        ],
      },
      {
        heading: '2. Important Disclaimers',
        blocks: [
          {
            kind: 'list',
            items: [
              '**No payment processing:** The App does not accept, process, or facilitate any payments. All financial transactions occur exclusively on Depop, Yaga, or through separate arrangements outside the App.',
              '**No delivery or shipping:** The App does not handle shipping, delivery logistics, or fulfilment. Delivery arrangements are made by the seller outside the App.',
              '**No returns or refunds:** All questions about returns, exchanges, refunds, or guarantees are governed by the terms and conditions of Depop or Yaga (as applicable) or by direct agreement with the seller. The App operator is not responsible for resolving disputes regarding transactions completed outside the App.',
              '**Order request is not an order confirmation:** Submitting an order request through the App does not guarantee product availability or final sale. The seller will confirm the order and finalise details outside the App.',
            ],
          },
        ],
      },
      {
        heading: '3. Giveaway Rules',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Eligibility:** Giveaways are open to users who have accepted these Terms and the Privacy Policy. Winners are selected through a transparent, weighted random draw based on ticket count.',
              '**Winner selection:** Winners are drawn using a weighted random algorithm where each ticket represents one chance. Each prize place is drawn independently, and no user can win more than one prize in the same giveaway.',
              '**Notification:** Winners are notified via Telegram message. If a winner does not respond within **7 days**, an alternative winner may be selected at the operator\'s discretion.',
              '**Prize fulfilment:** Prizes are fulfilled outside the App (via Depop, Yaga, or direct arrangement). The operator is not responsible for shipping costs unless explicitly stated.',
            ],
          },
        ],
      },
      {
        heading: '4. Promo Code Rules',
        blocks: [
          {
            kind: 'list',
            items: [
              'Promo codes are issued at the operator\'s discretion and may be time-limited, one-time-use, or subject to other restrictions stated with the code.',
              'A promo code provides a discount on the total price of an order request. The discount is applied when the seller and buyer finalise the transaction outside the App.',
              'Promo codes have no cash value and cannot be exchanged for money.',
              'The operator reserves the right to revoke or modify any promo code at any time without prior notice.',
            ],
          },
        ],
      },
      {
        heading: '5. User Conduct',
        blocks: [
          {
            kind: 'list',
            items: [
              'You agree not to use the App for any unlawful purpose or in violation of any applicable laws.',
              'You agree not to manipulate the giveaway system, referral system, or any other feature of the App through automated means, multiple accounts, or other abusive practices.',
              'The operator reserves the right to suspend or terminate access to the App for users who violate these terms.',
            ],
          },
        ],
      },
      {
        heading: '6. Limitation of Liability',
        blocks: [
          {
            kind: 'p',
            text: 'The App is provided "as is" without any warranty, express or implied. The operator shall not be liable for any damages arising from the use or inability to use the App, including but not limited to issues with transactions completed outside the App on Depop, Yaga, or other platforms.',
          },
        ],
      },
      {
        heading: '7. Governing Law',
        blocks: [
          {
            kind: 'p',
            text: 'These Terms are governed by the laws of the Republic of Latvia. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of Riga, Latvia.',
          },
          {
            kind: 'p',
            text: 'If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.',
          },
        ],
      },
      {
        heading: '8. Changes to These Terms',
        blocks: [
          {
            kind: 'p',
            text: 'We may update these Terms from time to time. Material changes will be notified to you via the App or through Telegram. Continued use of the App after changes constitutes acceptance of the updated Terms.',
          },
        ],
      },
    ],
    ru: [
      {
        heading: '1. Характер приложения',
        blocks: [
          {
            kind: 'p',
            text: 'Этот Telegram Mini App («Приложение») представляет собой **каталог товаров и платформу для запросов на заказ**. Он позволяет просматривать товары, выражать заинтересованность и отправлять запрос на заказ.',
          },
          {
            kind: 'p',
            text: 'Оператор — **частное лицо**, которое перепродаёт личные вещи (например, одежду в употреблении или новую) через Depop/Yaga или при прямом общении, используя это Mini App как каталог и форму запроса.',
          },
          {
            kind: 'p',
            text: '**Приложение НЕ является торговой точкой. Через Приложение не проводятся платежи.**',
          },
          {
            kind: 'p',
            text: 'Отправляя запрос на заказ через Приложение, вы выражаете заинтересованность в покупке выбранных товаров. Фактическая продажа, оплата, доставка, а также возвраты и обмены осуществляются вне Приложения — либо через сторонние платформы Depop или Yaga, либо по отдельному прямому соглашению с продавцом.',
          },
        ],
      },
      {
        heading: '2. Важные оговорки',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Отсутствие обработки платежей:** Приложение не принимает, не обрабатывает и не способствует проведению платежей. Все финансовые операции совершаются исключительно на Depop, Yaga или по отдельным договорённостям вне Приложения.',
              '**Отсутствие доставки:** Приложение не занимается доставкой, логистикой или исполнением заказов. Доставку организует продавец вне Приложения.',
              '**Отсутствие возвратов и возмещений:** Все вопросы возвратов, обменов, возмещений и гарантий регулируются условиями Depop или Yaga (при применимости) либо прямым соглашением с продавцом. Оператор Приложения не несёт ответственности за урегулирование споров по сделкам, совершённым вне Приложения.',
              '**Запрос на заказ не является подтверждением заказа:** Отправка запроса на заказ не гарантирует наличие товара или окончательную продажу. Продавец подтвердит заказ и согласует детали вне Приложения.',
            ],
          },
        ],
      },
      {
        heading: '3. Правила розыгрышей',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Участие:** В розыгрышах могут участвовать пользователи, принявшие настоящие Условия и Политику конфиденциальности. Победители определяются прозрачным случайным выбором с учётом весов, исходя из количества билетов.',
              '**Выбор победителя:** Победители определяются с помощью алгоритма случайного выбора с весами, где каждый билет даёт один шанс. Каждое призовое место разыгрывается независимо; один пользователь не может выиграть более одного приза в одном розыгрыше.',
              '**Уведомление:** Победители уведомляются сообщением в Telegram. Если победитель не ответит в течение **7 дней**, оператор по своему усмотрению может выбрать другого победителя.',
              '**Выдача приза:** Призы выдаются вне Приложения (через Depop, Yaga или по прямому соглашению). Оператор не несёт ответственности за стоимость доставки, если это не указано явно.',
            ],
          },
        ],
      },
      {
        heading: '4. Правила промокодов',
        blocks: [
          {
            kind: 'list',
            items: [
              'Промокоды выдаются по усмотрению оператора и могут быть ограничены по времени, одноразовыми или подлежать иным ограничениям, указанным вместе с кодом.',
              'Промокод предоставляет скидку на общую стоимость запроса на заказ. Скидка применяется, когда продавец и покупатель завершают сделку вне Приложения.',
              'Промокоды не имеют денежной стоимости и не могут быть обменены на деньги.',
              'Оператор оставляет за собой право в любой момент отозвать или изменить любой промокод без предварительного уведомления.',
            ],
          },
        ],
      },
      {
        heading: '5. Поведение пользователей',
        blocks: [
          {
            kind: 'list',
            items: [
              'Вы обязуетесь не использовать Приложение в незаконных целях или с нарушением применимого законодательства.',
              'Вы обязуетесь не манипулировать системой розыгрышей, реферальной системой или любыми другими функциями Приложения с помощью автоматизированных средств, множественных аккаунтов или иных злоупотреблений.',
              'Оператор оставляет за собой право приостановить или прекратить доступ к Приложению для пользователей, нарушающих настоящие условия.',
            ],
          },
        ],
      },
      {
        heading: '6. Ограничение ответственности',
        blocks: [
          {
            kind: 'p',
            text: 'Приложение предоставляется «как есть», без каких-либо гарантий, явных или подразумеваемых. Оператор не несёт ответственности за любой ущерб, возникший в результате использования или невозможности использования Приложения, включая, помимо прочего, проблемы со сделками, совершёнными вне Приложения на Depop, Yaga или других платформах.',
          },
        ],
      },
      {
        heading: '7. Применимое право',
        blocks: [
          {
            kind: 'p',
            text: 'Настоящие Условия регулируются законодательством Латвийской Республики. Любые споры, возникающие из настоящих Условий, подлежат исключительной юрисдикции судов Риги, Латвия.',
          },
          {
            kind: 'p',
            text: 'Если какое-либо положение настоящих Условий признано недействительным или не подлежащим исполнению, остальные положения сохраняют полную силу.',
          },
        ],
      },
      {
        heading: '8. Изменения настоящих Условий',
        blocks: [
          {
            kind: 'p',
            text: 'Мы можем время от времени обновлять настоящие Условия. О существенных изменениях мы сообщим вам через Приложение или Telegram. Продолжение использования Приложения после внесения изменений означает принятие обновлённых Условий.',
          },
        ],
      },
    ],
    lv: [
      {
        heading: '1. Lietotnes raksturs',
        blocks: [
          {
            kind: 'p',
            text: 'Šis Telegram Mini App ("Lietotne") kalpo kā **produktu katalogs un pasūtījuma pieprasījumu platforma**. Tas ļauj apskatīt produktus, izteikt interesi un iesniegt pasūtījuma pieprasījumu.',
          },
          {
            kind: 'p',
            text: 'Operators ir **privātpersona**, kas pārdod personīgas lietas (piemēram, lietotu vai nevalkātu apģērbu), izmantojot Depop/Yaga vai tiešu saziņu, un izmanto šo Mini App kā katalogu un pieprasījuma veidlapu.',
          },
          {
            kind: 'p',
            text: '**Lietotne NAV tirdzniecības vieta. Lietotnē netiek apstrādāti maksājumi.**',
          },
          {
            kind: 'p',
            text: 'Iesniedzot pasūtījuma pieprasījumu, izmantojot Lietotni, jūs izsakāt interesi iegādāties atlasītos produktus. Faktiskā pārdošana, maksājums, piegāde, kā arī jebkāda atgriešana vai apmaiņa tiek veikta ārpus Lietotnes — vai nu trešo pušu platformās Depop vai Yaga, vai ar atsevišķu tiešu vienošanos ar pārdevēju.',
          },
        ],
      },
      {
        heading: '2. Svarīgi atrunu punkti',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Nav maksājumu apstrādes:** Lietotne nepieņem, neapstrādā un neveicina nekādus maksājumus. Visi finanšu darījumi notiek tikai Depop, Yaga vai saskaņā ar atsevišķām vienošanām ārpus Lietotnes.',
              '**Nav piegādes vai nosūtīšanas:** Lietotne nenodrošina nosūtīšanu, piegādes loģistiku vai izpildi. Piegādi organizē pārdevējs ārpus Lietotnes.',
              '**Nav atgriešanas vai naudas atmaksas:** Visus jautājumus par atgriešanu, apmaiņu, naudas atmaksu vai garantijām regulē Depop vai Yaga noteikumi (ja piemērojami) vai tieša vienošanās ar pārdevēju. Lietotnes operators nav atbildīgs par strīdu risināšanu attiecībā uz darījumiem, kas veikti ārpus Lietotnes.',
              '**Pasūtījuma pieprasījums nav pasūtījuma apstiprinājums:** Pasūtījuma pieprasījuma iesniegšana Lietotnē negarantē produkta pieejamību vai galīgo pārdošanu. Pārdevējs apstiprinās pasūtījumu un galīgi saskaņos detaļas ārpus Lietotnes.',
            ],
          },
        ],
      },
      {
        heading: '3. Izložu noteikumi',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Dalības tiesības:** Izlozēs var piedalīties lietotāji, kuri ir pieņēmuši šos Noteikumus un Privātuma politiku. Uzvarētāji tiek izvēlēti pārredzamā, svērtā nejaušā izlozē, pamatojoties uz biļešu skaitu.',
              '**Uzvarētāja izvēle:** Uzvarētāji tiek izlozēti, izmantojot svērtu nejaušības algoritmu, kur katra biļete nozīmē vienu iespēju. Katra balvas vieta tiek izlozēta neatkarīgi, un viens lietotājs vienā izlozē nevar iegūt vairāk par vienu balvu.',
              '**Paziņošana:** Uzvarētāji tiek informēti ar Telegram ziņojumu. Ja uzvarētājs neatbild **7 dienu** laikā, operatora ieskatā var tikt izvēlēts cits uzvarētājs.',
              '**Balvas izsniegšana:** Balvas tiek izsniegtas ārpus Lietotnes (caur Depop, Yaga vai tiešu vienošanos). Operators nav atbildīgs par piegādes izmaksām, ja vien tas nav nepārprotami norādīts.',
            ],
          },
        ],
      },
      {
        heading: '4. Akcijas kodu noteikumi',
        blocks: [
          {
            kind: 'list',
            items: [
              'Akcijas kodi tiek izsniegti pēc operatora ieskata, un tie var būt ierobežoti laikā, izmantojami vienu reizi vai pakļauti citiem ierobežojumiem, kas norādīti kopā ar kodu.',
              'Akcijas kods sniedz atlaidi pasūtījuma pieprasījuma kopējai cenai. Atlaide tiek piemērota, kad pārdevējs un pircējs pabeidz darījumu ārpus Lietotnes.',
              'Akcijas kodiem nav naudas vērtības, un tos nevar apmainīt pret naudu.',
              'Operators patur tiesības jebkurā laikā bez iepriekšēja brīdinājuma atsaukt vai mainīt jebkuru akcijas kodu.',
            ],
          },
        ],
      },
      {
        heading: '5. Lietotāju uzvedība',
        blocks: [
          {
            kind: 'list',
            items: [
              'Jūs apņematies neizmantot Lietotni nelikumīgiem mērķiem un nepārkāpjot piemērojamos tiesību aktus.',
              'Jūs apņematies nemanipulēt izložu sistēmu, nosūtījumu sistēmu vai citas Lietotnes funkcijas, izmantojot automatizētus līdzekļus, vairākus kontus vai citādu ļaunprātīgu praksi.',
              'Operators patur tiesības apturēt vai pārtraukt piekļuvi Lietotnei lietotājiem, kuri pārkāpj šos noteikumus.',
            ],
          },
        ],
      },
      {
        heading: '6. Atbildības ierobežojums',
        blocks: [
          {
            kind: 'p',
            text: 'Lietotne tiek sniegta "tāda, kāda tā ir", bez jebkādām garantijām, tiešām vai netiešām. Operators neatbild par kaitējumu, kas rodas no Lietotnes lietošanas vai nespējas to lietot, tostarp bez ierobežojuma par problēmām, kas saistītas ar darījumiem, kas veikti ārpus Lietotnes Depop, Yaga vai citās platformās.',
          },
        ],
      },
      {
        heading: '7. Piemērojamās tiesības',
        blocks: [
          {
            kind: 'p',
            text: 'Šos Noteikumus reglamentē Latvijas Republikas tiesību akti. Jebkuri strīdi, kas izriet no šiem Noteikumiem, ir pakļauti Rīgas, Latvijas, tiesu ekskluzīvajai jurisdikcijai.',
          },
          {
            kind: 'p',
            text: 'Ja kāds šo Noteikumu punkts tiek atzīts par spēkā neesošu vai neizpildāmu, pārējie punkti paliek pilnībā spēkā.',
          },
        ],
      },
      {
        heading: '8. Izmaiņas šajos Noteikumos',
        blocks: [
          {
            kind: 'p',
            text: 'Mēs varam laiku pa laikam atjaunināt šos Noteikumus. Par būtiskām izmaiņām informēsim jūs, izmantojot Lietotni vai Telegram. Lietotnes turpmāka lietošana pēc izmaiņām nozīmē atjaunināto Noteikumu pieņemšanu.',
          },
        ],
      },
    ],
  },
}
