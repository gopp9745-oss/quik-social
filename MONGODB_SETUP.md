# Как подключить MongoDB Atlas бесплатно

## Шаг 1: Регистрация
1. Откройте https://www.mongodb.com/cloud/atlas
2. Нажмите "Try Free"
3. Зарегистрируйтесь (Google аккаунт или email)

## Шаг 2: Создание кластера
1. После входа нажмите "Create a deployment"
2. Выберите **Free** (M0 Sandbox)
3. Нажмите "Create"
4. Дождитесь создания кластера (1-2 минуты)

## Шаг 3: Настройка доступа
1. Нажмите "Database Access" в меню слева
2. Нажмите "Add New Database User"
3. Создайте пользователя:
   - Username: `quikuser`
   - Password: `quikpassword123` (или свой)
4. Нажмите "Add User"

## Шаг 4: Разрешение сетевого доступа
1. Нажмите "Network Access" в меню слева  
2. Нажмите "Add IP Address"
3. Выберите "Allow Access from Anywhere" (0.0.0.0/0)
4. Нажмите "Confirm"

## Шаг 5: Получение строки подключения
1. Нажмите "Database" в меню слева
2. Нажмите "Connect" на вашем кластере
3. Выберите "Drivers"
4. Скопируйте строку подключения:
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

Замените `<username>` и `<password>` на ваши данные из шага 3.

## Шаг 6: Запуск
1. Откройте файл `server.js` в редакторе
2. Найдите строку:
```javascript
const MONGO_URI = 'ваша_строка_подключения';
```
3. Вставьте вашу строку подключения
4. Запустите `start-quik.bat`

## Альтернатива: Локальная MongoDB
Если хотите установить MongoDB локально:
1. Скачайте MongoDB Community Server: https://www.mongodb.com/try/download/community
2. Установите и запустите
3. Строка подключения: `mongodb://localhost:27017/quik`
