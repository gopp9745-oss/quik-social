# Подключение MongoDB Atlas к Render

## Шаг 1: Настройка переменных окружения на Render

1. Зайдите на https://dashboard.render.com
2. Выберите ваш Web Service "quik-social"
3. Нажмите **"Environment"** в боковом меню
4. Нажмите **"Add Environment Variable"**

## Шаг 2: Добавьте переменные

Добавьте следующие переменные:

| Key | Value |
|-----|--------|
| `MONGO_URI` | `mongodb+srv://quikuser:quikpassword123@cluster0.jf8hps1.mongodb.net/?appName=Cluster0` |
| `USE_MONGODB` | `true` |

## Шаг 3: Обновите server-mongodb.js

Измените файл чтобы использовать переменную окружения:

```javascript
const USE_MONGODB = process.env.USE_MONGODB === 'true';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://quikuser:quikpassword123@cluster0.jf8hps1.mongodb.net/?appName=Cluster0';
```

## Шаг 4: Deploy

1. Нажмите **"Save Changes"**
2. Render автоматически передеплоит приложение
3. После деплоя проверьте логи

## Альтернативный способ

Если не хотите использовать переменные окружения, просто оставьте строку подключения прямо в коде - она уже там есть!

В файле `server-mongodb.js`:
```javascript
const USE_MONGODB = true;
const MONGO_URI = 'mongodb+srv://quikuser:quikpassword123@cluster0.jf8hps1.mongodb.net/?appName=Cluster0';
```

Это уже настроено и будет работать на Render!

## Проверка

После деплоя откройте ваш сайт и попробуйте зарегистрироваться - данные сохранятся в MongoDB Atlas.
