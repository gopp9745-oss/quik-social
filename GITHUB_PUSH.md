# Как загрузить Quik на GitHub и Deploy на Render

## Шаг 1: Создайте репозиторий на GitHub

1. Зайдите на https://github.com/new
2. Введите имя: `quik-social`
3. Выберите "Public"
4. Нажмите "Create repository"

## Шаг 2: Загрузите файлы

Откройте терминал (Git Bash или PowerShell) в папке проекта и выполните:

```bash
cd "C:\Users\MyPc\Desktop\проекты на VS\Новая папка (4)"

git init
git add .
git commit -m "Initial commit - Quik Social Network"

git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/quik-social.git
git push -u origin main
```

Замените `YOUR_USERNAME` на ваше имя пользователя GitHub.

## Шаг 3: Deploy на Render

1. Зайдите на https://dashboard.render.com
2. Нажмите "New +" → "Web Service"
3. Выберите ваш репозиторий `quik-social`
4. Настройте:
   - **Name:** `quik-social`
   - **Environment:** `Node`
   - **Build Command:** (оставьте пустым)
   - **Start Command:** `node server-mongodb.js`
5. Нажмите "Create Web Service"
6. Дождитесь деплоя (2-5 минут)

## Шаг 4: Обновите frontend URL

После деплоя получите ваш URL, например:
`https://quik-social.onrender.com`

В файле `index.html` измените строку:
```javascript
const API_URL = (window.location.protocol + '//' + window.location.host) + '/api';
```

на:
```javascript
const API_URL = 'https://quik-social.onrender.com/api';
```

Или просто добавьте новый файл `render.json`:
```json
{
  "apiUrl": "https://ваш-url.onrender.com/api"
}
```

## Готово! 🎉

Ваша социальная сеть Quik теперь доступна онлайн!
