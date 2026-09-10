/* Complete website copy. Language codes match the desktop application. */
globalThis.SITE_LANGUAGES = {en:'English',ru:'Русский',es:'Español',pt:'Português',fr:'Français',de:'Deutsch',it:'Italiano',tr:'Türkçe',pl:'Polski',uk:'Українська'};
globalThis.SITE_COPY = {
en:{
 meta:['Musical AI — your models, your rhythm','A desktop AI workspace with local models, collaborative agents, MCP tools and Ollama Cloud. Download for Windows, macOS and Linux.'],
 nav:['Skip to content','Features','How it works','Download','Language'],
 hero:['YOUR SPACE FOR AI','Your models.','Your rhythm.','From the first thought to the finished result.','Local models, a team of agents and your tools — together in one app.','Download Musical AI','View on GitHub','Windows · macOS · Linux · No subscription required for local inference'],
 product:['MUSICAL AI / WORKSPACE','Less noise. More room to think.','Musical AI desktop interface with projects and a chat composer','Local when you want independence.','Cloud when you need larger models.'],
 features:['01 / POSSIBILITIES','Build your own way to work.','Choose the models and tools that fit your task.',[
 ['Models on your computer','Run local models through Ollama on every supported platform. Windows also offers a built-in engine and a one-step setup.','Local inference works offline after downloading models'],
 ['One request. Several agents.','A coordinator assigns suitable parts of a task to specialists. Watch their progress while the main model combines their results.','Up to two specialists · Speed depends on your model and hardware'],
 ['Tools within reach','Connect MCP servers and Markdown Skills. The built-in Workspace lets models read your projects with your chosen permissions.','MCP · Skills · Action approvals']]],
 inside:['02 / INSIDE THE APP','One workspace. More possibilities.','Start with local chat. Add tools and cloud models whenever you need them.','Local models','Subagents','Plugins & Skills','Ollama Cloud','FEATURE OVERVIEW'],
 demos:[
 ['ON YOUR COMPUTER','Start with one model.','Windows Quick setup downloads the engine and Qwen 1.5B. On macOS and Linux, install Ollama and choose a model.',[['Qwen 2.5 · 1.5B','Local'],['Ollama','Windows, macOS, Linux']],'Models download separately. Larger models need more memory.'],
 ['WORKING TOGETHER','Each agent has a part.','One specialist compares options; another checks constraints. The main model brings the results together.',[['Coordinator','Task splitting'],['Up to two specialists','Parallel subtasks'],['Main model','Combined answer']],'An example of task distribution. Performance depends on the task and your computer.'],
 ['TOOLS AND INSTRUCTIONS','Connect what you need.','MCP gives models tools. Skills provide instructions. Start with the built-in Workspace.',[['Workspace','Projects and text files'],['MCP','Local and HTTP servers'],['Skills','Markdown instructions']],'Third-party servers may need their own runtime. OAuth is not supported yet.'],
 ['OLLAMA CLOUD','Larger models. Lighter on your PC.','Connect your Ollama account API key and choose a cloud model inside the app.',[['Model catalog','Loaded from Ollama'],['API key','Encrypted storage'],['Plans','Payment on ollama.com']],'Cloud requests go to Ollama. Model availability and limits depend on the service.']],
 details:['03 / YOU ARE IN CONTROL','Know what is happening.','Choose what happens next.',[
 ['Local or cloud','Local requests run on your computer. With Cloud selected, messages and attached context go to Ollama, as indicated in the app.'],
 ['Approve or automate','Choose tool permissions. Planning mode disables MCP calls; approval mode shows each proposed action before it runs.'],
 ['Make it yours','A calm interface, animated strings and Discord Activity. Shape your workspace around the way you work.']]],
 download:['READY FOR YOUR FIRST IDEA?','Your next step starts here.','Choose your system and install Musical AI.','Download for Windows','Download for macOS','Download for Linux','Installer','Portable','Apple Silicon','Intel Mac','Ubuntu / Debian','Version','On macOS and Linux, install Ollama for local models or connect Ollama Cloud. Windows also supports the built-in engine.','macOS builds are unsigned and not notarized by Apple.','All releases'],
 faq:['A FEW MORE QUESTIONS','Before you start.',[
 ['Do I need a subscription?','Local inference requires no subscription. Ollama Cloud is a separate service with its own free limits, plans and payments on ollama.com.'],
 ['Do I need a powerful GPU?','Small models can run on a CPU. Speed and model size depend on your hardware and available memory. Cloud models do not need a local GPU.'],
 ['What does Quick setup install?','On Windows x64, it downloads llama.cpp and Qwen 2.5 1.5B: about 1.14 GB, plus Microsoft Visual C++ components if needed. macOS and Linux use Ollama for local models.'],
 ['How do I install on Linux or Mac?','Linux: install the .deb on Ubuntu/Debian, or make the AppImage executable and run it (FUSE may be required). Mac: open the DMG and drag Musical AI to Applications. macOS may require approval in Privacy & Security for the unsigned app.'],
 ['Where can I report a bug?','Open GitHub Issues and include the app version, model and steps to reproduce.']]],
 footer:'Made for your ideas. 2026.'
},
ru:{
 meta:['Musical AI — твои модели, твой ритм','AI-приложение с локальными моделями, сабагентами, MCP и Ollama Cloud. Скачать для Windows, macOS и Linux.'],
 nav:['К содержимому','Возможности','Как это работает','Скачать','Язык'],
 hero:['ТВОЁ ПРОСТРАНСТВО ДЛЯ AI','Твои модели.','Твой ритм.','От первой мысли до готового результата.','Локальные модели, команда агентов и инструменты — в одном приложении.','Скачать Musical AI','Смотреть на GitHub','Windows · macOS · Linux · Локальная генерация без подписки'],
 product:['MUSICAL AI / РАБОЧЕЕ ПРОСТРАНСТВО','Меньше шума. Больше места для мысли.','Интерфейс Musical AI с проектами и полем запроса','Локально, когда важна автономность.','Облако, когда нужны более крупные модели.'],
 features:['01 / ВОЗМОЖНОСТИ','Собери свой способ работать.','Выбирай модели и инструменты под задачу.',[
 ['Модели на твоём компьютере','Запускай локальные модели через Ollama на всех поддерживаемых платформах. На Windows есть и встроенный движок с быстрой настройкой.','После загрузки моделей локальная генерация работает без интернета'],
 ['Один запрос. Несколько агентов.','Координатор распределяет подходящие части задачи между специалистами. Ты видишь их работу, а основная модель собирает общий ответ.','До двух специалистов · Скорость зависит от модели и ПК'],
 ['Инструменты под рукой','Подключай MCP-серверы и Markdown Skills. Встроенный Workspace помогает модели читать проекты с выбранными разрешениями.','MCP · Skills · Подтверждение действий']]],
 inside:['02 / ВНУТРИ ПРИЛОЖЕНИЯ','Одна студия. Больше возможностей.','Начни с локального чата. Добавляй инструменты и облачные модели, когда они нужны.','Локальные модели','Сабагенты','Плагины и Skills','Ollama Cloud','ОБЗОР ФУНКЦИИ'],
 demos:[
 ['НА ТВОЁМ КОМПЬЮТЕРЕ','Начни с одной модели.','Быстрая настройка Windows загрузит движок и Qwen 1.5B. На macOS и Linux установи Ollama и выбери модель.',[['Qwen 2.5 · 1.5B','Локально'],['Ollama','Windows, macOS, Linux']],'Модели скачиваются отдельно. Крупным моделям нужно больше памяти.'],
 ['СОВМЕСТНАЯ РАБОТА','У каждого — своя часть.','Один специалист сравнивает варианты, второй проверяет ограничения. Основная модель объединяет результаты.',[['Координатор','Разделение задачи'],['До двух специалистов','Параллельные подзадачи'],['Основная модель','Общий ответ']],'Пример распределения работы. Скорость зависит от задачи и компьютера.'],
 ['ИНСТРУМЕНТЫ И ИНСТРУКЦИИ','Подключай нужное.','MCP даёт модели инструменты, а Skills — инструкции. Начни со встроенного Workspace.',[['Workspace','Проекты и текстовые файлы'],['MCP','Локальные и HTTP-серверы'],['Skills','Инструкции Markdown']],'Сторонним серверам может потребоваться отдельная среда запуска. OAuth пока не поддерживается.'],
 ['OLLAMA CLOUD','Больше моделей. Меньше требований к ПК.','Подключи API-ключ аккаунта Ollama и выбери облачную модель в приложении.',[['Каталог моделей','Загружается из Ollama'],['API-ключ','Зашифрованное хранение'],['Тарифы','Оплата на ollama.com']],'Облачные запросы отправляются в Ollama. Модели и лимиты зависят от условий сервиса.']],
 details:['03 / ТЫ УПРАВЛЯЕШЬ','Понятно, что происходит.','Выбирай, что будет дальше.',[
 ['Локально или в облаке','Локальные запросы обрабатываются на компьютере. При выборе Cloud сообщения и контекст отправляются в Ollama — это обозначено в приложении.'],
 ['С подтверждением или автоматически','Выбери разрешения для инструментов. В режиме планирования MCP-вызовы отключены; в режиме подтверждений действие видно перед запуском.'],
 ['Свой характер','Спокойный интерфейс, анимированные струны и Discord Activity. Настрой рабочее пространство под себя.']]],
 download:['ГОТОВ К ПЕРВОЙ ИДЕЕ?','Твой следующий шаг начинается здесь.','Выбери свою систему и установи Musical AI.','Скачать для Windows','Скачать для macOS','Скачать для Linux','Установщик','Без установки','Apple Silicon','Intel Mac','Ubuntu / Debian','Версия','На macOS и Linux установи Ollama для локальных моделей или подключи Ollama Cloud. На Windows также доступен встроенный движок.','Сборки macOS без подписи и нотариального заверения Apple.','Все релизы'],
 faq:['ЕЩЁ ПАРА ВОПРОСОВ','Перед началом.',[
 ['Нужна ли подписка?','Для локальной генерации подписка не нужна. Ollama Cloud — отдельный сервис со своими бесплатными лимитами, тарифами и оплатой на ollama.com.'],
 ['Нужна ли мощная видеокарта?','Небольшие модели могут работать на CPU. Скорость и размер моделей зависят от оборудования и памяти. Облачным моделям локальная видеокарта не нужна.'],
 ['Что устанавливает быстрая настройка?','На Windows x64 — llama.cpp и Qwen 2.5 1.5B: около 1,14 ГБ, а при необходимости и Microsoft Visual C++. На macOS и Linux локальные модели работают через Ollama.'],
 ['Как установить на Linux или Mac?','Linux: установи .deb на Ubuntu/Debian или разреши выполнение AppImage и запусти его (может понадобиться FUSE). Mac: открой DMG и перенеси Musical AI в «Программы». Для приложения без подписи может потребоваться разрешение в разделе «Конфиденциальность и безопасность».'],
 ['Где сообщить об ошибке?','Открой GitHub Issues и укажи версию приложения, модель и шаги воспроизведения.']]],
 footer:'Сделано для твоих идей. 2026.'
}
};
