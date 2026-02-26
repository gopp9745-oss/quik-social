# Инструкция по подключению MongoDB Atlas

## Шаг 1: Создайте бесплатный аккаунт
1. Перейдите на https://www.mongodb.com/cloud/atlas/register
2. Зарегистрируйтесь (бесплатно)
3. Создайте бесплатный кластер (выберите "Shared" - бесплатный)

## Шаг 2: Настройте доступ
1. В разделе "Database Access" создайте пользователя:
   - Username: quikuser
   - Password: quikpass123
   - Built-in Role: Atlas admin

## Шаг 3: Разрешите доступ с любого IP
1. В разделе "Network Access" нажмите "Add IP Address"
2. Выберите "Allow Access from Anywhere" (0.0.0.0/0)

## Шаг 4: Получите строку подключения
1. В разделе "Database" нажмите "Connect"
2. Выберите "Connect your application"
3. Скопируйте строку подключения:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Замените `<username>` и `<password>` на ваши данные

## Шаг 5: Обновите код
Отредактируйте файл `server/models/db.js` и замените строку подключения на вашу.
