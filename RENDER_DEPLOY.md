# Деплой Quik на Render

## Шаг 1: Подготовка файлов

Убедитесь что в `server-mongodb.js`:
- `USE_MONGODB = true` 
- Строка подключения к MongoDB Atlas уже настроена

## Шаг 2: Создайте package.json для деплоя

```json
{
  "name": "quik-social",
  "version": "1.0.0",
  "main": "server-mongodb.js",
  "scripts": {
    "start": "node server-mongodb.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongoose": "^8.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## Шаг 3: Deploy на Render

1. Зайдите на https://dashboard.render.com
2. Нажмите "New +" → "Web Service"
3. Подключите ваш GitHub репозиторий
4. Настройте:
   - Name: `quik-social`
   - Environment: `Node`
   - Build Command: (оставьте пустым)
   - Start Command: `node server-mongodb.js`
5. Нажмите "Create Web Service"

## Альтернатива: Деплой без GitHub

1. Создайте ZIP архив папки с файлами
2. Используйте Render CLI или загрузите через GitHub Gist

## Подключение

После деплоя получите URL вида:
`https://quik-social.onrender.com`

Обновите в `index.js` API_URL если нужно!
